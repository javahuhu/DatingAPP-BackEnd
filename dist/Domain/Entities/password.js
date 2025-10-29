import { ValidationError } from "./error";
export default class password {
    constructor(plain) {
        if (!password.isValid(plain)) {
            throw new ValidationError('Password must be at least 6 characters long');
        }
        this.value = plain;
        Object.freeze(this);
    }
    static isValid(plain) {
        if (!plain || typeof plain != 'string')
            return false;
        return plain.length >= 6;
    }
    toString() {
        return this.value;
    }
}
