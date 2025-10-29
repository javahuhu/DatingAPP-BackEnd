import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
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
const UserModel = mongoose.model('User', userSchema);
export default UserModel;
