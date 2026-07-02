import dotenv from 'dotenv';

dotenv.config();

export const PORT: number = parseInt(process.env.PORT || '6060', 10);
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const IS_PROD: boolean = NODE_ENV === 'production';
export const CLIENT_URL: string = process.env.CLIENT_URL || 'http://localhost:3000';

export const MONGODB_URI: string =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/gadgethub';

export const JWT_SECRET: string =
  process.env.JWT_SECRET || 'change_me_to_a_long_random_secret_in_production';
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m';

export const MAX_LOGIN_ATTEMPTS: number = parseInt(
  process.env.MAX_LOGIN_ATTEMPTS || '5',
  10,
);
export const LOCK_MINUTES: number = parseInt(process.env.LOCK_MINUTES || '15', 10);
export const BCRYPT_ROUNDS: number = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// Fail fast in production if the JWT secret was left at its default.
if (IS_PROD && JWT_SECRET.startsWith('change_me')) {
  throw new Error('JWT_SECRET must be set to a strong random value in production.');
}
