import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, formatMoney } from '../lib/api';
import {
  LogOut, Plus, Eye, EyeOff, ArrowUpRight, ArrowDownLeft,
  Shield, RefreshCw, Loader2, Wallet
} from 'lucide-react';

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  currency: string;
  balance: string;
  status: string;
  is_locked: boolean;
}

const currencyFlags: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideBalances, setHideBalances] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newCurrency, setNewCurrency] = useState('GBP');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { accounts } = await api.getAccounts();
      setAccounts(accounts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalByCurrency = accounts.reduce((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + parseFloat(a.balance);
    return acc;
  }, {} as Record<string, number>);

  const createAccount = async () => {
    setCreating(true);
    setError('');
    try {
      await api.createAccount({ currency: newCurrency, account_name: newName || undefined });
      setShowNew(false);
      setNewName('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-950 text-sm">
              R
            </div>
            <span className="font-semibold">Rubicon Capital</span>
          </div>
          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300"
              >
                <Shield className="w-4 h-4" /> Admin
              </Link>
            )}
            <span className="text-sm text-slate-400 hidden sm:inline">{user?.full_name}</span>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</h1>
            <p className="text-slate-400 text-sm mt-1">Your multi-currency portfolio</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHideBalances(!hideBalances)}
              className="p-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
            >
              {hideBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl transition text-sm"
            >
              <Plus className="w-4 h-4" /> New Account
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Portfolio summary */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {['GBP', 'USD', 'EUR'].map((cur) => (
            <div key={cur} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="text-sm text-slate-400 mb-1">{cur}</div>
              <div className="text-2xl font-semibold tracking-tight">
                {hideBalances ? '••••••' : formatMoney(totalByCurrency[cur] || 0, cur)}
              </div>
            </div>
          ))}
        </div>

        {/* Accounts list */}
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-amber-400" /> Accounts
        </h2>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
            <p className="text-slate-400 mb-4">No accounts yet</p>
            <button
              onClick={() => setShowNew(true)}
              className="text-amber-400 hover:text-amber-300 text-sm font-medium"
            >
              Create your first account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => (
              <Link
                key={a.id}
                to={`/account/${a.id}`}
                className="flex items-center justify-between bg-slate-900/60 border border-slate-800 hover:border-slate-600 rounded-2xl px-5 py-4 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-lg font-medium text-amber-400">
                    {currencyFlags[a.currency]}
                  </div>
                  <div>
                    <div className="font-medium group-hover:text-amber-300 transition">
                      {a.account_name || `${a.currency} Account`}
                    </div>
                    <div className="text-sm text-slate-500 font-mono">{a.account_number}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {hideBalances ? '••••••' : formatMoney(a.balance, a.currency)}
                  </div>
                  <div className="text-xs mt-0.5">
                    {a.is_locked ? (
                      <span className="text-red-400">Locked</span>
                    ) : (
                      <span className="text-emerald-400/80 capitalize">{a.status}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* New account modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-5">Open new account</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Currency</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/60"
                >
                  <option value="GBP">GBP — British Pound</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Account name (optional)</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${newCurrency} Current`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 border border-slate-700 hover:border-slate-500 py-2.5 rounded-xl text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={createAccount}
                disabled={creating}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
