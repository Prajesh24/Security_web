import { AuditLogModel, IAuditLog } from '../models/auditLog.model';

export class AuditLogRepository {
  create(data: Partial<IAuditLog>): Promise<IAuditLog> {
    return AuditLogModel.create(data);
  }

  findRecent(limit = 100): Promise<IAuditLog[]> {
    return AuditLogModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }
}
