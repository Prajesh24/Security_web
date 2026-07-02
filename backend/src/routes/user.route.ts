import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { csrfProtection } from '../middleware/csrf.middleware';

const router = Router();

// Every user route requires an authenticated session.
router.use(authMiddleware);

router.get('/me', userController.me);
// State-changing → CSRF protected. Identity is taken from the session only.
router.patch('/me', csrfProtection, userController.updateProfile);

// Password change (re-authentication + reuse prevention in the service).
router.post('/me/password', csrfProtection, userController.changePassword);

// Privacy: export a copy of my data / re-import my profile.
router.get('/me/export', userController.exportData);
router.post('/me/import', csrfProtection, userController.importData);

export default router;
