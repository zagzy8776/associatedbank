/**
 * Notification helper — creates in-app notifications for customers.
 */

import { query } from './db.js';

export async function createNotification(userId, type, title, message, metadata = null) {
  await query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function createAuditLog(actorId, action, targetType, targetId, beforeData, afterData, reason, ipAddress) {
  await query(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, before_data, after_data, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorId, action, targetType, targetId,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      reason, ipAddress
    ]
  );
}
