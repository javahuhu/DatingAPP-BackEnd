// src/Data/Repositories/userRepositoryMongo.ts
import { Types } from 'mongoose';
import UserModel from '../Model/userModel.js';
import type { IUserDoc } from '../Model/userModel.js';
import type UserRepository from '../../Repositories/userRepositories.js';
import type { UserPersistence } from '../../Repositories/userRepositories.js';
import cloudinary from '../../Infrastracture/cloudinary.js';

export default class UserRepositoryMongo implements UserRepository {

  async create(user: { email: string; name: string; passwordHash?: string; createdAt?: Date }) {
    const doc = {
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash ?? '',
      createdAt: user.createdAt ?? new Date()
    };
    const created = await UserModel.create(doc);
    return created.toObject ? created.toObject() : created;
  }

  async updateName(id: string, name: string) {
    return UserModel.findByIdAndUpdate(id, { name }, { new: true }).lean();
  }

  async save(user: UserPersistence) {
    const passwordHash = user.passwordHash ?? '';

    const doc = new UserModel({
      email: user.email,
      name: user.name ?? '',
      passwordHash,
      createdAt: user.createdAt ?? new Date(),
    });

    const saved: IUserDoc = await doc.save();

    return {
      id: saved.id.toString(),
      email: saved.email,
      name: saved.name,
      createdAt: saved.createdAt,
    };
  }

  async findByEmail(email: string) {
    const doc = await UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
    if (!doc) return null;

    return {
      id: doc.id.toString(),
      email: doc.email,
      name: doc.name,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt,
      bio: doc.bio,
      age: doc.age,
      profilePicture: doc.profilePicture,
      profilePicturePublicId: doc.profilePicturePublicId,
      // new fields
      personality: doc.personality,
      motivation: doc.motivation,
      frustration: doc.frustration,
      tags: doc.tags, // ADD THIS LINE
    };
  }

  async findById(id: string) {
    const doc = await UserModel.findById(id).exec();
    if (!doc) return null;

    return {
      id: doc.id.toString(),
      email: doc.email,
      name: doc.name,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt,
      bio: doc.bio,
      age: doc.age,
      profilePicture: doc.profilePicture,
      profilePicturePublicId: doc.profilePicturePublicId,
      // new fields
      personality: doc.personality,
      motivation: doc.motivation,
      frustration: doc.frustration,
      tags: doc.tags, // ADD THIS LINE
    };
  }

  /**
   * Update user profile fields (no image upload).
   * Accepts optional values and only sets fields that are explicitly provided.
   */
  async updateProfileFields(id: string, data: {
    name?: string;
    age?: number;
    bio?: string;
    personality?: string;
    motivation?: string;
    frustration?: string;
    tags?: string; // ADD THIS LINE
  }) {
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.age !== undefined) update.age = data.age;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.personality !== undefined) update.personality = data.personality;
    if (data.motivation !== undefined) update.motivation = data.motivation;
    if (data.frustration !== undefined) update.frustration = data.frustration;
    if (data.tags !== undefined) update.tags = data.tags; // ADD THIS LINE

    // only proceed if there is something to update
    if (Object.keys(update).length === 0) {
      const current = await UserModel.findById(id).lean();
      return current;
    }

    const updated = await UserModel.findByIdAndUpdate(id, update, { new: true }).lean();
    return updated;
  }

  // ✅ Improved: Update profile image with strong Cloudinary error handling and logging
  async updateProfileImage(
    id: string,
    imageBuffer: Buffer,
    oldPublicId?: string
  ) {
    // Defensive: ensure we have a valid buffer
    if (!imageBuffer || !(imageBuffer instanceof Buffer)) {
      throw new Error('Invalid image buffer provided to updateProfileImage');
    }

    // Try deleting old Cloudinary image (non-fatal)
    if (oldPublicId) {
      try {
        await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
      } catch (err: any) {
        console.warn('[UserRepositoryMongo] ⚠️ Failed to delete old Cloudinary image (ignored):', err?.message || err);
      }
    }

    // Upload new image via Cloudinary
    let uploadResult: any;
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const opts = {
          folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'datingapp/profiles',
          resource_type: 'image' as const,
          overwrite: true,
        };

        const stream = cloudinary.uploader.upload_stream(opts, (error, result) => {
          if (error) {
            console.error('[UserRepositoryMongo] ❌ Cloudinary upload error:', error);
            if ((error as any).response) {
              console.error('[UserRepositoryMongo] 🔍 Cloudinary raw error body:', (error as any).response.body ?? (error as any).response);
            }
            return reject(error);
          }
          resolve(result);
        });

        stream.end(imageBuffer);
      });
    } catch (err: any) {
      console.error('[UserRepositoryMongo] 🚨 Cloudinary upload failed:', err?.message ?? err);
      if ((err as any).response?.body) {
        console.error('[UserRepositoryMongo] 📄 Cloudinary upstream response:', (err as any).response.body);
      }

      const error = new Error(`Upstream image service error: ${err?.message || 'unknown error'}`);
      (error as any).upstream = (err as any).response?.body;
      throw error;
    }

    // Validate result
    if (!uploadResult || !uploadResult.secure_url) {
      console.error('[UserRepositoryMongo] ⚠️ Unexpected Cloudinary result:', uploadResult);
      throw new Error('Cloudinary returned unexpected upload result');
    }

    // Update MongoDB document
    const updated = await UserModel.findByIdAndUpdate(
      id,
      {
        profilePicture: uploadResult.secure_url,
        profilePicturePublicId: uploadResult.public_id,
      },
      { new: true }
    ).lean();

    console.log('[UserRepositoryMongo] ✅ Uploaded image URL:', uploadResult.secure_url);
    return updated;
  }
}