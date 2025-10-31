import mongoose, { Document } from 'mongoose';

export interface ILikeDoc extends Document {
  likerId: mongoose.Types.ObjectId;
  likedId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new mongoose.Schema<ILikeDoc>(
  {
    likerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    likedId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'likes' }
);

likeSchema.index({ likerId: 1, likedId: 1 }, { unique: true });

export const LikeModel = mongoose.model<ILikeDoc>('Like', likeSchema);


export interface IMatchDoc extends Document {
  userA: mongoose.Types.ObjectId;
  userB: mongoose.Types.ObjectId;
  matchedAt: Date;
}

const matchSchema = new mongoose.Schema<IMatchDoc>(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    userB: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    matchedAt: { type: Date, default: Date.now },
  },
  { collection: 'matches' }
);

matchSchema.index({ userA: 1, userB: 1 }, { unique: true });

export const MatchModel = mongoose.model<IMatchDoc>('Match', matchSchema);


export interface ISeenDoc extends Document {
  viewerId: mongoose.Types.ObjectId;
  seenUserId: mongoose.Types.ObjectId;
  action: 'view' | 'like' | 'skip';
  createdAt: Date;
}

const seenSchema = new mongoose.Schema<ISeenDoc>(
  {
    viewerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    seenUserId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    action: { type: String, enum: ['view', 'like', 'skip'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'seen_profiles' }
);

seenSchema.index({ viewerId: 1, seenUserId: 1 }, { unique: true });

export const SeenModel = mongoose.model<ISeenDoc>('SeenProfile', seenSchema);
