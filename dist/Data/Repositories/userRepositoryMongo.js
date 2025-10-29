import UserModel from '../Model/userModel.js';
import cloudinary from '../../Infrastracture/cloudinary.js';
export default class UserRepositoryMongo {
    async create(user) {
        const doc = {
            email: user.email,
            name: user.name,
            passwordHash: user.passwordHash ?? '',
            createdAt: user.createdAt ?? new Date()
        };
        const created = await UserModel.create(doc);
        return created.toObject ? created.toObject() : created;
    }
    async updateName(id, name) {
        return UserModel.findByIdAndUpdate(id, { name }, { new: true }).lean();
    }
    async save(user) {
        const passwordHash = user.passwordHash ?? '';
        const doc = new UserModel({
            email: user.email,
            name: user.name ?? '',
            passwordHash,
            createdAt: user.createdAt ?? new Date(),
        });
        const saved = await doc.save();
        return {
            id: saved.id.toString(),
            email: saved.email,
            name: saved.name,
            createdAt: saved.createdAt,
        };
    }
    async findByEmail(email) {
        const doc = await UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
        if (!doc)
            return null;
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
        };
    }
    async findById(id) {
        const doc = await UserModel.findById(id).exec();
        if (!doc)
            return null;
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
        };
    }
    // 🆕 Update user profile fields (no image upload)
    async updateProfileFields(id, data) {
        const update = {};
        if (data.name !== undefined)
            update.name = data.name;
        if (data.age !== undefined)
            update.age = data.age;
        if (data.bio !== undefined)
            update.bio = data.bio;
        const updated = await UserModel.findByIdAndUpdate(id, update, { new: true }).lean();
        return updated;
    }
    // 🆕 Update profile with Cloudinary image upload results
    async updateProfileImage(id, imageBuffer, oldPublicId) {
        // destroy old Cloudinary image if exists
        if (oldPublicId) {
            try {
                await cloudinary.uploader.destroy(oldPublicId);
            }
            catch (e) {
                console.warn('Failed to delete old Cloudinary image:', e);
            }
        }
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'datingapp/profiles',
                resource_type: 'image',
                overwrite: true,
            }, (error, result) => (error ? reject(error) : resolve(result)));
            stream.end(imageBuffer);
        });
        const updated = await UserModel.findByIdAndUpdate(id, {
            profilePicture: uploadResult.secure_url,
            profilePicturePublicId: uploadResult.public_id,
        }, { new: true }).lean();
        return updated;
    }
}
