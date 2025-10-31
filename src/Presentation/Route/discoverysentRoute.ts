// src/Presentation/Route/discoverySentRoute.ts
import express, { type Request, type Response } from 'express';
import authenticate from './authenticate.js';
import { LikeModel } from '../../Data/Model/discoveryModel.js';
import UserModel from '../../Data/Model/userModel.js';
import { Types } from 'mongoose';

const router = express.Router();

interface AuthRequest extends Request {
  user?: { id?: string } | any;
}

// GET /api/discovery/sent
// Returns list of users this user has liked (pending). If there is already a match it will still appear,
// but you can detect a match via the Match collection on the client via /api/discovery/matches if you need.
router.get('/sent', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const likerObj = new Types.ObjectId(userId);
    // get likes created by this user
    const likes = await LikeModel.find({ likerId: likerObj }).lean();

    // collect liked user ids
    const likedIds = likes.map((l: any) => l.likedId).filter(Boolean);
    if (likedIds.length === 0) {
      return res.json({ success: true, items: [] });
    }

    // fetch user profiles
    const users = await UserModel.find({ _id: { $in: likedIds } }, {
      name: 1, age: 1, bio: 1, profilePicture: 1, profilePicturePublicId: 1, personality: 1, tags: 1
    }).lean();

    // return in same order as likes (optional)
    const ordered = likedIds.map((id: any) => {
      const u = users.find((x: any) => String(x._id) === String(id));
      return u || null;
    }).filter(Boolean);

    return res.json({ success: true, items: ordered });
  } catch (err: any) {
    console.error('[discoverySent] GET /sent error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch sent likes' });
  }
});

export default router;
