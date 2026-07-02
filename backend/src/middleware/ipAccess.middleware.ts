import { Request, Response, NextFunction } from 'express';
import { IP_ALLOWLIST, IP_BLOCKLIST } from '../config';
import { auditService } from '../services/audit.service';
import { HttpError } from '../errors/http-error';

/**
 * Network-level access control applied ahead of all routes.
 *
 *  - BLOCKLIST: listed IPs are always denied (e.g. a source seen abusing the API).
 *  - ALLOWLIST: if non-empty, the API is deny-by-default and ONLY listed IPs may
 *    reach it — useful for locking an admin/staging deployment to known networks.
 *
 * Both lists are empty by default, so the control is inert until configured.
 */
function normalise(ip: string): string {
  // Express may report IPv4 as an IPv6-mapped address (::ffff:127.0.0.1).
  return ip.replace(/^::ffff:/, '');
}

export function ipAccessControl(req: Request, _res: Response, next: NextFunction): void {
  const ip = normalise(req.ip || req.socket.remoteAddress || '');

  if (IP_BLOCKLIST.includes(ip)) {
    auditService.log(req, { event: 'IP_BLOCKED', success: false, detail: `blocklist: ${ip}` });
    return next(new HttpError(403, 'Access denied.'));
  }

  if (IP_ALLOWLIST.length > 0 && !IP_ALLOWLIST.includes(ip)) {
    auditService.log(req, { event: 'IP_DENIED', success: false, detail: `not allow-listed: ${ip}` });
    return next(new HttpError(403, 'Access denied.'));
  }

  next();
}
