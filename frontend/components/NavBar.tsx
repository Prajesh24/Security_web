'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cartCount } from '../lib/cart';
import { useAuth } from '../lib/auth';

export default function NavBar() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(cartCount());
    update();
    // Refresh the badge when the cart changes (other tabs / focus).
    window.addEventListener('storage', update);
    window.addEventListener('focus', update);
    const id = setInterval(update, 1000);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('focus', update);
      clearInterval(id);
    };
  }, []);

  async function onSignOut() {
    await logout();
    router.push('/login');
  }

  return (
    <nav className="navbar" aria-label="Primary">
      <a href="/" className="brand">
        <span className="logo">🛒</span> GadgetHub
      </a>
      <div className="nav-links">
        <a href="/">Shop</a>

        {/* Account-only areas appear once the server confirms a session. */}
        {user && <a href="/orders">My Orders</a>}
        {user && <a href="/account">Account</a>}
        {user?.role === 'admin' && <a href="/admin">Admin</a>}

        {user && (
          <a
            href="/cart"
            className="cart-link"
            aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
          >
            Cart
            {count > 0 && (
              <span className="cart-badge" aria-hidden="true">
                {count}
              </span>
            )}
          </a>
        )}

        {/* Auth control: don't flicker between states while /me is in flight. */}
        {!loading &&
          (user ? (
            <>
              <span className="muted" style={{ fontSize: 13 }}>
                {user.email}
              </span>
              <button type="button" className="nav-cta" onClick={onSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <a href="/login" className="nav-cta">
              Sign In
            </a>
          ))}
      </div>
    </nav>
  );
}
