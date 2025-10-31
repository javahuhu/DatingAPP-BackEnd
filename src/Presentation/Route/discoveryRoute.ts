// src/Presentation/Route/discoveryRoute.ts
import express, { type Request, type Response } from 'express';
import authenticate from './authenticate.js';
import DiscoveryRepository from '../../Data/Repositories/discoveryRepositoryMongo.js';

const router = express.Router();
const repo = new DiscoveryRepository();

interface AuthRequest extends Request {
  user?: { id?: string } | any;
}

interface QueryFilters {
  minAge?: string;
  maxAge?: string;
  lat?: string;
  lon?: string;
  maxDistanceKm?: string;
  limit?: string;
  page?: string;
}

function parseNum(v?: string | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function isDev() {
  return (process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

// GET /api/discovery/profiles
router.get('/profiles', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) {
      console.warn('[discoveryRoute] unauthorized request - missing req.user.id');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // typed query parsing + validation
    const { minAge, maxAge, lat, lon, maxDistanceKm, limit, page } = req.query as unknown as QueryFilters;

    const parsed = {
      minAge: parseNum(minAge),
      maxAge: parseNum(maxAge),
      lat: parseNum(lat),
      lon: parseNum(lon),
      maxDistanceKm: parseNum(maxDistanceKm),
      limit: parseNum(limit) ?? 20,
      page: parseNum(page) ?? 0,
    };

    console.log('[discoveryRoute] incoming', {
      userId,
      parsed,
      headersPreview: typeof req.headers.authorization === 'string' ? (req.headers.authorization as string).slice(0, 60) : undefined,
    });

    // defensive: require lat/lon if your repo expects them (adjust as your policy)
    if (parsed.lat == null || parsed.lon == null) {
      // don't crash — return 400 with helpful message
      return res.status(400).json({
        success: false,
        error: 'lat and lon query parameters are required (e.g. ?lat=14.5995&lon=120.9842)',
      });
    }

    const profiles = await repo.fetchProfilesForViewer(userId, {
      minAge: parsed.minAge,
      maxAge: parsed.maxAge,
      lat: parsed.lat,
      lon: parsed.lon,
      maxDistanceKm: parsed.maxDistanceKm,
      limit: parsed.limit,
      page: parsed.page,
    });

    console.log(`[discoveryRoute] fetched ${Array.isArray(profiles) ? profiles.length : 'N/A'} profiles for user ${userId}`);
    return res.json({ success: true, profiles });
  } catch (err: any) {
    // Full error log for server console
    console.error('[discoveryRoute] GET /profiles error:', err && err.stack ? err.stack : err);

    const status = (err && err.http_code && Number(err.http_code)) ? Number(err.http_code) : 500;

    // In dev, return the message & stack to callers so curl & UI show details.
    if (isDev()) {
      return res.status(status).json({
        success: false,
        error: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      });
    }

    // In production, return a stable generic error
    return res.status(status).json({ success: false, error: 'Failed to fetch profiles' });
  }
});

// GET /api/discovery/likes/received
router.get('/likes/received', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const data = await repo.getLikesReceivedForUser(userId);
    return res.json({ success: true, likes: data });
  } catch (err: any) {
    console.error('[discoveryRoute] GET /likes/received', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Failed to fetch likes received' });
  }
});

// POST /api/discovery/:id/like
router.post('/:id/like', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const likerId = authReq.user?.id;
    const likedId = req.params.id;
    if (!likerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const result = await repo.like(likerId, likedId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[discoveryRoute] POST /:id/like', err && err.stack ? err.stack : err);
    const status = (err && err.http_code) ? err.http_code : 500;
    return res.status(status).json({ success: false, error: err && err.message ? err.message : 'Failed to like' });
  }
});

// POST /api/discovery/:id/skip
router.post('/:id/skip', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const viewerId = authReq.user?.id;
    const skipId = req.params.id;
    if (!viewerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    await repo.skip(viewerId, skipId);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[discoveryRoute] POST /:id/skip', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Failed to skip' });
  }
});

// GET /api/discovery/matches
router.get('/matches', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const data = await repo.getMatchesForUser(userId);
    return res.json({ success: true, matches: data });
  } catch (err: any) {
    console.error('[discoveryRoute] GET /matches', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Failed to fetch matches' });
  }
});


// POST /api/discovery/likes/decline/:id
router.post('/likes/decline/:id', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const currentUserId = authReq.user?.id;
    const likerId = req.params.id; // person who liked you
    if (!currentUserId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    await repo.declineReceivedLike(currentUserId, likerId);
    return res.json({ success: true, message: 'Like declined and removed' });
  } catch (err: any) {
    console.error('[discoveryRoute] POST /likes/decline/:id', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Failed to decline like' });
  }
});


export default router;
