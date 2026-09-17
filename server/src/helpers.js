/**
 * Notification + audit helpers for Rubicon Capital.
 * Hardened so owner admin token (id: admin-owner) never blows up UUID columns.
 */

import { query } from './db.js';

const SYSTEM_ADMIN_UUID = '00000000-0000-0000-0000-000000000001';

function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function createNotification(userId, type, title, message, metadata = null) {
  if (!userId || !isUuid(String(userId))) return; // skip if no real customer
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error('createNotification failed (non-fatal):', err.message);
  }
}

export async function createAuditLog(actorId, action, targetType, targetId, beforeData, afterData, reason, ipAddress) {
  // Owner admin uses id "admin-owner" which is NOT a UUID — map to system UUID
  const safeActor = isUuid(String(actorId)) ? actorId : SYSTEM_ADMIN_UUID;
  const safeTarget = targetId && isUuid(String(targetId)) ? targetId : null;
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, before_data, after_data, reason, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        safeActor, action, targetType, safeTarget,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null,
        reason, ipAddress
      ]
    );
  } catch (err) {
    console.error('createAuditLog failed (non-fatal):', err.message);
  }
}
