'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CartLine, getCart, clearCart } from '../../lib/cart';
import {
  CardInput,
  CardValidationError,
  validateCard,
  tokenize,
  newIdempotencyKey,
} from '../../lib/payment';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [card, setCard] = useState<CardInput>({ number: '', expiry: '', cvc: '', name: '' });
  const [fieldErrors, setFieldErrors] = useState<CardValidationError[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  // A fresh idempotency key per checkout attempt-session, so a retried
  // network request never double-charges — but a full resubmit after a
  // decline gets a new one, since that's a genuinely new attempt.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  useEffect(() => setLines(getCart()), []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=/checkout');
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

  function fieldError(field: CardValidationError['field']) {
    return fieldErrors.find((e) => e.field === field)?.message;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const errs = validateCard(card);
    setFieldErrors(errs);
    if (errs.length > 0) return;

    setLoading(true);
    // Card number/expiry/CVC are consumed here and never sent to the API —
    // only the resulting token, which the server cannot reverse into a PAN.
    const token = tokenize(card);
    const res = await apiPost('/api/orders/checkout', {
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      payment: { token, idempotencyKey },
    });
    setLoading(false);

    if (res.ok) {
      clearCart();
      setLines([]);
      setCard({ number: '', expiry: '', cvc: '', name: '' });
      setSuccess(
        `Payment approved — order placed! Total charged: NPR ${res.data.order.total.toLocaleString()}.`,
      );
    } else if (res.status === 401) {
      router.push('/login?next=/checkout');
    } else if (res.status === 402) {
      // Declined — a new attempt needs a new idempotency key.
      setIdempotencyKey(newIdempotencyKey());
      setError(res.data?.message || 'Payment declined.');
    } else {
      setError(res.data?.message || 'Checkout failed.');
    }
  }

  if (lines.length === 0 && !success) {
    return (
      <div className="container">
        <div className="card">
          <p className="muted">
            Your cart is empty. <a href="/">Continue shopping →</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Checkout</h1>

      {success ? (
        <div className="alert alert-success">
          {success} <a href="/orders">View my orders →</a>
        </div>
      ) : (
        <div className="card card-narrow">
          <h2 style={{ marginTop: 0 }}>Order summary</h2>
          <table>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td>{l.name}</td>
                  <td>× {l.quantity}</td>
                  <td className="right">NPR {(l.price * l.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="price" style={{ textAlign: 'right', marginTop: 10 }}>
            Total: NPR {total.toLocaleString()}
          </p>

          <h2>Payment</h2>
          <form onSubmit={submit}>
            <label htmlFor="cc-name">Name on card</label>
            <input
              id="cc-name"
              autoComplete="cc-name"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              required
            />
            {fieldError('name') && <div className="alert alert-error">{fieldError('name')}</div>}

            <label htmlFor="cc-number">Card number</label>
            <input
              id="cc-number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
              maxLength={23}
              required
            />
            {fieldError('number') && <div className="alert alert-error">{fieldError('number')}</div>}

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="cc-expiry">Expiry (MM/YY)</label>
                <input
                  id="cc-expiry"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  value={card.expiry}
                  onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                  maxLength={5}
                  required
                />
                {fieldError('expiry') && <div className="alert alert-error">{fieldError('expiry')}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="cc-cvc">CVC</label>
                <input
                  id="cc-cvc"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  value={card.cvc}
                  onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                  maxLength={4}
                  required
                />
                {fieldError('cvc') && <div className="alert alert-error">{fieldError('cvc')}</div>}
              </div>
            </div>

            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Processing…' : `Pay NPR ${total.toLocaleString()}`}
            </button>
          </form>

          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Simulated payment gateway (coursework demo — no real charge occurs). The
            card number, expiry and CVC never leave your browser; only a one-time
            token is sent to the server. Test cards: 4242 4242 4242 4242 (approved),
            4000 0000 0000 0002 (declined).
          </p>
        </div>
      )}
    </div>
  );
}
