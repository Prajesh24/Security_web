import { z } from 'zod';

// Admin-only product create/update payloads. Validated so malformed or
// malicious input never reaches the database.
export const CreateProductDTO = z.object({
  name: z.string().min(2, 'Name is too short').max(120).trim(),
  description: z.string().max(1000).optional().default(''),
  price: z
    .number({ invalid_type_error: 'Price must be a number' })
    .int('Price must be a whole number')
    .min(0, 'Price cannot be negative')
    .max(10_000_000),
  category: z.string().max(60).optional().default('General'),
  imageUrl: z.string().url('Image URL must be valid').or(z.literal('')).optional().default(''),
  stock: z
    .number({ invalid_type_error: 'Stock must be a number' })
    .int()
    .min(0, 'Stock cannot be negative')
    .max(1_000_000),
});
export type CreateProductDTO = z.infer<typeof CreateProductDTO>;

export const UpdateProductDTO = CreateProductDTO.partial();
export type UpdateProductDTO = z.infer<typeof UpdateProductDTO>;
