import { ValidationError } from "./error";
export default class email {
    constructor(address) {
        if (!email.isValid(address)) {
            throw new ValidationError("Invalid email address");
        }
        this.value = address.trim().toLowerCase();
        Object.freeze(this);
    }
    static isValid(address) {
        if (!address || typeof address != 'string')
            return false;
        const trimmed = address.trim();
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(trimmed);
    }
    toString() {
        return this.value;
    }
}
