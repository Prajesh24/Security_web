import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { csrfProtection } from '../middleware/csrf.middleware';

const router = Router();

// All order routes require authentication.
router.use(authMiddleware);

// Checkout is state-changing → also requires a valid CSRF token.
router.post('/checkout', csrfProtection, orderController.checkout);
router.get('/me', orderController.myOrders);

export default router;
