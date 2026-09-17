const API = '/api';

function getToken() {
  return localStorage.getItem('rubicon_token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // Auth
  register: (body: { email: string; password: string; full_name: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  // Customer
  getAccounts: () => request('/accounts'),
  createAccount: (body: { currency: string; account_name?: string }) =>
    request('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  getAccount: (id: string) => request(`/accounts/${id}`),
  getTransactions: (id: string) => request(`/accounts/${id}/transactions`),
  transfer: (body: any) => request('/transfer', { method: 'POST', body: JSON.stringify(body) }),
  deposit: (body: any) => request('/deposit', { method: 'POST', body: JSON.stringify(body) }),
  withdraw: (body: any) => request('/withdraw', { method: 'POST', body: JSON.stringify(body) }),
  createRequest: (body: any) => request('/requests', { method: 'POST', body: JSON.stringify(body) }),
  myRequests: () => request('/requests/mine'),

  // Admin
  adminOverview: () => request('/admin/overview'),
  adminUsers: (q = '') => request(`/admin/users?q=${encodeURIComponent(q)}`),
  lockUser: (id: string, locked: boolean) =>
    request(`/admin/users/${id}/lock`, { method: 'PATCH', body: JSON.stringify({ locked }) }),
  adminAccounts: (q = '') => request(`/admin/accounts?q=${encodeURIComponent(q)}`),
  lockAccount: (id: string, locked: boolean) =>
    request(`/admin/accounts/${id}/lock`, { method: 'PATCH', body: JSON.stringify({ locked }) }),
  adminCreateAccount: (body: any) =>
    request('/admin/accounts', { method: 'POST', body: JSON.stringify(body) }),
  adjustBalance: (body: any) =>
    request('/admin/adjust-balance', { method: 'POST', body: JSON.stringify(body) }),
  adminTransactions: (q = '') => request(`/admin/transactions?q=${encodeURIComponent(q)}`),
  adminActivity: () => request('/admin/activity'),
  adminRequests: () => request('/admin/requests'),
  reviewRequest: (id: string, body: { status: string; admin_note?: string }) =>
    request(`/admin/requests/${id}/review`, { method: 'POST', body: JSON.stringify(body) }),
  exchangeRates: () => request('/admin/exchange-rates'),
  updateRate: (body: any) =>
    request('/admin/exchange-rates', { method: 'PUT', body: JSON.stringify(body) }),
  promote: (email?: string) =>
    request('/admin/promote', { method: 'POST', body: JSON.stringify({ email }) }),

  // Deposit requests (customer)
  createDepositRequest: (body: { account_id: string; amount: number; reference?: string }) =>
    request('/deposits', { method: 'POST', body: JSON.stringify(body) }),
  getMyDeposits: () => request('/deposits'),

  // Admin deposit management
  adminDeposits: (status = 'all') => request(`/admin/deposits?status=${status}`),
  reviewDeposit: (id: string, body: { status: string; admin_note?: string }) =>
    request(`/admin/deposits/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Transfers (by account number)
  initiateTransfer: (body: { from_account_id: string; to_account_number: string; amount: number; reference?: string }) =>
    request('/transfers', { method: 'POST', body: JSON.stringify(body) }),
  getTransfers: (account_id?: string) =>
    request(`/transfers${account_id ? `?account_id=${account_id}` : ''}`),

  // Crypto (customer)
  requestCryptoAccount: (body: { asset: string }) =>
    request('/crypto', { method: 'POST', body: JSON.stringify(body) }),
  getMyCrypto: () => request('/crypto'),
  getCryptoTransactions: (id: string) => request(`/crypto/${id}/transactions`),

  // Admin crypto management
  adminCrypto: (status = 'all') => request(`/admin/crypto?status=${status}`),
  reviewCrypto: (id: string, body: { status: string; admin_note?: string }) =>
    request(`/admin/crypto/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adjustCryptoBalance: (id: string, body: { amount: number; reason?: string; transaction_type?: string }) =>
    request(`/admin/crypto/${id}/adjust`, { method: 'POST', body: JSON.stringify(body) }),

  // Notifications
  getNotifications: (unread = false) => request(`/notifications${unread ? '?unread=true' : ''}`),
  markNotificationRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'POST' }),

  // Admin account controls
  setAccountStatus: (id: string, body: { action: string; reason?: string }) =>
    request(`/admin/accounts/${id}/status`, { method: 'POST', body: JSON.stringify(body) }),
  adminAdjustBalance: (id: string, body: { amount: number; reason?: string; description?: string }) =>
    request(`/admin/accounts/${id}/adjust`, { method: 'POST', body: JSON.stringify(body) }),
  adminAddTransaction: (id: string, body: any) =>
    request(`/admin/accounts/${id}/transactions`, { method: 'POST', body: JSON.stringify(body) }),

  // Audit logs
  getAuditLogs: (params?: { target_type?: string; target_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.target_type) q.set('target_type', params.target_type);
    if (params?.target_id) q.set('target_id', params.target_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return request(`/admin/audit-logs?${q.toString()}`);
  },
};

/* Presentation helpers now live in `src/lib/format.ts` and are re-exported
   here so existing imports of `formatMoney` / `formatDate` keep working. */
export {
  formatMoney,
  formatDate,
  formatShortDate,
  formatRelativeDay,
  formatAmountInput,
  splitMoney,
  titleCase,
  maskAccountNumber,
  maskBalance,
  BALANCE_MASK,
  ACCOUNT_MASK,
} from './format';
