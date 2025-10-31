import mongoose, { Document, Model } from 'mongoose';

export interface IUserDoc extends Document {
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;

  // profile fields
  age?: number;
  bio?: string;
  profilePicture?: string;
  profilePicturePublicId?: string;

  // new optional fields
  personality?: string;
  motivation?: string;
  frustration?: string;

  // tags (legacy JSON string)
  tags?: string;

  // 🆕 gender field
  gender?: 'male' | 'female' | 'other';

  // GeoJSON location field
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  } | null;
}

const userSchema = new mongoose.Schema<IUserDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },

    // 🔽 Profile fields 🔽
    age: { type: Number, default: null },
    bio: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    profilePicturePublicId: { type: String, default: '' },

    // 🔽 New main profile fields 🔽
    personality: { type: String, default: '' },
    motivation: { type: String, default: '' },
    frustration: { type: String, default: '' },
    tags: { type: String, default: '[]' },

    // 🆕 Gender field
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'other',
    },

    // GeoJSON location
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [120.9842, 14.5995], // Manila default
      },
    },
  },
  { collection: 'users' }
);

// Enable $geoNear queries
userSchema.index({ location: '2dsphere' });

const UserModel: Model<IUserDoc> = mongoose.model<IUserDoc>('User', userSchema);
export default UserModel;
