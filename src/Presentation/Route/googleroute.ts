// src/Presentation/Route/socialRoute.ts
import { Router,type Request, type Response, type NextFunction } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import UserRepositoryMongo from "../../Data/Repositories/userRepositoryMongo.js";
import dotenv from "dotenv";
dotenv.config();

const router = Router();
const repo = new UserRepositoryMongo();

// env / defaults
const JWT_SECRET = (process.env.JWT_SECRET ?? "changeme") as jwt.Secret;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? "1d";
const CALLBACK_BASE = process.env.OAUTH_CALLBACK_BASE ?? "http://localhost:3000/api/auth";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:49705";
const DEEP_LINK = process.env.FRONTEND_DEEP_LINK ?? process.env.MOBILE_DEEP_LINK ?? "myapp://auth";

type StoredUser = { id: any; email: string; name: string; passwordHash: string; createdAt: Date };

function normalizeUser(doc: any): StoredUser | null {
    if (!doc) return null;
    const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
    const rawId = obj._id ?? obj.id;
    return {
        id: rawId?.toString?.() ?? rawId,
        email: obj.email,
        name: obj.name ?? "",
        passwordHash: obj.passwordHash ?? "",
        createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
    };
}

/**
 * Helper to safely extract origin from FRONTEND_URL (falls back to FRONTEND_URL if parsing fails)
 */
function getFrontendOrigin(frontendUrl: string): string {
    try {
        const url = new URL(frontendUrl);
        return url.origin;
    } catch (err) {
        // fallback: remove trailing slash if present
        return String(frontendUrl).replace(/\/$/, "");
    }
}

/**
 * Passport Google strategy
 */
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: `${CALLBACK_BASE}/google/callback`,
        },
        // verify callback
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                console.log('[oauth] google verify callback - profile:', {
                    id: profile.id,
                    displayName: profile.displayName,
                    emails: profile.emails?.map((e: any) => e.value)
                });

                const email = profile.emails?.[0]?.value?.toLowerCase();
                if (!email) {
                    return done(new Error("No email provided by Google"), undefined);
                }

                const found = await repo.findByEmail(email);
                console.log('[oauth] findByEmail result:', found);

                let user = normalizeUser(found);

                if (!user) {
                    const persistence = {
                        email,
                        name: profile.displayName ?? [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(" ") ?? "",
                        passwordHash: "",
                        createdAt: new Date(),
                    };
                    console.log('[oauth] creating user with:', persistence);
                    const saved = await repo.create(persistence);
                    console.log('[oauth] create result:', saved);
                    user = normalizeUser(saved);
                }

                if (!user) return done(new Error("Failed to create/find user"), undefined);
                return done(null, user as any);
            } catch (err) {
                console.error('[oauth] verify error', err);
                return done(err as Error);
            }
        }
    )
);

/**
 * Start Google OAuth flow
 * - To begin web popup flow, call /google?web=1
 */
router.get("/google", (req: Request, res: Response, next: NextFunction) => {
    const isWeb = String(req.query.web ?? "") === "1";
    const state = JSON.stringify({ web: isWeb });
    const auth = passport.authenticate("google", {
        scope: ["profile", "email"],
        state,
        session: false,
    });
    return auth(req, res, next);
});

/**
 * Callback - unified handler for popup (web) and native deep link
 */
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/api/auth/failure" }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // user returned by passport verify callback (normalizeUser result)
            const user = (req as any).user as { id: string; email: string; name?: string } | undefined;
            if (!user) {
                console.warn('[oauth] callback: no user found on req.user');
                return res.redirect("/api/auth/failure");
            }

            // sign jwt
            const payload = { id: user.id, email: user.email } as Record<string, unknown>;
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES as jwt.SignOptions["expiresIn"] });

            // parse state to detect web popup flow
            let isWeb = false;
            try {
                const stateRaw = String((req.query.state ?? "") as string);
                if (stateRaw) {
                    const parsed = JSON.parse(stateRaw);
                    isWeb = Boolean(parsed?.web);
                }
            } catch (err) {
                isWeb = false;
            }

            if (isWeb) {
                // For web popup: respond with small HTML that posts message to opener and closes.
                // Also fall back to redirecting the popup to frontend success page (so clicking link still works).
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                return res.send(renderPopupResponse(token, FRONTEND_URL));
            }

            // Non-web (mobile/native) flow -> deep link redirect
            const appUrl = `${DEEP_LINK}?token=${encodeURIComponent(token)}`;
            return res.redirect(appUrl);
        } catch (err) {
            console.error('[oauth] callback error', err);
            return next(err);
        }
    }
);

router.get("/failure", (_req, res) => res.status(401).send("Authentication failed"));

export default router;

function renderPopupResponse(token: string, frontendUrl: string) {
    const safeToken = encodeURIComponent(token);
    const safeFrontend = String(frontendUrl).replace(/\/$/, "");
    const safeFrontendOrigin = getFrontendOrigin(frontendUrl); // origin-only


    return `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>Signing in...</title></head>
<body>
<script>
(function() {
  try {
    const token = decodeURIComponent("${safeToken}");
    const targetOrigin = "${safeFrontendOrigin}";
    // helper to try postMessage multiple times
    function tryPostMessage() {
      try {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          try {
            window.opener.postMessage({ type: 'oauth', token: token }, targetOrigin);
          } catch(e) {
            // ignore
          }
        }
      } catch(e) {
        // ignore
      }
    }

    // write fallback token to localStorage (so client can poll/catch it if message missed)
    try {
      try { localStorage.setItem('oauth_token', token); } catch(e) {}
    } catch(e) {}

    // attempt postMessage multiple times within first 700ms
    let attempts = 0;
    const maxAttempts = 6;
    const interval = setInterval(function() {
      attempts++;
      tryPostMessage();
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 100);

    // final attempt after a short delay then close
    setTimeout(function() {
      try { tryPostMessage(); } catch(_) {}
      // close the popup if possible
      try { window.close(); } catch(_) {}
      // as a fallback, navigate to frontend success page so user can manually click (and token is in URL)
      try { window.location = "${safeFrontend}/auth/success?token=" + "${safeToken}"; } catch(_) {}
    }, 600);
  } catch(e) {
    // fallback behaviour on error
    try { window.location = "${safeFrontend}/auth/success?token=" + "${safeToken}"; } catch(_) {}
  }
})();
</script>
<p>Signing you in... If this page doesn't close automatically, <a href="${safeFrontend}/auth/success?token=${safeToken}">click here</a>.</p>
</body>
</html>`;
}
