import mongoose, { Document, Schema } from 'mongoose';

// A single registered FIDO2/WebAuthn credential (a passkey, security key, or
// platform authenticator such as Touch ID/Face ID/Windows Hello).
export interface IWebAuthnCredential {
  credentialId: string; // base64url — the credential's public identifier
  publicKey: string; // base64 — the COSE public key, used to verify signatures
  counter: number; // signature counter; a non-increasing value signals a cloned credential
  transports: string[]; // 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'
  deviceName: string; // user-chosen label, e.g. "MacBook Touch ID"
  createdAt: Date;
}

export interface IUserProfile {
  displayName: string;
  bio: string;
  phone: string;
  address: {
    line1: string;
    city: string;
    postcode: string;
    country: string;
  };
  preferences: {
    currency: 'NPR' | 'USD' | 'EUR' | 'GBP';
    marketingEmails: boolean;
  };
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  password?: string; // bcrypt hash — never plaintext; absent for OAuth accounts
  role: 'customer' | 'admin';
  // Federated identity (OAuth 2.0). 'local' = password/magic-link account.
  authProvider: 'local' | 'google';
  oauthId: string | null; // provider subject id (e.g. Google `sub`)
  // User-editable, non-privileged personalisation data.
  profile: IUserProfile;
  // Brute-force protection / account lockout state:
  failedLoginAttempts: number;
  lockUntil: Date | null;
  lastLoginAt: Date | null;
  // Multi-factor authentication (TOTP). The secret is stored AES-256-GCM
  // encrypted; mfaPendingSecret holds an unconfirmed secret during enrolment.
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaPendingSecret: string | null;
  // Password lifecycle: when it was last set, and hashes of recent passwords
  // (for reuse prevention). History never contains plaintext.
  passwordChangedAt: Date;
  passwordHistory: string[];
  // Passwordless (magic-link) login: a single-use token hash + its expiry.
  magicTokenHash: string | null;
  magicTokenExpires: Date | null;
  // WebAuthn/passkeys: registered credentials, and a short-lived challenge
  // bound to the user during an in-progress registration or login ceremony.
  webauthnCredentials: IWebAuthnCredential[];
  currentChallenge: string | null;
  currentChallengeExpires: Date | null;
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
    // Local accounts must have a password hash; OAuth accounts never do.
    password: {
      type: String,
      required: function (this: IUser) {
        return this.authProvider === 'local';
      },
    },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    oauthId: { type: String, default: null, index: true },
    profile: {
      displayName: { type: String, default: '', trim: true },
      bio: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      address: {
        line1: { type: String, default: '', trim: true },
        city: { type: String, default: '', trim: true },
        postcode: { type: String, default: '', trim: true },
        country: { type: String, default: '', trim: true },
      },
      preferences: {
        currency: { type: String, enum: ['NPR', 'USD', 'EUR', 'GBP'], default: 'NPR' },
        marketingEmails: { type: Boolean, default: false },
      },
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, default: null },
    mfaPendingSecret: { type: String, default: null },
    passwordChangedAt: { type: Date, default: Date.now },
    passwordHistory: { type: [String], default: [] },
    magicTokenHash: { type: String, default: null },
    magicTokenExpires: { type: Date, default: null },
    webauthnCredentials: {
      type: [
        {
          credentialId: { type: String, required: true },
          publicKey: { type: String, required: true },
          counter: { type: Number, required: true, default: 0 },
          transports: { type: [String], default: [] },
          deviceName: { type: String, default: 'Passkey' },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    currentChallenge: { type: String, default: null },
    currentChallengeExpires: { type: Date, default: null },
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
    delete ret.passwordHistory;
    delete ret.magicTokenHash;
    delete ret.magicTokenExpires;
    delete ret.oauthId;
    delete ret.currentChallenge;
    delete ret.currentChallengeExpires;
    // Never expose raw credential material (public key, credential id); the
    // account page gets a minimal summary via a dedicated endpoint instead.
    delete ret.webauthnCredentials;
    delete ret.__v;
    // Expose only whether MFA is on, never the secret material.
    return ret;
  },
});

export const UserModel = mongoose.model<IUser>('User', userSchema);
