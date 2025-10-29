import { ValidationError } from "./error.js";


export default class email {
    public readonly value: string;

    constructor(address: string){
        if(!email.isValid(address)){
            throw new ValidationError("Invalid email address")
        }

        this.value = address.trim().toLowerCase();
        Object.freeze(this);
    }

    static isValid(address: string | null): boolean {
        if(!address || typeof address != 'string') return false;
        const trimmed = address.trim();

        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(trimmed);
    }

    toString(): string {
        return this.value
    }
}