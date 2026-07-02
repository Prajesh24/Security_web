import { z } from 'zod';

/**
 * Checkout payload. The client only sends product IDs and quantities — NEVER
 * prices. The server looks up the authoritative price for each product and
 * computes the total itself, so a tampered request cannot change what a user
 * is charged (price-tampering defense).
 */
export const CheckoutDTO = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id'),
        quantity: z
          .number({ invalid_type_error: 'Quantity must be a number' })
          .int()
          .positive()
          .max(99, 'Quantity per item is capped at 99'),
      }),
    )
    .min(1, 'Your cart is empty')
    .max(50, 'Too many items in one order'),
});
export type CheckoutDTO = z.infer<typeof CheckoutDTO>;
