/**
 * Seeds the database with a demo admin, a customer, and a product catalogue so
 * the store and its security features can be demonstrated immediately.
 *
 *   npm run seed
 *
 * Demo credentials (passwords meet the strong-password policy):
 *   admin@gadgethub.test  / Admin@123   (can manage products, view audit log)
 *   alice@gadgethub.test  / Alice@123   (regular shopper)
 */
import mongoose from 'mongoose';

import { connectDatabase } from './database/mongodb';
import { UserModel } from './models/user.model';
import { ProductModel } from './models/product.model';
import { OrderModel } from './models/order.model';
import { AuditLogModel } from './models/auditLog.model';
import { hashPassword } from './utils/password';
import { encrypt } from './utils/crypto';

const products = [
  { name: 'Aurora Wireless Earbuds', description: 'ANC true-wireless earbuds with 30h battery.', price: 5200, category: 'Audio', stock: 40, imageUrl: '' },
  { name: 'ClickMaster Mechanical Keyboard', description: 'Hot-swappable 75% keyboard, RGB backlight.', price: 8900, category: 'Accessories', stock: 25, imageUrl: '' },
  { name: 'Nimbus 27" 4K Monitor', description: 'IPS 4K UHD monitor with USB-C 90W.', price: 42000, category: 'Displays', stock: 12, imageUrl: '' },
  { name: 'Pulse Smartwatch 2', description: 'AMOLED smartwatch with SpO2 and GPS.', price: 15500, category: 'Wearables', stock: 30, imageUrl: '' },
  { name: 'Volt 20000mAh Power Bank', description: 'Fast-charging 65W USB-C power bank.', price: 3400, category: 'Power', stock: 60, imageUrl: '' },
  { name: 'Orbit Wireless Mouse', description: 'Ergonomic silent mouse, 4000 DPI.', price: 2100, category: 'Accessories', stock: 55, imageUrl: '' },
  { name: 'SoundWave Bluetooth Speaker', description: 'IP67 waterproof portable speaker.', price: 6300, category: 'Audio', stock: 20, imageUrl: '' },
  { name: 'Vision 1080p Webcam', description: 'Auto-focus webcam with dual mics.', price: 4100, category: 'Accessories', stock: 35, imageUrl: '' },
];

async function seed() {
  await connectDatabase();

  await Promise.all([
    UserModel.deleteMany({}),
    ProductModel.deleteMany({}),
    OrderModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);

  const people = [
    { fullName: 'Store Admin', email: 'admin@gadgethub.test', password: 'Admin@123', role: 'admin' as const },
    { fullName: 'Alice Sharma', email: 'alice@gadgethub.test', password: 'Alice@123', role: 'customer' as const },
  ];
  for (const p of people) {
    await UserModel.create({
      fullName: p.fullName,
      email: p.email,
      password: await hashPassword(p.password),
      role: p.role,
      authProvider: 'local',
      // Demonstrate PII-at-rest encryption: the shopper's phone + address are
      // stored AES-256-GCM encrypted (verify with a raw find() in mongosh).
      ...(p.role === 'customer'
        ? {
            profile: {
              phone: encrypt('+9779812345678'),
              address: {
                line1: encrypt('12 Durbar Marg'),
                city: encrypt('Kathmandu'),
                postcode: encrypt('44600'),
                country: encrypt('Nepal'),
              },
            },
          }
        : {}),
    });
    console.log(`${p.role}: ${p.email} / ${p.password}`);
  }

  await ProductModel.insertMany(products);
  console.log(`${products.length} products added`);

  await mongoose.connection.close();
  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
