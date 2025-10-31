// src/Data/Model/messageModel.ts
import mongoose, { Document } from 'mongoose';

export interface IMessageDoc extends Document {
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  editedAt?: Date | null;
  deleted?: boolean;
}

const messageSchema = new mongoose.Schema<IMessageDoc>(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    editedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
  },
  { collection: 'messages' }
);

messageSchema.index({ senderId: 1, recipientId: 1, createdAt: 1 });

const MessageModel = mongoose.model<IMessageDoc>('Message', messageSchema);
export default MessageModel;
