import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, formatMoney, formatDate } from '../lib/api';
import {
  ArrowLeft, Users, Wallet, Activity, ClipboardList,
  Lock, Unlock, Plus, Search, Loader2, RefreshCw,
  Check, X, Shield
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'accounts' | 'transactions' | 'activity' | 'requests';

export default function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ user_id: '', currency: 'GBP', account_name: '', initial_deposit: '' });
  const [busy, setBusy] = useState(false);

  const loadTab = async (t: Tab) => {
    setLoading(true);
    setError('');
    try {
      if (t === 'overview') {
        const data = await api.adminOverview();
        setOverview(data);
      } else if (t === 'users') {
        const data = await api.adminUsers(search);
        setUsers(data.users);
      } else if (t === 'accounts') {
        const data = await api.adminAccounts(search);
        setAccounts(data.accounts);
      } else if (t === 'transactions') {
        const data = await api.adminTransactions(search);
        setTransactions(data.transactions);
      } else if (t === 'activity') {
        const data = await api.adminActivity();
        setActivity(data.activity);
      } else if (t === 'requests') {
        const data = await api.adminRequests();
        setRequests(data.requests);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTab(tab); }, [tab]);

  const toggleUserLock = async (id: string, currentlyLocked: boolean) => {
    await api.lockUser(id, !currentlyLocked);
    loadTab('users');
  };

  const toggleAccountLock = async (id: string, currentlyLocked: boolean) => {
    await api.lockAccount(id, !currentlyLocked);
    loadTab('accounts');
  };

  const reviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await api.reviewRequest(id, { status });
      loadTab('requests');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setBusy(true);
    try {
      await api.adminCreateAccount({
        user_id: createForm.user_id,
        currency: createForm.currency,
        account_name: createForm.account_name || undefined,
        initial_deposit: createForm.initial_deposit || 0,
      });
      setShowCreate(false);
      setCreateForm({ user_id: '', currency: 'GBP', account_name: '', initial_deposit: '' });
      loadTab('accounts');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'accounts', label: 'Accounts', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: Activity },
    { id: 'requests', label: 'Requests', icon: ClipboardList },
    { id: 'activity', label: 'Activity Log', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span className="font-semibold">Admin Control Centre</span>
            </div>
          </div>
          <span className="text-sm text-slate-400">{user?.full_name}</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 hidden md:block">
          <nav className="space-y-1 sticky top-24">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch(''); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${
                  tab === t.id
                    ? 'bg-amber-500/15 text-amber-400 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="flex gap-2 overflow-x-auto mb-6 md:hidden pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs ${
                  tab === t.id ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {tab === 'overview' && overview && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Overview</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard label="Total Clients" value={overview.users?.total || 0} />
                    <StatCard label="Locked Users" value={overview.users?.locked || 0} alert />
                    <StatCard label="Total Accounts" value={overview.accounts?.total || 0} />
                    <StatCard label="Locked Accounts" value={overview.accounts?.locked || 0} alert />
                  </div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Assets by Currency</h3>
                  <div className="grid sm:grid-cols-3 gap-4 mb-8">
                    {(overview.assets_by_currency || []).map((a: any) => (
                      <div key={a.currency} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                        <div className="text-sm text-slate-400">{a.currency}</div>
                        <div className="text-xl font-semibold mt-1">{formatMoney(a.total, a.currency)}</div>
                      </div>
                    ))}
                  </div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Recent Admin Activity</h3>
                  <div className="space-y-2">
                    {(overview.recent_activity || []).slice(0, 10).map((a: any) => (
                      <div key={a.id} className="text-sm bg-slate-900/40 border border-slate-800/60 rounded-lg px-4 py-2.5 flex justify-between">
                        <span className="text-slate-300">{a.description || a.action}</span>
                        <span className="text-slate-500 text-xs">{formatDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* USERS */}
              {tab === 'users' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Users</h2>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadTab('users')}
                        placeholder="Search..."
                        className="bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 w-56"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-medium text-sm">{u.full_name}</div>
                          <div className="text-xs text-slate-500">{u.email} · {u.account_count} accounts · {u.role}</div>
                        </div>
                        <button
                          onClick={() => toggleUserLock(u.id, u.is_locked)}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                            u.is_locked
                              ? 'border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/10'
                              : 'border-red-600/40 text-red-400 hover:bg-red-600/10'
                          }`}
                        >
                          {u.is_locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACCOUNTS */}
              {tab === 'accounts' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Accounts</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-medium px-3 py-2 rounded-xl"
                      >
                        <Plus className="w-4 h-4" /> Create
                      </button>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && loadTab('accounts')}
                          placeholder="Search..."
                          className="bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 w-48"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {accounts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-medium text-sm font-mono">{a.account_number}</div>
                          <div className="text-xs text-slate-500">
                            {a.full_name} · {a.currency} · {formatMoney(a.balance, a.currency)}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccountLock(a.id, a.is_locked)}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
                            a.is_locked
                              ? 'border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/10'
                              : 'border-red-600/40 text-red-400 hover:bg-red-600/10'
                          }`}
                        >
                          {a.is_locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TRANSACTIONS */}
              {tab === 'transactions' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Transactions</h2>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadTab('transactions')}
                        placeholder="Search..."
                        className="bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 w-56"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {transactions.map((t) => (
                      <div key={t.id} className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium capitalize">{t.type} · {formatMoney(t.amount, t.currency)}</div>
                          <div className="text-xs text-slate-500">{t.full_name} · {t.account_number} · {t.reference}</div>
                        </div>
                        <div className="text-xs text-slate-500">{formatDate(t.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REQUESTS */}
              {tab === 'requests' && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Account Requests</h2>
                  <div className="space-y-3">
                    {requests.length === 0 && (
                      <div className="text-slate-500 text-sm text-center py-12">No requests</div>
                    )}
                    {requests.map((r) => (
                      <div key={r.id} className="bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {r.currency} account — {r.account_name || 'Unnamed'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Requested by {r.requester_name} ({r.requester_email})
                            </div>
                            {r.reason && <div className="text-xs text-slate-400 mt-1">{r.reason}</div>}
                            <div className="text-xs mt-2">
                              <span className={`px-2 py-0.5 rounded-full ${
                                r.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                                r.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                                'bg-red-500/15 text-red-400'
                              }`}>
                                {r.status}
                              </span>
                            </div>
                          </div>
                          {r.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => reviewRequest(r.id, 'approved')}
                                disabled={busy}
                                className="flex items-center gap-1 text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 px-3 py-1.5 rounded-lg hover:bg-emerald-600/30"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => reviewRequest(r.id, 'rejected')}
                                disabled={busy}
                                className="flex items-center gap-1 text-xs bg-red-600/20 text-red-400 border border-red-600/30 px-3 py-1.5 rounded-lg hover:bg-red-600/30"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIVITY */}
              {tab === 'activity' && (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Activity Log</h2>
                  <div className="space-y-2">
                    {activity.map((a) => (
                      <div key={a.id} className="bg-slate-900/40 border border-slate-800/60 rounded-lg px-4 py-2.5 flex justify-between text-sm">
                        <div>
                          <span className="text-slate-300">{a.description || a.action}</span>
                          {a.full_name && <span className="text-slate-500 ml-2">· {a.full_name}</span>}
                        </div>
                        <span className="text-slate-500 text-xs shrink-0 ml-4">{formatDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create account modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-5">Create account for client</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">User ID</label>
                <input
                  value={createForm.user_id}
                  onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
                  placeholder="UUID of the user"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Currency</label>
                <select
                  value={createForm.currency}
                  onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Account name</label>
                <input
                  value={createForm.account_name}
                  onChange={(e) => setCreateForm({ ...createForm, account_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Initial deposit (optional)</label>
                <input
                  type="number"
                  value={createForm.initial_deposit}
                  onChange={(e) => setCreateForm({ ...createForm, initial_deposit: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 border border-slate-700 py-2.5 rounded-xl text-sm">
                Cancel
              </button>
              <button
                onClick={createAccount}
                disabled={busy || !createForm.user_id}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: number | string; alert?: boolean }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${alert && Number(value) > 0 ? 'text-red-400' : ''}`}>
        {value}
      </div>
    </div>
  );
}
