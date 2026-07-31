'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../../lib/api';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}
interface OrderPayment {
  cardBrand: string;
  cardLast4: string;
}
interface Order {
  _id: string;
  items: OrderItem[];
  total: number;
  status: string;
  payment?: OrderPayment;
  createdAt: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The server only ever returns the signed-in user's own orders.
    apiGet<{ orders: Order[] }>('/api/orders/me').then((res) => {
      if (res.status === 401) {
        router.push('/login?next=/orders');
        return;
      }
      setOrders(res.data.orders || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="container">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>My Orders</h1>
      {orders.length === 0 ? (
        <div className="card">
          <p className="muted">
            No orders yet. <a href="/">Start shopping →</a>
          </p>
        </div>
      ) : (
        orders.map((o) => (
          <div className="card" key={o._id} style={{ marginBottom: 12 }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
            >
              <span className="muted">
                {new Date(o.createdAt).toLocaleString()}
              </span>
              <span className="badge badge-status">{o.status}</span>
            </div>
            <table>
              <tbody>
                {o.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td>× {it.quantity}</td>
                    <td className="right">
                      NPR {(it.price * it.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              {o.payment && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Paid with {o.payment.cardBrand} •••• {o.payment.cardLast4}
                </span>
              )}
              <p className="price" style={{ marginLeft: 'auto' }}>
                Total: NPR {o.total.toLocaleString()}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
