// src/Presentation/Route/socialFacebookRoute.ts
import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';
import dotenv from 'dotenv';
dotenv.config();

const router = Router();
const repo = new UserRepositoryMongo();

// env / defaults - adapt if you store these elsewhere
const JWT_SECRET = (process.env.JWT_SECRET ?? 'changeme') as jwt.Secret;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? '1d';
const CALLBACK_BASE = process.env.OAUTH_CALLBACK_BASE ?? 'http://localhost:3000/api/auth';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const DEEP_LINK = process.env.FRONTEND_DEEP_LINK ?? process.env.MOBILE_DEEP_LINK ?? 'myapp://auth';

type StoredUser = { id: any; email: string; name: string; passwordHash: string; createdAt: Date };

function normalizeUser(doc: any): StoredUser | null {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const rawId = obj._id ?? obj.id;
  return {
    id: rawId?.toString?.() ?? rawId,
    email: obj.email,
    name: obj.name ?? '',
    passwordHash: obj.passwordHash ?? '',
    createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
  };
}

function getFrontendOrigin(frontendUrl: string): string {
  try {
    const url = new URL(frontendUrl);
    return url.origin;
  } catch (err) {
    return String(frontendUrl).replace(/\/$/, '');
  }
}

/**
 * Passport Facebook strategy
 *
 * profileFields: request email and public_profile (name / picture)
 */
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: `${CALLBACK_BASE}/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        console.log('[oauth][facebook] verify callback - profile:', {
          id: profile.id,
          displayName: profile.displayName,
          emails: profile.emails?.map((e: any) => e.value),
        });

        const email = profile.emails?.[0]?.value?.toLowerCase();
        if (!email) return done(new Error('No email provided by Facebook'), undefined);

        const found = await repo.findByEmail(email);
        console.log('[oauth][facebook] findByEmail result:', found);

        let user = normalizeUser(found);

        if (!user) {
          const persistence = {
            email,
            name:
              profile.displayName ??
              [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(' ') ??
              '',
            passwordHash: '',
            createdAt: new Date(),
          };
          console.log('[oauth][facebook] creating user with:', persistence);
          const saved = await repo.create(persistence);
          console.log('[oauth][facebook] create result:', saved);
          user = normalizeUser(saved);
        }

        if (!user) return done(new Error('Failed to create/find user'), undefined);
        return done(null, user as any);
      } catch (err) {
        console.error('[oauth][facebook] verify error', err);
        return done(err as Error);
      }
    }
  )
);

/**
 * Start Facebook OAuth flow
 * - For web popup, call /facebook?web=1
 */
router.get('/facebook', (req: Request, res: Response, next: NextFunction) => {
  const isWeb = String(req.query.web ?? '') === '1';
  const state = JSON.stringify({ web: isWeb });
  const auth = passport.authenticate('facebook', {
    scope: ['email', 'public_profile'],
    state,
    session: false,
  });
  return auth(req, res, next);
});

/**
 * Callback - unified for web popup and mobile deep link
 */
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/api/auth/failure' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as { id: string; email: string; name?: string } | undefined;
      if (!user) {
        console.warn('[oauth][facebook] callback: no user found on req.user');
        return res.redirect('/api/auth/failure');
      }

      // create JWT
      const payload = { id: user.id, email: user.email } as Record<string, unknown>;
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES as jwt.SignOptions['expiresIn'] });

      // parse state to detect web popup flow
      let isWeb = false;
      try {
        const stateRaw = String((req.query.state ?? '') as string);
        if (stateRaw) {
          const parsed = JSON.parse(stateRaw);
          isWeb = Boolean(parsed?.web);
        }
      } catch (err) {
        isWeb = false;
      }

      if (isWeb) {
        // Post token to opener and close popup. Also provide fallback redirect.
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderPopupResponse(token, FRONTEND_URL));
      }

      // Non-web: deep link to mobile app
      const appUrl = `${DEEP_LINK}?token=${encodeURIComponent(token)}`;
      return res.redirect(appUrl);
    } catch (err) {
      console.error('[oauth][facebook] callback error', err);
      return next(err);
    }
  }
);

router.get('/failure', (_req, res) => res.status(401).send('Authentication failed'));

export default router;

/**
 * HTML returned for popup flows — posts message to opener, stores fallback in localStorage,
 * then attempts to close. If closing fails, it navigates to frontend callback URL:
 *   <FRONTEND_URL>/auth/success?token=<token>
 *
 * Keep the path consistent with your frontend's AuthSuccessPage.
 */
function renderPopupResponse(token: string, frontendUrl: string) {
  const safeToken = encodeURIComponent(token);
  const safeFrontend = String(frontendUrl).replace(/\/$/, '');
  const safeFrontendOrigin = getFrontendOrigin(frontendUrl);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>Signing in...</title></head>
<body>
<script>
(function() {
  try {
    const token = decodeURIComponent("${safeToken}");
    const targetOrigin = "${safeFrontendOrigin}";

    function tryPostMessage() {
      try {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          try {
            window.opener.postMessage({ type: 'oauth', token: token }, targetOrigin);
          } catch(e) {}
        }
      } catch(e) {}
    }

    try { localStorage.setItem('oauth_token', token); } catch(e) {}

    let attempts = 0;
    const maxAttempts = 6;
    const interval = setInterval(function() {
      attempts++;
      tryPostMessage();
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 100);

    setTimeout(function() {
      try { tryPostMessage(); } catch(_) {}
      try { window.close(); } catch(_) {}
      try { window.location = "${safeFrontend}/auth/success?token=" + "${safeToken}"; } catch(_) {}
    }, 600);
  } catch(e) {
    try { window.location = "${safeFrontend}/auth/success?token=" + "${safeToken}"; } catch(_) {}
  }
})();
</script>
<p>Signing you in... If this page doesn't close automatically, <a href="${safeFrontend}/auth/success?token=${safeToken}">click here</a>.</p>
</body>
</html>`;
}


router.get("/privacy-policy", (_req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>Your privacy matters to us. We only use your Facebook or Google login info
    to authenticate you into Kismet Dating App. We do not share data with third parties.</p>
  `);
});

router.get("/delete-data", (_req, res) => {
  res.send(`
    <h1>Data Deletion Instructions</h1>
    <p>If you'd like to delete your account and all related data, 
    please email <b>kistmetforyou@gmail.com</b> with subject "Delete My Account".</p>
  `);
});
