import crypto from 'crypto';

import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} from '../config';
import { UserRepository } from '../repositories/user.repository';
import { IUser } from '../models/user.model';
import { HttpError } from '../errors/http-error';

const userRepository = new UserRepository();

// Fixed Google endpoints. These are constants (never user-controlled), so there
// is no SSRF surface here.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

export class OAuthService {
  /** A cryptographically-random `state` value for CSRF protection of the flow. */
  createState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /** Builds the Google consent URL the browser is redirected to. */
  buildGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** Exchanges the one-time auth code for tokens, then loads the user profile. */
  private async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) throw new HttpError(401, 'Google sign-in failed.');
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new HttpError(401, 'Google sign-in failed.');

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!infoRes.ok) throw new HttpError(401, 'Google sign-in failed.');
    return (await infoRes.json()) as GoogleProfile;
  }

  /**
   * Completes the flow: resolves the Google identity to a local user account,
   * creating one on first sign-in and linking to an existing same-email account.
   */
  async loginWithGoogle(code: string): Promise<IUser> {
    const profile = await this.fetchGoogleProfile(code);
    if (!profile.email || !profile.email_verified) {
      throw new HttpError(401, 'Your Google email must be verified to sign in.');
    }
    const email = profile.email.toLowerCase().trim();

    // 1) Already linked to this Google identity.
    const byOAuth = await userRepository.findByOAuth('google', profile.sub);
    if (byOAuth) return byOAuth;

    // 2) A local account with the same email — link Google to it.
    const byEmail = await userRepository.findByEmail(email);
    if (byEmail) {
      const linked = await userRepository.updateById(byEmail._id.toString(), {
        authProvider: byEmail.authProvider === 'local' ? byEmail.authProvider : 'google',
        oauthId: profile.sub,
      });
      return linked ?? byEmail;
    }

    // 3) First-time federated sign-in — provision a passwordless account.
    return userRepository.create({
      fullName: profile.name || email.split('@')[0],
      email,
      role: 'customer',
      authProvider: 'google',
      oauthId: profile.sub,
    });
  }
}

export const oauthService = new OAuthService();
