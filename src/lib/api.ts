const API = '/api';

function getToken() {
  return localStorage.getItem('rubicon_token');
}

function getAdminToken() {
  return localStorage.getItem('rubicon_admin_token');
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

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = getAdminToken() || getToken();
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
  register: (body: { email: string; password: string; full_name: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  changePassword: (body: { current_password: string; new_password: string }) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (body: { token: string; new_password: string }) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

  adminSendDigest: (to?: string) =>
    adminRequest('/admin/emails/digest', { method: 'POST', body: JSON.stringify(to ? { to } : {}) }),
  adminSendStatements: (body?: { user_id?: string; period_label?: string }) =>
    adminRequest('/admin/emails/statements', { method: 'POST', body: JSON.stringify(body || {}) }),

  getAccounts: () => request('/accounts'),
  createAccount: (body: { currency: string; account_name?: string; account_type?: string }) =>
    request('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  getAccount: (id: string) => request(`/accounts/${id}`),
  getTransactions: (id: string) => request(`/accounts/${id}/transactions`),
  transfer: (body: any) => request('/transfers', { method: 'POST', body: JSON.stringify(body) }),
  deposit: (body: { account_id: string; amount: number | string; description?: string; reference?: string }) =>
    request('/deposits', {
      method: 'POST',
      body: JSON.stringify({
        account_id: body.account_id,
        amount: typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount,
        reference: body.reference || body.description,
      }),
    }),
  withdraw: async (_body: any) => {
    throw new Error('Withdrawals must be arranged with client services. Use Transfers to move money between your accounts.');
  },
  createRequest: (body: any) => request('/requests', { method: 'POST', body: JSON.stringify(body) }),
  myRequests: () => request('/requests/mine'),

  adminOverview: () => adminRequest('/admin/overview'),
  adminUsers: (q = '') => adminRequest(`/admin/users?q=${encodeURIComponent(q)}`),
  lockUser: (id: string, locked: boolean) =>
    adminRequest(`/admin/users/${id}/lock`, { method: 'PATCH', body: JSON.stringify({ locked }) }),
  adminAccounts: (q = '') => adminRequest(`/admin/accounts?q=${encodeURIComponent(q)}`),
  lockAccount: (id: string, locked: boolean) =>
    adminRequest(`/admin/accounts/${id}/lock`, { method: 'PATCH', body: JSON.stringify({ locked }) }),
  adminCreateAccount: (body: any) =>
    adminRequest('/admin/accounts', { method: 'POST', body: JSON.stringify(body) }),
  adjustBalance: (body: {
    account_id: string;
    amount: number;
    adjustment_type?: 'credit' | 'debit';
    reason?: string;
  }) => {
    const signed =
      body.adjustment_type === 'debit' ? -Math.abs(Number(body.amount)) : Math.abs(Number(body.amount));
    return adminRequest(`/admin/accounts/${body.account_id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({
        amount: signed,
        reason: body.reason,
        description: body.reason || `Admin ${body.adjustment_type || 'credit'}`,
      }),
    });
  },
  adminTransactions: (q = '') => adminRequest(`/admin/transactions?q=${encodeURIComponent(q)}`),
  editTransaction: (
    id: string,
    body: { created_at?: string; description?: string; reference?: string; amount?: number }
  ) =>
    adminRequest(`/admin/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminActivity: () => adminRequest('/admin/activity'),
  adminRequests: () => adminRequest('/admin/requests'),
  reviewRequest: (id: string, body: { status: string; admin_note?: string }) =>
    adminRequest(`/admin/requests/${id}/review`, { method: 'POST', body: JSON.stringify(body) }),
  exchangeRates: () => adminRequest('/admin/exchange-rates'),
  updateRate: (body: any) =>
    adminRequest('/admin/exchange-rates', { method: 'PUT', body: JSON.stringify(body) }),
  promote: (email?: string) =>
    adminRequest('/admin/promote', { method: 'POST', body: JSON.stringify({ email }) }),

  createDepositRequest: (body: { account_id: string; amount: number; reference?: string }) =>
    request('/deposits', { method: 'POST', body: JSON.stringify(body) }),
  getMyDeposits: () => request('/deposits'),

  adminDeposits: (status = 'all') => adminRequest(`/admin/deposits?status=${status}`),
  reviewDeposit: (id: string, body: { status: string; admin_note?: string }) =>
    adminRequest(`/admin/deposits/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  initiateTransfer: (body: {
    from_account_id: string;
    to_account_number: string;
    amount: number;
    reference?: string;
  }) => request('/transfers', { method: 'POST', body: JSON.stringify(body) }),
  getTransfers: (account_id?: string) =>
    request(`/transfers${account_id ? `?account_id=${account_id}` : ''}`),

  requestCryptoAccount: (body: { asset: string }) =>
    request('/crypto', { method: 'POST', body: JSON.stringify(body) }),
  getMyCrypto: () => request('/crypto'),
  getCryptoTransactions: (id: string) => request(`/crypto/${id}/transactions`),

  adminCrypto: (status = 'all') => adminRequest(`/admin/crypto?status=${status}`),
  reviewCrypto: (id: string, body: { status: string; admin_note?: string }) =>
    adminRequest(`/admin/crypto/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adjustCryptoBalance: (id: string, body: { amount: number; reason?: string; transaction_type?: string }) =>
    adminRequest(`/admin/crypto/${id}/adjust`, { method: 'POST', body: JSON.stringify(body) }),

  getNotifications: (unread = false) => request(`/notifications${unread ? '?unread=true' : ''}`),
  markNotificationRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'POST' }),

  setAccountStatus: (id: string, body: { action: string; reason?: string }) =>
    adminRequest(`/admin/accounts/${id}/status`, { method: 'POST', body: JSON.stringify(body) }),
  adminAdjustBalance: (id: string, body: { amount: number; reason?: string; description?: string }) =>
    adminRequest(`/admin/accounts/${id}/adjust`, { method: 'POST', body: JSON.stringify(body) }),
  adminAddTransaction: (id: string, body: any) =>
    adminRequest(`/admin/accounts/${id}/transactions`, { method: 'POST', body: JSON.stringify(body) }),

  getAuditLogs: (params?: { target_type?: string; target_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.target_type) q.set('target_type', params.target_type);
    if (params?.target_id) q.set('target_id', params.target_id);
    if (params?.limit) q.set('limit', String(params.limit));
    return adminRequest(`/admin/audit-logs?${q.toString()}`);
  },
};

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
