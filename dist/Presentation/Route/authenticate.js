import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET)
    throw new Error('JWT_SECRET missing in .env');
// Implement middleware as a RequestHandler so Express's types are satisfied.
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const userId = payload.id || payload._id;
        if (!userId) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }
        // Cast req to AuthRequest only for assignment
        req.user = { id: String(userId) };
        next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
export default authenticate;
