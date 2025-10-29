// src/Presentation/Middleware/authenticate.ts
import {type Request, type Response, type NextFunction,type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error('JWT_SECRET missing in .env');

// Export the AuthRequest shape for usage in handlers when needed
export interface AuthRequest extends Request {
  user?: { id: string };
}

// Implement middleware as a RequestHandler so Express's types are satisfied.
export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string; _id?: string };
    const userId = payload.id || payload._id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    // Cast req to AuthRequest only for assignment
    (req as AuthRequest).user = { id: String(userId) };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export default authenticate;
