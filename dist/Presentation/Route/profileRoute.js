import express from 'express';
import multer from 'multer';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';
import authenticate from './authenticate.js';
import dotenv from 'dotenv';
dotenv.config();
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
});
const userRepo = new UserRepositoryMongo();
router.post('/api/profile', authenticate, upload.single('profilePicture'), 
// use standard Request type here so Express typings match
async (req, res) => {
    try {
        // cast Request to AuthRequest to access req.user.id safely
        const authReq = req;
        const userId = authReq.user?.id;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const { name, age, bio } = req.body;
        // update text fields
        await userRepo.updateProfileFields(userId, {
            name,
            age: age ? Number(age) : undefined,
            bio,
        });
        // if file uploaded, handle upload & update
        if (req.file && req.file.buffer) {
            const existing = await userRepo.findById(userId);
            await userRepo.updateProfileImage(userId, req.file.buffer, existing?.profilePicturePublicId);
        }
        const updated = await userRepo.findById(userId);
        return res.json({ success: true, user: updated });
    }
    catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ success: false, error: err.message || String(err) });
    }
});
export default router;
