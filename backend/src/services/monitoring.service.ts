/**
 * Lightweight real-time security monitoring.
 *
 * Every audit event is fed through `observe()`. The monitor keeps short-lived,
 * per-key counters (in memory) and raises an alert when a threshold is crossed
 * — e.g. repeated failed logins from one IP, account lockouts, IP denials, or
 * repeated MFA failures. Alerts are emitted to the console immediately (so an
 * operator / log pipeline sees them in real time) and retained in a capped ring
 * buffer that admins can pull via the API.
 *
 * This is intentionally dependency-free and single-instance. In production it
 * would push to a SIEM / alerting channel and share counters via Redis so the
 * thresholds hold across horizontally-scaled instances.
 */
export interface SecurityAlert {
  at: string;
  severity: 'warning' | 'critical';
  type: string;
  message: string;
  ip?: string;
  email?: string | null;
}

interface AuditLike {
  event: string;
  success?: boolean;
  ip?: string;
  email?: string | null;
  detail?: string;
}

interface Rule {
  // Which audit events (and success flag) this rule counts.
  matches: (e: AuditLike) => boolean;
  // Counter key so distinct actors are tracked independently.
  keyBy: (e: AuditLike) => string;
  threshold: number;
  windowMs: number;
  severity: SecurityAlert['severity'];
  type: string;
  describe: (count: number, e: AuditLike) => string;
}

const RULES: Rule[] = [
  {
    type: 'BRUTE_FORCE_IP',
    matches: (e) => e.event === 'LOGIN' && e.success === false,
    keyBy: (e) => `login_fail:${e.ip}`,
    threshold: 5,
    windowMs: 5 * 60 * 1000,
    severity: 'warning',
    describe: (c, e) => `${c} failed logins from ${e.ip} in 5 min`,
  },
  {
    type: 'ACCOUNT_LOCKED',
    matches: (e) => e.event === 'ACCOUNT_LOCKED',
    keyBy: (e) => `lock:${e.email}`,
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    severity: 'warning',
    describe: (_c, e) => `account locked after repeated failures: ${e.email}`,
  },
  {
    type: 'MFA_BRUTE_FORCE',
    matches: (e) => e.event === 'MFA_VERIFY' && e.success === false,
    keyBy: (e) => `mfa_fail:${e.ip}`,
    threshold: 4,
    windowMs: 5 * 60 * 1000,
    severity: 'warning',
    describe: (c, e) => `${c} failed MFA attempts from ${e.ip} in 5 min`,
  },
  {
    type: 'IP_DENIED',
    matches: (e) => e.event === 'IP_BLOCKED' || e.event === 'IP_DENIED',
    keyBy: (e) => `ip_deny:${e.ip}`,
    threshold: 3,
    windowMs: 10 * 60 * 1000,
    severity: 'critical',
    describe: (c, e) => `${c} requests from blocked/denied IP ${e.ip}`,
  },
];

const MAX_ALERTS = 100;

class MonitoringService {
  private hits = new Map<string, number[]>(); // key -> timestamps
  private alerts: SecurityAlert[] = [];

  observe(event: AuditLike): void {
    const now = Date.now();
    for (const rule of RULES) {
      if (!rule.matches(event)) continue;
      const key = rule.keyBy(event);
      const recent = (this.hits.get(key) || []).filter((t) => now - t < rule.windowMs);
      recent.push(now);
      this.hits.set(key, recent);

      if (recent.length >= rule.threshold) {
        this.raise({
          at: new Date(now).toISOString(),
          severity: rule.severity,
          type: rule.type,
          message: rule.describe(recent.length, event),
          ip: event.ip,
          email: event.email ?? null,
        });
        this.hits.set(key, []); // reset so we don't alert on every subsequent hit
      }
    }
  }

  private raise(alert: SecurityAlert): void {
    // Real-time surfacing. A log shipper / SIEM would forward this line.
    // eslint-disable-next-line no-console
    console.warn(`🚨 [SECURITY ALERT][${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`);
    this.alerts.unshift(alert);
    if (this.alerts.length > MAX_ALERTS) this.alerts.length = MAX_ALERTS;
  }

  recentAlerts(limit = 50): SecurityAlert[] {
    return this.alerts.slice(0, limit);
  }
}

export const monitoringService = new MonitoringService();
