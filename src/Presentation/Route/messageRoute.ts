// src/Presentation/Route/messagesRoute.ts
import express, { type Request, type Response } from 'express';
import authenticate from './authenticate.js';
import MessageModel from '../../Data/Model/messageModel.js';
import { Types } from 'mongoose';
import { MatchModel } from '../../Data/Model/discoveryModel.js';

const router = express.Router();

interface AuthRequest extends Request {
  user?: { id?: string } | any;
}


router.get('/:partnerId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerId = req.params.partnerId;
    if (!partnerId) return res.status(400).json({ success: false, error: 'partnerId required' });

    const uObj = new Types.ObjectId(userId);
    const pObj = new Types.ObjectId(partnerId);

    const messages = await MessageModel.find({
      $or: [
        { senderId: uObj, recipientId: pObj },
        { senderId: pObj, recipientId: uObj }
      ],
      deleted: { $ne: true }
    }).sort({ createdAt: 1 }).lean();

    return res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[messages] GET error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});



router.post('/:partnerId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const partnerId = req.params.partnerId;
    if (!partnerId) return res.status(400).json({ success: false, error: 'partnerId required' });

    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const message = await MessageModel.create({
      senderId: new Types.ObjectId(userId),
      recipientId: new Types.ObjectId(partnerId),
      text: text.trim(),
    });

    // Optionally: return the created message as plain object
    return res.status(201).json({ success: true, message: message.toObject() });
  } catch (err: any) {
    console.error('[messages] POST error:', err);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

export default router;
