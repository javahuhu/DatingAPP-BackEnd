import express from 'express';
import authenticate from './authenticate.js';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';

const router = express.Router();
const userRepo = new UserRepositoryMongo();

router.get('/', authenticate, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) return res.status(401).json({ message: 'Unauthorized' });

		const user = await userRepo.findById(userId);
		if (!user) return res.status(404).json({ message: 'Profile not found' });

		// Return commonly needed profile fields. Prefer a hosted URL if available.
		return res.json({
			name: user.name,
			age: user.age,
			bio: user.bio,
			profilePicture: (user as any).profilePictureUrl || (user as any).profilePicture || null,
			profilePicturePublicId: (user as any).profilePicturePublicId || null,
		});
	} catch (err: any) {
		console.error('[getexistprofile] error:', err);
		return res.status(500).json({ message: err?.message || 'Internal server error' });
	}
});

export default router;
