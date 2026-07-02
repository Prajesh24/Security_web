import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

// Every admin route requires a valid session AND the 'admin' role.
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/audit-logs', adminController.auditLogs);
router.get('/users', adminController.users);
router.get('/orders', adminController.orders);

export default router;
