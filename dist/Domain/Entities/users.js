// src/Domain/Entities/User.ts
import Email from './email';
import Password from './password';
import { ValidationError } from './error';
/**
 * Domain-level User entity (immutable).
 * Note: password stored here is the domain Password VO (plain). Hashing belongs to infra.
 */
export default class User {
    constructor({ id = null, email, name, password, createdAt = new Date() }) {
        // normalize/validate VOs if given as primitive
        this.email = typeof email === 'string' ? new Email(email) : email;
        this.password = typeof password === 'string' ? new Password(password) : password;
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Name is required');
        }
        this.id = id ?? null;
        this.name = name.trim();
        this.createdAt = createdAt ?? new Date();
        Object.freeze(this);
    }
    // returns a new User with updated email
    changeEmail(newEmail) {
        const emailVO = typeof newEmail === 'string' ? new Email(newEmail) : newEmail;
        return new User({
            id: this.id,
            email: emailVO,
            name: this.name,
            password: this.password,
            createdAt: this.createdAt
        });
    }
    // returns a new User with updated name
    rename(newName) {
        if (!newName || typeof newName !== 'string') {
            throw new ValidationError('Name is required');
        }
        return new User({
            id: this.id,
            email: this.email,
            name: newName.trim(),
            password: this.password,
            createdAt: this.createdAt
        });
    }
    toPlainObject() {
        return {
            id: this.id,
            name: this.name,
            email: this.email.toString(),
            createdAt: this.createdAt
        };
    }
    static createFrom(dto) {
        const { id = null, email, name, password, createdAt } = dto;
        return new User({
            id,
            email,
            name,
            password,
            createdAt
        });
    }
}
