import mongoose, { Document, Schema } from 'mongoose';

/**
 * Tamper-evident record of security-relevant events (logins, failures,
 * lockouts, transfers, admin actions). Audit logging is a core security
 * control: it supports intrusion detection, incident response and
 * non-repudiation.
 */
export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  event: string;
  email: string | null;
  userId: mongoose.Types.ObjectId | null;
  ip: string;
  userAgent: string;
  success: boolean;
  detail: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    event: { type: String, required: true, index: true },
    email: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    success: { type: Boolean, default: true },
    detail: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
