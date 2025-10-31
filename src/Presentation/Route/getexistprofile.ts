// src/Presentation/Route/getexistprofile.ts
import express, {type  Request, type Response } from 'express';
import authenticate from './authenticate.js';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';

const router = express.Router();
const userRepo = new UserRepositoryMongo();

function hasToObject(x: unknown): x is { toObject: () => any } {
  return !!x && typeof (x as any).toObject === 'function';
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await userRepo.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const userObj = hasToObject(user) ? (user as any).toObject() : user;

    // Remove sensitive fields if present
    if ((userObj as any).passwordHash) {
      delete (userObj as any).passwordHash;
    }

    return res.json({
      success: true,
      user: {
        id: userObj._id?.toString?.() || userObj.id,
        email: userObj.email,
        name: userObj.name,
        age: userObj.age,
        bio: userObj.bio,
        profilePicture:
          (userObj as any).profilePictureUrl ||
          (userObj as any).profilePicture ||
          null,
        profilePicturePublicId: (userObj as any).profilePicturePublicId || null,
        personality: userObj.personality ?? '',
        motivation: userObj.motivation ?? '',
        frustration: userObj.frustration ?? '',
        tags: userObj.tags ?? '[]', // ADD THIS LINE - ensure tags are included
        createdAt: userObj.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error('[getexistprofile] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ success: false, message });
  }
});

export default router;