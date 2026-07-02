import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { csrfProtection } from '../middleware/csrf.middleware';

const router = Router();

// ── Public: anyone can browse the catalogue ──────────────────────────────────
router.get('/', productController.list);
router.get('/:id', productController.detail);

// ── Admin only: create / update / delete (auth + RBAC + CSRF) ────────────────
router.post('/', authMiddleware, requireRole('admin'), csrfProtection, productController.create);
router.put('/:id', authMiddleware, requireRole('admin'), csrfProtection, productController.update);
router.delete('/:id', authMiddleware, requireRole('admin'), csrfProtection, productController.remove);

export default router;
