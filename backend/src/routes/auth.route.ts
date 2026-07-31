import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { mfaController } from '../controllers/mfa.controller';
import { webauthnController } from '../controllers/webauthn.controller';
import { authLimiter } from '../middleware/rateLimit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { csrfProtection } from '../middleware/csrf.middleware';
import { requireCaptcha } from '../middleware/captcha.middleware';

const router = Router();

// Public CAPTCHA challenge (the SPA fetches one before register/login).
router.get('/captcha', authController.captcha);

// Credential endpoints: strict rate limiting + CAPTCHA (layered brute-force /
// bot defense).
router.post('/register', authLimiter, requireCaptcha, authController.register);
router.post('/login', authLimiter, requireCaptcha, authController.login);
// Second-factor verification is also rate limited — this is what stops a
// 6-digit TOTP code from being brute forced.
router.post('/mfa/verify-login', authLimiter, authController.verifyMfaLogin);
// Passwordless (magic-link) login — rate limited like other credential routes.
router.post('/magic/request', authLimiter, authController.magicRequest);
router.post('/magic/verify', authLimiter, authController.magicVerify);
router.post('/logout', authController.logout);
router.get('/csrf', authController.csrf);

// ── OAuth 2.0 (Google) ───────────────────────────────────────────────────────
// Which providers are configured (SPA uses this to decide whether to show the
// "Continue with Google" button).
router.get('/providers', authController.providers);
// Start the flow (rate limited like other credential entry points) and the
// callback Google redirects back to.
router.get('/oauth/google', authLimiter, authController.oauthGoogleStart);
router.get('/oauth/google/callback', authController.oauthGoogleCallback);

// ── MFA management (authenticated + CSRF-protected) ──────────────────────────
router.post('/mfa/setup', authMiddleware, csrfProtection, mfaController.setup);
router.post('/mfa/enable', authMiddleware, csrfProtection, mfaController.enable);
router.post('/mfa/disable', authMiddleware, csrfProtection, mfaController.disable);

// ── WebAuthn / passkeys ────────────────────────────────────────────────────
// Registration manages the signed-in user's own account (authenticated + CSRF).
router.get('/webauthn/credentials', authMiddleware, webauthnController.listCredentials);
router.post(
  '/webauthn/register/options',
  authMiddleware,
  csrfProtection,
  webauthnController.registerOptions,
);
router.post(
  '/webauthn/register/verify',
  authMiddleware,
  csrfProtection,
  webauthnController.registerVerify,
);
router.delete(
  '/webauthn/credentials/:credentialId',
  authMiddleware,
  csrfProtection,
  webauthnController.removeCredential,
);
// Login is public but rate limited like every other credential entry point.
router.post('/webauthn/login/options', authLimiter, webauthnController.loginOptions);
router.post('/webauthn/login/verify', authLimiter, webauthnController.loginVerify);

export default router;
