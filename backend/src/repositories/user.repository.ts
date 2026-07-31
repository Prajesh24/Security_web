import { UserModel, IUser } from '../models/user.model';
import { decryptUserPII } from '../utils/pii';

export class UserRepository {
  create(data: Partial<IUser>): Promise<IUser> {
    return UserModel.create(data);
  }

  // `email` is always a validated, sanitized string (never an object), so this
  // equality query cannot be turned into a NoSQL operator injection.
  async findByEmail(email: string): Promise<IUser | null> {
    return decryptUserPII(await UserModel.findOne({ email }).exec());
  }

  async findById(id: string): Promise<IUser | null> {
    return decryptUserPII(await UserModel.findById(id).exec());
  }

  // Look up an OAuth account by its immutable provider subject id.
  async findByOAuth(provider: string, oauthId: string): Promise<IUser | null> {
    return decryptUserPII(
      await UserModel.findOne({ authProvider: provider, oauthId }).exec(),
    );
  }

  // Look up by the stored single-use magic-token hash (passwordless login).
  async findByMagicTokenHash(tokenHash: string): Promise<IUser | null> {
    return decryptUserPII(await UserModel.findOne({ magicTokenHash: tokenHash }).exec());
  }

  async updateById(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return decryptUserPII(
      await UserModel.findByIdAndUpdate(id, data, { new: true }).exec(),
    );
  }

  /**
   * Sets an explicit map of (dot-notated) fields. Callers build this map from a
   * validated allowlist, so it is safe against mass assignment. runValidators
   * enforces schema constraints (e.g. currency enum) on update. PII fields in
   * the set map are already encrypted by the caller (see UserService).
   */
  async updateFields(id: string, set: Record<string, unknown>): Promise<IUser | null> {
    return decryptUserPII(
      await UserModel.findByIdAndUpdate(
        id,
        { $set: set },
        { new: true, runValidators: true },
      ).exec(),
    );
  }

  // Look up the owner of a passkey by its credential id, for a usernameless
  // login ceremony where the browser identifies the credential, not the user.
  async findByCredentialId(credentialId: string): Promise<IUser | null> {
    return decryptUserPII(
      await UserModel.findOne({ 'webauthnCredentials.credentialId': credentialId }).exec(),
    );
  }

  async findAll(): Promise<IUser[]> {
    const users = await UserModel.find().sort({ createdAt: -1 }).exec();
    return users.map((u) => decryptUserPII(u));
  }
}
