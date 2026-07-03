'use client';

import { useEffect, useState } from 'react';
import { cartCount } from '../lib/cart';

export default function NavBar() {
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

  return (
    <nav className="navbar" aria-label="Primary">
      <a href="/" className="brand">
        <span className="logo">🛒</span> GadgetHub
      </a>
      <div className="nav-links">
        <a href="/">Shop</a>
        <a href="/orders">My Orders</a>
        <a href="/account">Account</a>
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
        <a href="/login" className="nav-cta">
          Sign In
        </a>
      </div>
    </nav>
  );
}
