'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import { addToCart } from '../lib/cart';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
}

const CATEGORY_ICON: Record<string, string> = {
  Audio: '🎧',
  Accessories: '⌨️',
  Displays: '🖥️',
  Wearables: '⌚',
  Power: '🔋',
  General: '📦',
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState('');

  useEffect(() => {
    apiGet<{ products: Product[] }>('/api/products').then((res) => {
      setProducts(res.data.products || []);
      setLoading(false);
    });
  }, []);

  function add(p: Product) {
    addToCart({ productId: p._id, name: p.name, price: p.price });
    setAdded(p._id);
    setTimeout(() => setAdded(''), 1200);
  }

  return (
    <div className="container">
      <section className="hero">
        <span className="hero-tag">🔒 Secure by design</span>
        <h1>Premium gadgets, delivered securely.</h1>
        <p>
          Browse curated electronics and check out with confidence. Every action
          on GadgetHub is protected by modern web-security controls — from
          hashed credentials and CSRF protection to server-side pricing.
        </p>
      </section>

      <div className="section-head">
        <h2>Featured products</h2>
        <span className="muted">{products.length} items</span>
      </div>

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <div className="product-card" key={p._id}>
              <div className="thumb">{CATEGORY_ICON[p.category] || '📦'}</div>
              <div className="product-body">
                <span className="badge">{p.category}</span>
                <h3>{p.name}</h3>
                <p className="muted">{p.description}</p>
                <div className="price-row">
                  <span className="price">NPR {p.price.toLocaleString()}</span>
                  <span className={p.stock > 0 ? 'stock-ok' : 'stock-out'}>
                    {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                  </span>
                </div>
                <button
                  className="btn-primary"
                  disabled={p.stock <= 0}
                  onClick={() => add(p)}
                >
                  {added === p._id ? '✓ Added to cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
