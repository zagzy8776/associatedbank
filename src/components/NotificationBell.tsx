import { useCallback, useEffect, useState } from 'react';
import { api, formatDate } from '../lib/api';
import { Alert, Button, Card } from '../components/ui';
import { Bell, Check, X } from 'lucide-react';

interface Notification { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string; }

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative h-11 w-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-control text-content-secondary hover:text-content-primary hover:bg-surface-overlay/70 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[70vh] overflow-y-auto bg-surface-raised border border-line-strong rounded-panel shadow-modal z-50 animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line-subtle">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-caption text-brand-400 hover:text-brand-300">
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-content-muted hover:text-content-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-content-muted text-sm">No notifications</div>
            ) : (
              <div className="divide-y divide-line-subtle">
                {notifications.slice(0, 20).map(n => (
                  <div key={n.id} className={`px-4 py-3 ${!n.is_read ? 'bg-brand-500/5' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-caption text-content-secondary mt-0.5">{n.message}</p>
                        <p className="text-micro text-content-muted mt-1">{formatDate(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <button onClick={() => markRead(n.id)} className="shrink-0 text-brand-400 hover:text-brand-300" title="Mark as read">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}