import { UserRepository } from '../repositories/user.repository';
import { OrderRepository } from '../repositories/order.repository';
import { UpdateProfileDTO, ProfileImportDTO } from '../dtos/profile.dto';
import { IUser } from '../models/user.model';
import { HttpError } from '../errors/http-error';

const userRepository = new UserRepository();
const orderRepository = new OrderRepository();

export class UserService {
  getById(id: string): Promise<IUser | null> {
    return userRepository.findById(id);
  }

  /**
   * Applies a validated profile patch. The `$set` map is built ONLY from keys
   * present in the parsed, allowlisted DTO and flattened to dot paths so that
   * nested updates never replace (and wipe) sibling fields. There is no way for
   * a caller to reach `role`, `password`, etc. through this method.
   */
  async updateProfile(id: string, dto: UpdateProfileDTO): Promise<IUser> {
    const set: Record<string, unknown> = {};

    if (dto.displayName !== undefined) set['profile.displayName'] = dto.displayName;
    if (dto.bio !== undefined) set['profile.bio'] = dto.bio;
    if (dto.phone !== undefined) set['profile.phone'] = dto.phone;

    if (dto.address) {
      for (const [k, v] of Object.entries(dto.address)) {
        if (v !== undefined) set[`profile.address.${k}`] = v;
      }
    }
    if (dto.preferences) {
      for (const [k, v] of Object.entries(dto.preferences)) {
        if (v !== undefined) set[`profile.preferences.${k}`] = v;
      }
    }

    if (Object.keys(set).length === 0) {
      throw new HttpError(400, 'No profile fields to update.');
    }

    const updated = await userRepository.updateFields(id, set);
    if (!updated) throw new HttpError(404, 'User not found.');
    return updated;
  }

  /**
   * Data portability (privacy): assembles a machine-readable copy of everything
   * we hold about the user. Sensitive material — the password hash, MFA secret,
   * lockout internals — is deliberately excluded (the model's toJSON strips
   * them), honouring data-minimisation.
   */
  async exportData(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new HttpError(404, 'User not found.');
    const orders = await orderRepository.findByUser(id);

    return {
      exportedAt: new Date().toISOString(),
      schema: 'gadgethub.userdata.v1',
      account: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      profile: user.profile,
      orders: orders.map((o) => o.toJSON()),
    };
  }

  /** Re-applies profile fields from an uploaded export. Only the profile is honoured. */
  async importData(id: string, payload: ProfileImportDTO): Promise<IUser> {
    return this.updateProfile(id, payload.profile);
  }
}

export const userService = new UserService();
