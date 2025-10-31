// src/Presentation/Route/matchCheckRoute.ts
import express, { type Request, type Response } from 'express';
import authenticate from './authenticate.js';
import { MatchModel } from '../../Data/Model/discoveryModel.js';
import { Types } from 'mongoose';

const router = express.Router();

interface AuthRequest extends Request {
  user?: { id?: string } | any;
}

router.get('/isMatched/:partnerId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerId = req.params.partnerId;
    if (!partnerId) return res.status(400).json({ success: false, error: 'partnerId required' });

    const a = new Types.ObjectId(userId);
    const b = new Types.ObjectId(partnerId);

   
    const found = await MatchModel.findOne({
      $or: [
        { userA: a, userB: b },
        { userA: b, userB: a },
      ],
    }).lean();

    return res.json({ success: true, matched: !!found });
  } catch (err: any) {
    console.error('[isMatched] error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
