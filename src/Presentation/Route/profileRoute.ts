// src/Presentation/Route/profileRoute.ts
import * as jwt from 'jsonwebtoken';
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import authenticate from './authenticate.js';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';

dotenv.config();

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const userRepo = new UserRepositoryMongo();

// augment Request type to include user set by authenticate middleware
interface AuthRequest extends Request {
  user?: { id?: string } | any;
}

// Shape for incoming body
interface ProfileUpdateBody {
  name?: string;
  age?: number | string;
  bio?: string;
  personality?: string;
  motivation?: string;
  frustration?: string;
  tags?: string | string[]; // accept either JSON string or array
  gender?: string;
  lat?: number | string;
  lon?: number | string;
}

function safeNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (s.length === 0) return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

function safeGender(v: unknown): 'male' | 'female' | 'other' | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'male' || s === 'female' || s === 'other') return s as 'male' | 'female' | 'other';
  return undefined;
}

function parseTags(input?: string | string[]): string {
  // normalize to JSON string
  try {
    if (!input) return '[]';
    if (Array.isArray(input)) return JSON.stringify(input.map(String));
    const s = String(input).trim();
    if (s.length === 0) return '[]';

    // If looks like JSON array, return as-is (but ensure valid JSON)
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"') && s.endsWith('"'))) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return JSON.stringify(parsed.map((x) => String(x)));
      } catch (_) {
        // fallthrough to CSV parse
      }
    }

    // fallback: parse comma-separated values
    const items = s.split(',').map((x) => x.trim()).filter((x) => x.length > 0);
    return JSON.stringify(items);
  } catch (_) {
    return '[]';
  }
}

router.post('/', authenticate, upload.single('profilePicture'), async (req: AuthRequest, res: Response) => {
  try {
    console.log('[profileRoute] incoming request', { url: req.originalUrl, method: req.method });

    // prefer req.user set by authenticate middleware
    let userId: string | undefined = req.user?.id;
    console.log('[profileRoute] userId from middleware:', userId, 'typeof:', typeof userId);

    // fallback: verify Bearer token if middleware didn't set req.user
    if (!userId) {
      const authHeader = (req.headers.authorization as string) || (req.get('Authorization') || req.get('authorization')) || '';
      const match = String(authHeader).match(/Bearer\s+(.+)/i);
      const token = match ? match[1] : null;
      if (token) {
        try {
          const secret = process.env.JWT_SECRET || '';
          if (!secret) {
            console.warn('[profileRoute] JWT_SECRET not set; cannot verify token');
          } else {
            const decoded: any = jwt.verify(token, secret);
            userId = decoded?.id || decoded?.userId || decoded?.sub;
            if (userId) {
              req.user = { id: userId };
              console.log('[profileRoute] userId from token:', userId, 'typeof:', typeof userId);
            } else {
              console.warn('[profileRoute] token verified but no id/userId/sub claim found');
            }
          }
        } catch (verr) {
          console.warn('[profileRoute] token verification failed:', (verr as any)?.message || String(verr));
        }
      } else {
        console.log('[profileRoute] no Bearer token found in Authorization header');
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // check user exists BEFORE making updates
    const existingBefore = await userRepo.findById(userId);
    console.log('[profileRoute] existingBefore:', !!existingBefore, existingBefore ? { id: existingBefore.id } : null);
    if (!existingBefore) {
      return res.status(404).json({ success: false, error: 'User not found (before update)' });
    }

    // typed body
    const body = req.body as ProfileUpdateBody;
    const safeName = typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : undefined;
    const safeBio = typeof body.bio === 'string' && body.bio.trim().length > 0 ? body.bio.trim() : undefined;
    const safePersonality = typeof body.personality === 'string' && body.personality.trim().length > 0 ? body.personality.trim() : undefined;
    const safeMotivation = typeof body.motivation === 'string' && body.motivation.trim().length > 0 ? body.motivation.trim() : undefined;
    const safeFrustration = typeof body.frustration === 'string' && body.frustration.trim().length > 0 ? body.frustration.trim() : undefined;
    const safeTags = parseTags(body.tags);
    const safeGenderVal = safeGender(body.gender);
    const safeAge = safeNumber(body.age);
    const safeLat = safeNumber(body.lat);
    const safeLon = safeNumber(body.lon);

    console.log('[profileRoute] parsed fields ->', {
      safeName,
      safeAge,
      safeBio,
      safePersonality,
      safeMotivation,
      safeFrustration,
      safeTags,
      safeGenderVal,
      safeLat,
      safeLon,
    });

    if (req.file) {
      console.log('[profileRoute] req.file present:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } else {
      console.log('[profileRoute] req.file is null');
    }

    // If an image is provided, attempt to update image first (best-effort)
    if (req.file && req.file.buffer) {
      const buffer: Buffer = req.file.buffer as Buffer;
      const existingPublicId =
        typeof existingBefore?.profilePicturePublicId === 'string' && existingBefore.profilePicturePublicId.trim().length > 0
          ? existingBefore.profilePicturePublicId.trim()
          : undefined;

      console.log('[profileRoute] calling updateProfileImage, existing.profilePicturePublicId=', existingPublicId);
      try {
        await userRepo.updateProfileImage(userId, buffer, existingPublicId);
        console.log('[profileRoute] updateProfileImage finished');
      } catch (upErr) {
        console.error('[profileRoute] updateProfileImage error:', upErr);
        const isHtml = typeof (upErr as any)?.message === 'string' && /<\!DOCTYPE|<html/i.test((upErr as any).message);
        const status = (upErr as any)?.http_code || (isHtml ? 502 : 500);
        const safeMsg = isHtml ? 'Upstream image service returned an unexpected non-JSON response' : ((upErr as any)?.message || String(upErr));
        return res.status(status).json({ success: false, error: safeMsg });
      }
    }

    // Update other profile fields (partial update)
    const fieldsToUpdate: Record<string, unknown> = {};
    if (safeName !== undefined) fieldsToUpdate.name = safeName;
    if (safeAge !== undefined) fieldsToUpdate.age = safeAge;
    if (safeBio !== undefined) fieldsToUpdate.bio = safeBio;
    if (safePersonality !== undefined) fieldsToUpdate.personality = safePersonality;
    if (safeMotivation !== undefined) fieldsToUpdate.motivation = safeMotivation;
    if (safeFrustration !== undefined) fieldsToUpdate.frustration = safeFrustration;
    if (safeTags !== undefined) fieldsToUpdate.tags = safeTags; // store JSON string
    if (safeGenderVal !== undefined) fieldsToUpdate.gender = safeGenderVal;

    // location update if lat & lon provided (lon,lat order)
    if (typeof safeLat === 'number' && typeof safeLon === 'number') {
      fieldsToUpdate.location = {
        type: 'Point',
        coordinates: [safeLon, safeLat],
      };
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      try {
        await userRepo.updateProfileFields(userId, fieldsToUpdate);
      } catch (dbErr) {
        console.error('[profileRoute] updateProfileFields error:', dbErr);
        return res.status(500).json({ success: false, error: 'Failed to update profile fields' });
      }
    }

    const updated = await userRepo.findById(userId);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found after update' });

    return res.json({ success: true, user: updated });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('[profileRoute] unexpected error:', err.message, err);
      return res.status(500).json({ success: false, error: err.message });
    } else {
      console.error('[profileRoute] unexpected non-error thrown:', err);
      return res.status(500).json({ success: false, error: 'Unknown server error' });
    }
  }
});

export default router;
