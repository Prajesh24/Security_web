'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { CartLine, getCart, setQuantity, removeFromCart } from '../../lib/cart';

export default function CartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => setLines(getCart()), []);

  // The cart is a protected area — bounce anonymous visitors to sign in.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=/cart');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  }

  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  function updateQty(id: string, qty: number) {
    setQuantity(id, qty);
    setLines(getCart());
  }
  function remove(id: string) {
    removeFromCart(id);
    setLines(getCart());
  }

  return (
    <div className="container">
      <h1>Your Cart</h1>
      {lines.length === 0 ? (
        <div className="card">
          <p className="muted">
            Your cart is empty. <a href="/">Continue shopping →</a>
          </p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Qty</th>
                <th className="right">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td>{l.name}</td>
                  <td>NPR {l.price.toLocaleString()}</td>
                  <td>
                    <input
                      className="qty-input"
                      type="number"
                      min={1}
                      max={99}
                      value={l.quantity}
                      onChange={(e) =>
                        updateQty(l.productId, Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="right">
                    NPR {(l.price * l.quantity).toLocaleString()}
                  </td>
                  <td className="right">
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => remove(l.productId)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="summary-bar">
            <span className="price">Total: NPR {total.toLocaleString()}</span>
            <button
              className="btn-primary"
              style={{ width: 'auto' }}
              onClick={() => router.push('/checkout')}
            >
              Proceed to Checkout
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            The final price is calculated on the server from live product data —
            the amounts shown here are for display only.
          </p>
        </div>
      )}
    </div>
  );
}
