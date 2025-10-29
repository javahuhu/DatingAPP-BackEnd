// src/Domain/Entities/errors.ts
export class DomainError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DomainError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ValidationError extends DomainError {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
