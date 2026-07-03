import { Request } from 'express';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { monitoringService } from './monitoring.service';

const auditLogRepository = new AuditLogRepository();

interface AuditInput {
  event: string;
  email?: string | null;
  userId?: string | null;
  success?: boolean;
  detail?: string;
}

export class AuditService {
  /** Records a security event. Never throws — auditing must not break flows. */
  async log(req: Request, input: AuditInput): Promise<void> {
    const ip = req.ip || req.socket.remoteAddress || '';
    try {
      await auditLogRepository.create({
        event: input.event,
        email: input.email ?? null,
        userId: (input.userId as any) ?? null,
        ip,
        userAgent: (req.headers['user-agent'] as string) || '',
        success: input.success ?? true,
        detail: input.detail ?? '',
      });
    } catch (err) {
      console.error('Audit log failed:', err);
    }
    // Feed the event to the real-time monitor (never let this break the flow).
    try {
      monitoringService.observe({
        event: input.event,
        success: input.success ?? true,
        ip,
        email: input.email ?? null,
        detail: input.detail,
      });
    } catch {
      /* monitoring must not affect request handling */
    }
  }

  recent(limit?: number) {
    return auditLogRepository.findRecent(limit);
  }
}

export const auditService = new AuditService();
