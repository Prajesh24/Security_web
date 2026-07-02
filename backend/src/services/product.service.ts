import { Request } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import { CreateProductDTO, UpdateProductDTO } from '../dtos/product.dto';
import { HttpError } from '../errors/http-error';
import { auditService } from './audit.service';

const productRepository = new ProductRepository();

export class ProductService {
  list() {
    return productRepository.findAll();
  }

  async get(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new HttpError(404, 'Product not found.');
    return product;
  }

  // Admin-only. Audited so product-catalogue changes are traceable.
  async create(req: Request, userId: string, dto: CreateProductDTO) {
    const product = await productRepository.create(dto);
    await auditService.log(req, {
      event: 'PRODUCT_CREATE',
      userId,
      success: true,
      detail: `created "${product.name}"`,
    });
    return product;
  }

  async update(req: Request, userId: string, id: string, dto: UpdateProductDTO) {
    const product = await productRepository.updateById(id, dto);
    if (!product) throw new HttpError(404, 'Product not found.');
    await auditService.log(req, {
      event: 'PRODUCT_UPDATE',
      userId,
      success: true,
      detail: `updated ${id}`,
    });
    return product;
  }

  async remove(req: Request, userId: string, id: string) {
    const product = await productRepository.deleteById(id);
    if (!product) throw new HttpError(404, 'Product not found.');
    await auditService.log(req, {
      event: 'PRODUCT_DELETE',
      userId,
      success: true,
      detail: `deleted "${product.name}"`,
    });
  }
}

export const productService = new ProductService();
