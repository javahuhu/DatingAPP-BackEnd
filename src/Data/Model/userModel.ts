
import mongoose, { Document, Model } from 'mongoose';

export interface IUserDoc extends Document {
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;

  // new profile fields
  age?: number;
  bio?: string;
  profilePicture?: string;            
  profilePicturePublicId?: string;    
}

const userSchema = new mongoose.Schema<IUserDoc>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: false,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },

  // 🔽 New profile fields 🔽
  age: { type: Number, default: null },
  bio: { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  profilePicturePublicId: { type: String, default: '' }

}, { collection: 'users' });

const UserModel: Model<IUserDoc> = mongoose.model<IUserDoc>('User', userSchema);
export default UserModel;
