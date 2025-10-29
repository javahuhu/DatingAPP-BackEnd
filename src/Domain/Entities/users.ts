// src/Domain/Entities/User.ts
import Email from './email.js';
import Password from './password.js';
import { ValidationError } from './error.js';
import email from './email.js';
import password from './password.js';

export type UserId = string | null;

export interface IUserPlain {
  id?: UserId;
  name: string;
  email: string;        // plain string allowed for DTOs
  password: string;     // plain password string for creation (will be hashed in infra)
  createdAt?: Date;
}


export default class User {
  public readonly id: UserId;
  public readonly name: string;
  public readonly email: email;
  public readonly password: password;
  public readonly createdAt: Date;

  constructor({
    id = null,
    email,
    name,
    password,
    createdAt = new Date()
  }: {
    id?: UserId;
    email: email | string;
    name: string;
    password: password | string;
    createdAt?: Date;
  }) {
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
  changeEmail(newEmail: email | string): User {
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
  rename(newName: string): User {
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

  toPlainObject(): Omit<IUserPlain, 'password'> & { id: UserId; email: string; createdAt: Date } {
    return {
      id: this.id,
      name: this.name,
      email: this.email.toString(),
      createdAt: this.createdAt
    };
  }

  static createFrom(dto: IUserPlain): User {
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
