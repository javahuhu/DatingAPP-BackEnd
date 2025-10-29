// src/Presentation/Route/auth.ts
import { Router } from 'express';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo';
import passwordHasher from '../../Infrastracture/passwordHasher';
import jwt from 'jsonwebtoken';
const router = Router();
const userRepository = new UserRepositoryMongo();
// typed constants for ts
const JWT_SECRET = (process.env.JWT_SECRET ?? 'changeme');
const JWT_EXPIRES = (process.env.JWT_EXPIRES_IN ?? '1d');
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body ?? {};
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required' });
        }
        const user = await userRepository.findByEmail(String(email).toLowerCase().trim());
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // If account has no local password (social account), reject password login
        if (!user.passwordHash) {
            return res.status(403).json({
                success: false,
                message: 'Account was created via social login or magic link. Use social login or set a password.'
            });
        }
        const isMatch = await passwordHasher.compare(String(password), user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const payload = { id: user.id, email: user.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: { id: user.id, email: user.email, name: user.name },
            token,
        });
    }
    catch (err) {
        console.error('Login error', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
export default router;
