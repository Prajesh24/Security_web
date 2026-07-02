/**
 * Client-side shopping cart (localStorage). It only ever stores product IDs and
 * quantities — NEVER prices. At checkout the server looks up authoritative
 * prices, so nothing the client stores can affect what the user is charged.
 */
export interface CartLine {
  productId: string;
  name: string; // for display only
  price: number; // for display only — server recomputes
  quantity: number;
}

const KEY = 'gadgethub_cart';

export function getCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCart(lines: CartLine[]): void {
  localStorage.setItem(KEY, JSON.stringify(lines));
}

export function addToCart(line: Omit<CartLine, 'quantity'>, qty = 1): void {
  const cart = getCart();
  const existing = cart.find((l) => l.productId === line.productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ ...line, quantity: qty });
  }
  saveCart(cart);
}

export function setQuantity(productId: string, qty: number): void {
  const cart = getCart()
    .map((l) => (l.productId === productId ? { ...l, quantity: qty } : l))
    .filter((l) => l.quantity > 0);
  saveCart(cart);
}

export function removeFromCart(productId: string): void {
  saveCart(getCart().filter((l) => l.productId !== productId));
}

export function clearCart(): void {
  saveCart([]);
}

export function cartCount(): number {
  return getCart().reduce((n, l) => n + l.quantity, 0);
}
