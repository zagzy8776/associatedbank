/**
 * Notification routes — customer notification center.
 */
import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// Customer: list notifications
router.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    let sql = `SELECT * FROM notifications WHERE user_id = $1`;
    if (unreadOnly) sql += ` AND is_read = false`;
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    const { rows } = await query(sql, [req.user.id]);
    const countRes = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`, [req.user.id]
    );
    res.json({ notifications: rows, unread_count: parseInt(countRes.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch notifications' }); }
});

// Customer: mark notification as read
router.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true, read_at = now()
       WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to mark as read' }); }
});

// Customer: mark all notifications as read
router.post('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true, read_at = now()
       WHERE user_id = $1 AND is_read = false`, [req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to mark all as read' }); }
});

export default router;