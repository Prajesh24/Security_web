'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../lib/api';
import {
  CartLine,
  getCart,
  setQuantity,
  removeFromCart,
  clearCart,
} from '../../lib/cart';

export default function CartPage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => setLines(getCart()), []);

  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  function updateQty(id: string, qty: number) {
    setQuantity(id, qty);
    setLines(getCart());
  }
  function remove(id: string) {
    removeFromCart(id);
    setLines(getCart());
  }

  async function checkout() {
    setError('');
    setSuccess('');
    setLoading(true);
    // Send ONLY ids + quantities. The server computes the authoritative total.
    const res = await apiPost('/api/orders/checkout', {
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    });
    setLoading(false);
    if (res.ok) {
      clearCart();
      setLines([]);
      setSuccess(
        `Order placed! Total charged: NPR ${res.data.order.total.toLocaleString()}.`,
      );
    } else if (res.status === 401) {
      router.push('/login?next=/cart');
    } else {
      setError(res.data?.message || 'Checkout failed.');
    }
  }

  return (
    <div className="container">
      <h1>Your Cart</h1>
      {lines.length === 0 ? (
        <div className="card">
          <p className="muted">
            {success ? success : 'Your cart is empty.'}{' '}
            <a href="/">Continue shopping →</a>
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
              disabled={loading}
              onClick={checkout}
            >
              {loading ? 'Placing…' : 'Checkout'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            The final price is calculated on the server from live product data —
            the amounts shown here are for display only.
          </p>
          {error && <div className="alert alert-error">{error}</div>}
        </div>
      )}
      {success && lines.length > 0 && (
        <div className="alert alert-success">{success}</div>
      )}
    </div>
  );
}
