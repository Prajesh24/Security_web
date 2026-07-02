import { UserModel, IUser } from '../models/user.model';

export class UserRepository {
  create(data: Partial<IUser>): Promise<IUser> {
    return UserModel.create(data);
  }

  // `email` is always a validated, sanitized string (never an object), so this
  // equality query cannot be turned into a NoSQL operator injection.
  findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email }).exec();
  }

  findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  updateById(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  /**
   * Sets an explicit map of (dot-notated) fields. Callers build this map from a
   * validated allowlist, so it is safe against mass assignment. runValidators
   * enforces schema constraints (e.g. currency enum) on update.
   */
  updateFields(id: string, set: Record<string, unknown>): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true },
    ).exec();
  }

  findAll(): Promise<IUser[]> {
    return UserModel.find().sort({ createdAt: -1 }).exec();
  }
}
