import { Request } from 'express';
import { AuditLogRepository } from '../repositories/auditLog.repository';

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
    try {
      await auditLogRepository.create({
        event: input.event,
        email: input.email ?? null,
        userId: (input.userId as any) ?? null,
        ip: req.ip || req.socket.remoteAddress || '',
        userAgent: (req.headers['user-agent'] as string) || '',
        success: input.success ?? true,
        detail: input.detail ?? '',
      });
    } catch (err) {
      console.error('Audit log failed:', err);
    }
  }

  recent(limit?: number) {
    return auditLogRepository.findRecent(limit);
  }
}

export const auditService = new AuditService();
