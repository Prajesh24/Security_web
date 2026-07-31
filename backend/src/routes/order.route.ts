import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { csrfProtection } from '../middleware/csrf.middleware';
import { paymentLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// All order routes require authentication.
router.use(authMiddleware);

// Checkout is state-changing (also carries a payment charge) → CSRF token
// required, plus a dedicated limiter against card-testing attempts.
router.post('/checkout', paymentLimiter, csrfProtection, orderController.checkout);
router.get('/me', orderController.myOrders);

export default router;
