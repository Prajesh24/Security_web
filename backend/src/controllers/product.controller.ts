import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { CreateProductDTO, UpdateProductDTO } from '../dtos/product.dto';
import { HttpError } from '../errors/http-error';

export class ProductController {
  // Public
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const products = await productService.list();
      res.status(200).json({ success: true, products });
    } catch (err) {
      next(err);
    }
  }

  // Public
  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.get(req.params.id);
      res.status(200).json({ success: true, product });
    } catch (err) {
      next(err);
    }
  }

  // Admin only
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Authentication required.');
      const parsed = CreateProductDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input.');
      }
      const product = await productService.create(req, req.user.id, parsed.data);
      res.status(201).json({ success: true, product });
    } catch (err) {
      next(err);
    }
  }

  // Admin only
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Authentication required.');
      const parsed = UpdateProductDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input.');
      }
      const product = await productService.update(
        req,
        req.user.id,
        req.params.id,
        parsed.data,
      );
      res.status(200).json({ success: true, product });
    } catch (err) {
      next(err);
    }
  }

  // Admin only
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Authentication required.');
      await productService.remove(req, req.user.id, req.params.id);
      res.status(200).json({ success: true, message: 'Product deleted' });
    } catch (err) {
      next(err);
    }
  }
}

export const productController = new ProductController();
