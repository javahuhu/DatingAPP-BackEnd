// src/Presentation/Route/magicAuth.ts
import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';
import passwordHasher from '../../Infrastracture/passwordHasher.js';

const router = Router();
const repo = new UserRepositoryMongo();

// typed secrets (TS friendly)
const JWT_SECRET = (process.env.JWT_SECRET ?? 'changeme') as jwt.Secret;
const MAGIC_EXPIRES = (process.env.MAGIC_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'];
const LOGIN_EXPIRES = (process.env.JWT_EXPIRES_IN ?? '1d') as jwt.SignOptions['expiresIn'];

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const MOBILE_DEEP_LINK = process.env.MOBILE_DEEP_LINK ?? 'myapp://auth';

// configure transporter (defensive)
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? 'no-reply@example.com';

const transporter =
  smtpHost && !Number.isNaN(smtpPort)
    ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })
    : null;

/**
 * POST /api/auth/magic-request
 */
router.post('/magic-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    const normalized = email.trim().toLowerCase();

    const payload = { email: normalized, type: 'magic' } as Record<string, unknown>;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: MAGIC_EXPIRES as jwt.SignOptions['expiresIn'] });

    const link = `${FRONTEND_URL}/auth/magic?token=${encodeURIComponent(token)}`;

    const mailOptions = {
      from: smtpFrom,
      to: normalized,
      subject: 'Your sign-in link',
      html: `
        <p>Click the link below to sign in. This link expires in ${String(MAGIC_EXPIRES)}.</p>
        <p><a href="${link}">Open sign-in link</a></p>
        <p>If your app supports deep links, open the app after clicking the link.</p>
      `,
    };

    if (transporter) {
      // send mail but don't block the response if it fails
      transporter.sendMail(mailOptions).catch((err) => {
        console.error('Magic-sendMail error:', err);
      });
    } else {
      console.warn('SMTP transporter not configured — skipping sending email.');
    }

    // Always respond success to avoid leaking registered emails
    return res.json({ success: true, message: 'If that email exists you will receive a sign-in link' });
  } catch (err) {
    console.error('magic-request error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/auth/magic?token=...
 * Used by browser to finalize magic link (redirects to deep link)
 */
router.get('/magic', async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token ?? '');
    if (!token) return res.status(400).send('Missing token');

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (err) {
      console.error('magic verify failed', err);
      return res.status(400).send('Invalid or expired link');
    }

    if (decoded?.type !== 'magic' || !decoded?.email) {
      return res.status(400).send('Invalid token payload');
    }

    const email = String(decoded.email).toLowerCase().trim();

    let user = await repo.findByEmail(email);
    if (!user) {
      const persistence = {
        email,
        name: '',
        passwordHash: '', // blank because passwordless
        createdAt: new Date(),
      };
      let user = await repo.findByEmail(email);
      if (!user) {
        const persistence = {
          email,
          name: '',
          passwordHash: '', // blank because passwordless
          createdAt: new Date(),
        };
        // create the user
        await repo.save(persistence);
        // re-fetch the full user document (ensures all fields are present)
        user = await repo.findByEmail(email);
      }

    }

    if (!user || !user.id) {
      console.error('Failed to ensure user exists for magic link', user);
      return res.status(500).send('Internal server error');
    }

    const loginPayload = { id: user.id, email: user.email } as Record<string, unknown>;
    const loginToken = jwt.sign(loginPayload, JWT_SECRET, { expiresIn: LOGIN_EXPIRES as jwt.SignOptions['expiresIn'] });

    const appUrl = `${MOBILE_DEEP_LINK}?token=${encodeURIComponent(loginToken)}`;

    // Redirect to deep link (for mobile) — for web you may instead redirect to frontend success
    return res.redirect(appUrl);
  } catch (err) {
    console.error('magic GET error', err);
    return res.status(500).send('Internal server error');
  }
});

/**
 * POST /api/auth/magic-verify
 * Exchange magic token for login token (useful for mobile apps)
 */
router.post('/magic-verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body ?? {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    if (decoded?.type !== 'magic' || !decoded?.email) {
      return res.status(400).json({ success: false, message: 'Invalid token payload' });
    }

    const email = String(decoded.email).toLowerCase().trim();
    let user = await repo.findByEmail(email);
    if (!user) {
      const persistence = {
        email,
        name: '',
        passwordHash: '',
        createdAt: new Date(),
      };
      let user = await repo.findByEmail(email);
      if (!user) {
        const persistence = {
          email,
          name: '',
          passwordHash: '', // blank because passwordless
          createdAt: new Date(),
        };
        // create the user
        await repo.save(persistence);
        // re-fetch the full user document (ensures all fields are present)
        user = await repo.findByEmail(email);
      }

    }

    if (!user || !user.id) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    const loginPayload = { id: user.id, email: user.email } as Record<string, unknown>;
    const loginToken = jwt.sign(loginPayload, JWT_SECRET, { expiresIn: LOGIN_EXPIRES as jwt.SignOptions['expiresIn'] });

    return res.json({ success: true, token: loginToken, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('magic-verify error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
