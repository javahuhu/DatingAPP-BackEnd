// src/Infrastracture/passwordHasher.ts
import bcrypt from 'bcrypt';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
export default {
    async hash(plain) {
        if (!plain || typeof plain !== 'string') {
            throw new Error('Invalid password');
        }
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        return bcrypt.hash(plain, salt);
    },
    async compare(plain, hashed) {
        if (!plain || !hashed)
            return false;
        return bcrypt.compare(plain, hashed);
    }
};
