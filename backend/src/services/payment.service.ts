import crypto from 'crypto';
import { HttpError } from '../errors/http-error';

/**
 * Simulated payment gateway.
 *
 * This is a MOCK provider for coursework/demo purposes — GadgetHub has no
 * merchant account with a real processor. It stands in for a service like
 * Stripe/PayPal so the checkout flow can be demonstrated end-to-end,
 * including declines, without moving real money.
 *
 * The security property this preserves is architectural, not cryptographic:
 * the raw card number, expiry and CVC are validated and consumed entirely in
 * the browser (see frontend/lib/payment.ts) and NEVER transmitted to or
 * stored by this server — only an opaque token plus the card brand/last4 for
 * receipt display. That mirrors how a real gateway's client-side SDK
 * (e.g. Stripe.js/Elements) keeps the backend out of PCI-DSS card-data scope
 * (SAQ A): the server only ever sees a token, never a PAN.
 *
 * To swap in a real processor: replace `charge()` below with a call to the
 * gateway's server SDK using the token it minted, and verify results via its
 * webhook rather than trusting the synchronous response.
 */

interface DecodedToken {
  outcome: 'approved' | 'declined_generic' | 'declined_insufficient_funds';
  brand: string;
  last4: string;
}

function decodeToken(token: string): DecodedToken {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      parsed?.v !== 1 ||
      typeof parsed.brand !== 'string' ||
      !/^\d{4}$/.test(parsed.last4) ||
      !['approved', 'declined_generic', 'declined_insufficient_funds'].includes(parsed.outcome)
    ) {
      throw new Error('malformed');
    }
    return { outcome: parsed.outcome, brand: parsed.brand, last4: parsed.last4 };
  } catch {
    throw new HttpError(400, 'Invalid payment token.');
  }
}

export interface ChargeInput {
  token: string;
  amount: number;
  currency: string;
}

export interface ChargeResult {
  success: boolean;
  transactionId: string;
  cardBrand: string;
  cardLast4: string;
  declineReason?: string;
}

export class PaymentService {
  /** Simulates authorizing + capturing a charge against the tokenized card. */
  charge(input: ChargeInput): ChargeResult {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new HttpError(400, 'Invalid charge amount.');
    }
    const decoded = decodeToken(input.token);
    const transactionId = 'txn_' + crypto.randomBytes(12).toString('hex');

    if (decoded.outcome === 'approved') {
      return {
        success: true,
        transactionId,
        cardBrand: decoded.brand,
        cardLast4: decoded.last4,
      };
    }
    return {
      success: false,
      transactionId,
      cardBrand: decoded.brand,
      cardLast4: decoded.last4,
      declineReason: decoded.outcome,
    };
  }
}

export const paymentService = new PaymentService();
