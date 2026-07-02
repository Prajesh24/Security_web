'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060';

interface Product {
  _id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function AdminPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', category: 'General', stock: '', description: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    // Admin-only listing check: hit an admin route; 403/401 → not allowed.
    const guard = await apiGet('/api/admin/users');
    if (guard.status === 401) return router.push('/login?next=/admin');
    if (guard.status === 403) {
      setDenied(true);
      setLoading(false);
      return;
    }
    const res = await apiGet<{ products: Product[] }>('/api/products');
    setProducts(res.data.products || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await apiPost('/api/products', {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category: form.category,
      stock: Number(form.stock),
    });
    if (res.ok) {
      setForm({ name: '', price: '', category: 'General', stock: '', description: '' });
      setMsg('Product created.');
      load();
    } else {
      setMsg(res.data?.message || 'Failed to create product.');
    }
  }

  async function remove(id: string) {
    const csrf = readCookie('csrfToken');
    await fetch(`${API_URL}/api/products/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });
    load();
  }

  if (loading) return <div className="container"><p className="muted">Loading…</p></div>;
  if (denied)
    return (
      <div className="container">
        <div className="card">
          <h1>403 — Access denied</h1>
          <p className="muted">
            This page is restricted to admins. RBAC on the server blocked your
            request, and it would even if you navigated here directly. Sign in as{' '}
            <code>admin@gadgethub.test</code>.
          </p>
        </div>
      </div>
    );

  return (
    <div className="container">
      <h1>Admin — Product Management</h1>
      <div className="row">
        <div className="card">
          <h2>Add product</h2>
          <form onSubmit={create}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label>Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label>Price (NPR)</label>
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            <label>Category</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <label>Stock</label>
            <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
            {msg && <div className="alert alert-success">{msg}</div>}
            <button className="btn-primary" type="submit">Create Product</button>
          </form>
        </div>
        <div className="card">
          <h2>Catalogue ({products.length})</h2>
          <table>
            <thead>
              <tr><th>Name</th><th>Price</th><th>Stock</th><th></th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>NPR {p.price.toLocaleString()}</td>
                  <td>{p.stock}</td>
                  <td className="right">
                    <button className="btn-danger btn-sm" onClick={() => remove(p._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
