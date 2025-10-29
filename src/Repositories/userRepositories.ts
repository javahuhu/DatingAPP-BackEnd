// src/Repositories/userRepositories.ts
export type UserPersistence = {
  id?: string;
  email: string;
  // optional when creating/updating social accounts
  name?: string;
  // optional because social accounts may not have local password
  passwordHash?: string;
  createdAt?: Date;
};

export default interface UserRepository {
  /**
   * Save a user persistence object (create or update).
   * Returns the saved minimal public record (id, email, name, createdAt).
   */
  save(user: UserPersistence): Promise<{
    id: string;
    email: string;
    name: string;        // implementation will ensure this is always a string
    createdAt: Date;
  }>;

  findByEmail(email: string): Promise<UserPersistence | null>;
  findById(id: string): Promise<UserPersistence | null>;
}
