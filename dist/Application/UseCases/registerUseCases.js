// src/Application/UseCases/registerUser.ts
import User from "../../Domain/Entities/users.js";
import passwordHasher from "../../Infrastracture/passwordHasher.js";
export default async function registerUser(input, deps) {
    const { userRepository } = deps;
    // Validate/create domain user (will throw ValidationError if invalid)
    const userDomain = User.createFrom({ name: input.name, email: input.email, password: input.password });
    // Check duplicate
    const existing = await userRepository.findByEmail(userDomain.email.toString());
    if (existing) {
        const err = new Error('Email already registered');
        // optional status property for controllers
        // @ts-ignore
        err.status = 409;
        throw err;
    }
    const hash = await (deps.passwordHasher ?? passwordHasher).hash(userDomain.password.toString());
    const persistence = {
        email: userDomain.email.toString(),
        name: userDomain.name,
        passwordHash: hash,
        createdAt: userDomain.createdAt
    };
    const saved = await userRepository.save(persistence);
    return saved;
}
