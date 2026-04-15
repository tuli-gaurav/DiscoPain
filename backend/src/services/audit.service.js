import { AuditLog } from "../config/db.js";

export async function writeAudit({ userId, entityType, entityId, action, metadata = {} }) {
  return AuditLog.create({ user_id: userId, entityType, entityId, action, metadata });
}
