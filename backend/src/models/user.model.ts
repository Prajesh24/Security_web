import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  password: string; // bcrypt hash — never plaintext
  role: 'customer' | 'admin';
  // Brute-force protection / account lockout state:
  failedLoginAttempts: number;
  lockUntil: Date | null;
  lastLoginAt: Date | null;
  // Multi-factor authentication (TOTP). The secret is stored AES-256-GCM
  // encrypted; mfaPendingSecret holds an unconfirmed secret during enrolment.
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaPendingSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, default: null },
    mfaPendingSecret: { type: String, default: null },
  },
  { timestamps: true },
);

// Never leak the password hash, lockout internals, or MFA secrets in JSON.
userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, any>) => {
    delete ret.password;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.mfaSecret;
    delete ret.mfaPendingSecret;
    delete ret.__v;
    // Expose only whether MFA is on, never the secret material.
    return ret;
  },
});

export const UserModel = mongoose.model<IUser>('User', userSchema);
