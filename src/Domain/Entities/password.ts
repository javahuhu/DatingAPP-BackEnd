import { ValidationError } from "./error.js";


export default class password {
    public readonly value: string;

    constructor(plain: string) {

        if (!password.isValid(plain)) {
            throw new ValidationError('Password must be at least 6 characters long');
        }

        this.value = plain;
        Object.freeze(this)
    }

    static isValid(plain?: string | null) {
        if (!plain || typeof plain != 'string') return false;

        return plain.length >= 6;

    }

    toString(): string {
        return this.value
    }

}