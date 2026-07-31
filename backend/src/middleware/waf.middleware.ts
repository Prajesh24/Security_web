import { Request, Response, NextFunction } from 'express';

const URL_SIGNATURES: RegExp[] = [
  /\.\.(?:\/|\\|%2f|%5c)/i, // path traversal
  /%00/, // null-byte injection
  /\b(?:union\s+select|select\s+.*\s+from|insert\s+into|drop\s+table)\b/i, // SQLi
  /<script\b/i, // reflected XSS via URL
];

// Signatures checked against string values found anywhere in the JSON body/query.
const VALUE_SIGNATURES: RegExp[] = [
  /<script\b/i, // XSS payloads
  /javascript:/i, // javascript: URIs
  /\bon\w+\s*=\s*["']?\s*[^"'\s]/i, // inline event handlers (onerror=, onload=…)
  /\$where\b|\$gt\b|\$ne\b|\$regex\b/i, // NoSQL operator injection
  /\{\{.*\}\}/, // template/SSTI injection {{ 7*7 }}
  /;\s*(?:rm|cat|curl|wget|nc|bash|sh)\b/i, // command chaining
];

// Automated-scanner user agents that have no business hitting a storefront.
const BLOCKED_AGENTS =
  /(sqlmap|nikto|nmap|masscan|acunetix|nessus|dirbuster|gobuster|wpscan)/i;

function scanValue(value: unknown, patterns: RegExp[]): boolean {
  if (typeof value === 'string') {
    return patterns.some((re) => re.test(value));
  }
  if (Array.isArray(value)) {
    return value.some((v) => scanValue(v, patterns));
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) =>
      scanValue(v, patterns),
    );
  }
  return false;
}

export function waf(req: Request, res: Response, next: NextFunction): void {
  const ua = req.get('user-agent') || '';
  if (BLOCKED_AGENTS.test(ua)) {
    return block(res, req, 'scanner user-agent');
  }

  let decodedUrl = req.originalUrl;
  try {
    decodedUrl = decodeURIComponent(req.originalUrl);
  } catch {
    // A malformed percent-encoding is itself suspicious.
    return block(res, req, 'malformed URL encoding');
  }

  if (URL_SIGNATURES.some((re) => re.test(decodedUrl))) {
    return block(res, req, 'URL signature');
  }

  if (scanValue(req.body, VALUE_SIGNATURES) || scanValue(req.query, VALUE_SIGNATURES)) {
    return block(res, req, 'payload signature');
  }

  next();
}

function block(res: Response, req: Request, reason: string): void {
  // Log with enough detail to investigate, but return a generic message so we
  // never reveal which rule fired (information leakage).
  // eslint-disable-next-line no-console
  console.warn(
    `WAF blocked ${req.method} ${req.originalUrl} from ${req.ip} - ${reason}`,
  );
  res.status(403).json({ success: false, message: 'Request blocked.' });
}
