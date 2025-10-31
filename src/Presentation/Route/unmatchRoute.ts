// src/Presentation/Route/unmatchRoute.ts
import express, { type Request, type Response } from 'express';
import authenticate from './authenticate.js';
import { MatchModel } from '../../Data/Model/discoveryModel.js';
import MessageModel from '../../Data/Model/messageModel.js';
import { Types } from 'mongoose';

const router = express.Router();

interface AuthRequest extends Request {
  user?: { id?: string } | any;
}

/**
 * POST /api/discovery/unmatch/:partnerId
 * Removes match between current user and partner. Optionally deletes messages.
 */
router.post('/unmatch/:partnerId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerId = req.params.partnerId;
    if (!partnerId) return res.status(400).json({ success: false, error: 'partnerId required' });

    const userObj = new Types.ObjectId(userId);
    const partnerObj = new Types.ObjectId(partnerId);

    // Delete the match record (matchSchema has unique canonical ordering)
    const removed = await MatchModel.findOneAndDelete({
      $or: [
        { userA: userObj, userB: partnerObj },
        { userA: partnerObj, userB: userObj },
      ],
    }).lean();

    // Optionally: remove messages between users (comment/uncomment as desired)
    await MessageModel.deleteMany({
      $or: [
        { senderId: userObj, recipientId: partnerObj },
        { senderId: partnerObj, recipientId: userObj }
      ]
    });

    return res.json({ success: true, removedMatch: !!removed });
  } catch (err: any) {
    console.error('[unmatch] POST error:', err);
    return res.status(500).json({ success: false, error: 'Failed to unmatch' });
  }
});

export default router;
