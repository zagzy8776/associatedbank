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
};

export function formatMoney(amount: number | string, currency = 'GBP') {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n || 0);
}

export function formatDate(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
