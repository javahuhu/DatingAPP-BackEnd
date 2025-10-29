// src/Presentation/Route/profileRoute.ts
import * as jwt from 'jsonwebtoken';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import authenticate from './authenticate.js';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';
import cloudinary from '../../Infrastracture/cloudinary.js';

dotenv.config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });
const userRepo = new UserRepositoryMongo();


router.post('/', authenticate, (req, res) => {

    upload.single('profilePicture')(req, res, async (uploadErr: any) => {
        if (uploadErr) {
            console.warn('[profileRoute] multer error:', uploadErr.message || uploadErr);
            return res.status(400).json({ success: false, error: uploadErr.message || 'File upload error' });
        }

        try {
            console.log('[profileRoute] incoming request', { url: req.originalUrl, method: req.method });

            // try to use req.user from authenticate middleware first
            let userId = (req as any).user?.id;
            console.log('[profileRoute] userId from middleware:', userId, 'typeof:', typeof userId);

            // Fallback: verify Bearer token if middleware didn't set req.user
            if (!userId) {
                const authHeader = (req.headers.authorization as string) || (req.get('Authorization') || req.get('authorization')) || '';
                const match = String(authHeader).match(/Bearer\s+(.+)/i);
                const token = match ? match[1] : null;
                if (token) {
                    try {
                        const secret = process.env.JWT_SECRET || '';
                        if (!secret) {
                            console.warn('[profileRoute] JWT_SECRET not set; cannot verify token');
                        } else {
                            const decoded: any = jwt.verify(token, secret);
                            userId = decoded?.id || decoded?.userId || decoded?.sub;
                            if (userId) {
                                (req as any).user = { id: userId };
                                console.log('[profileRoute] userId from token:', userId, 'typeof:', typeof userId);
                            } else {
                                console.warn('[profileRoute] token verified but no id/userId/sub claim found');
                            }
                        }
                    } catch (verr) {
                        console.warn('[profileRoute] token verification failed:', (verr as any).message || String(verr));
                    }
                } else {
                    console.log('[profileRoute] no Bearer token found in Authorization header');
                }
            }

            if (!userId) return res.status(401).json({ message: 'Unauthorized' });

            // check user exists BEFORE making updates - clearer failure reason
            const existingBefore = await userRepo.findById(userId);
            console.log('[profileRoute] existingBefore:', !!existingBefore, existingBefore ? { id: existingBefore.id, profilePicturePublicId: existingBefore.profilePicturePublicId } : null);
            if (!existingBefore) {
                return res.status(404).json({ success: false, error: 'User not found (before update)' });
            }

            const { name, age, bio } = req.body;
            console.log('[profileRoute] fields ->', { name, age, bio });

            if (req.file) {
                console.log('[profileRoute] req.file present:', {
                    fieldname: req.file.fieldname,
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                });
            } else {
                console.log('[profileRoute] req.file is null');
            }

            await userRepo.updateProfileFields(userId, { name, age: age ? Number(age) : undefined, bio });

            if (req.file && (req as any).file.buffer) {
                const buffer = (req as any).file.buffer;
                // Only pass a non-empty string public id to the repo to avoid upstream 404s due to invalid ids
                const existingPublicId = typeof existingBefore?.profilePicturePublicId === 'string' && existingBefore.profilePicturePublicId.trim().length > 0
                    ? existingBefore.profilePicturePublicId.trim()
                    : undefined;

                console.log('[profileRoute] calling updateProfileImage, existing.profilePicturePublicId=', existingPublicId);
                try {
                    await userRepo.updateProfileImage(userId, buffer, existingPublicId);
                    console.log('[profileRoute] updateProfileImage finished');
                } catch (upErr: any) {
                    console.error('[profileRoute] updateProfileImage error:', upErr);
                    // Detect HTML / non-JSON responses from upstream services (common when a service returns an HTML error page)
                    const isHtml = typeof upErr?.message === 'string' && /<\!DOCTYPE|<html/i.test(upErr.message);
                    const status = upErr?.http_code || (isHtml ? 502 : 500);
                    const safeMsg = isHtml ? 'Upstream image service returned an unexpected non-JSON response' : (upErr?.message || String(upErr));
                    // Return sanitized error to client (avoid leaking HTML)
                    return res.status(status).json({ success: false, error: safeMsg });
                }
            }

            const updated = await userRepo.findById(userId);
            if (!updated) return res.status(404).json({ success: false, error: 'User not found after update' });

            return res.json({ success: true, user: updated });
        } catch (err: any) {
            console.error('profileRoute error:', err);
            return res.status(500).json({ success: false, error: err.message || String(err) });
        }
    });
});



export default router;
