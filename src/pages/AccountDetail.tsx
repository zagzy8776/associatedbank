import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatMoney, formatDate } from '../lib/api';
import {
  ArrowLeft, ArrowUpRight, ArrowDownLeft, Loader2,
  ArrowRightLeft, Plus, Minus
} from 'lucide-react';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'deposit' | 'withdraw' | 'transfer' | null>(null);
  const [amount, setAmount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [desc, setDesc] = useState('');
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [a, t, all] = await Promise.all([
        api.getAccount(id!),
        api.getTransactions(id!),
        api.getAccounts(),
      ]);
      setAccount(a.account);
      setTxs(t.transactions);
      setAllAccounts(all.accounts.filter((x: any) => x.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (modal === 'deposit') {
        await api.deposit({ account_id: id, amount, description: desc });
      } else if (modal === 'withdraw') {
        await api.withdraw({ account_id: id, amount, description: desc });
      } else if (modal === 'transfer') {
        await api.transfer({ from_account_id: id, to_account_id: toAccount, amount, description: desc });
      }
      setModal(null);
      setAmount('');
      setDesc('');
      setToAccount('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Account not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800/80 sticky top-0 bg-slate-950/90 backdrop-blur z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/dashboard" className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="font-medium">{account.account_name || `${account.currency} Account`}</div>
            <div className="text-xs text-slate-500 font-mono">{account.account_number}</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800 rounded-2xl p-8 mb-8">
          <div className="text-sm text-slate-400 mb-1">Available balance</div>
          <div className="text-4xl font-semibold tracking-tight mb-6">
            {formatMoney(account.balance, account.currency)}
          </div>
          {account.is_locked && (
            <div className="text-red-400 text-sm mb-4">This account is locked by admin</div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setModal('deposit')}
              disabled={account.is_locked}
              className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Deposit
            </button>
            <button
              onClick={() => setModal('withdraw')}
              disabled={account.is_locked}
              className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-40"
            >
              <Minus className="w-4 h-4" /> Withdraw
            </button>
            <button
              onClick={() => setModal('transfer')}
              disabled={account.is_locked}
              className="flex items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 px-4 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-40"
            >
              <ArrowRightLeft className="w-4 h-4" /> Transfer
            </button>
          </div>
        </div>

        <h2 className="text-lg font-medium mb-4">Recent activity</h2>
        {txs.length === 0 ? (
          <div className="text-slate-500 text-sm py-10 text-center border border-dashed border-slate-800 rounded-2xl">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-2">
            {txs.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    t.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' :
                    t.type === 'withdrawal' ? 'bg-red-500/15 text-red-400' :
                    'bg-amber-500/15 text-amber-400'
                  }`}>
                    {t.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> :
                     t.type === 'withdrawal' ? <ArrowUpRight className="w-4 h-4" /> :
                     <ArrowRightLeft className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium capitalize">{t.type}</div>
                    <div className="text-xs text-slate-500">{t.description || t.reference}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-medium text-sm ${
                    t.type === 'deposit' ? 'text-emerald-400' : t.type === 'withdrawal' ? 'text-red-400' : ''
                  }`}>
                    {t.type === 'deposit' ? '+' : t.type === 'withdrawal' ? '−' : ''}
                    {formatMoney(t.amount, t.currency)}
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(t.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Action modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-5 capitalize">{modal}</h3>
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Amount ({account.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/60"
                  placeholder="0.00"
                />
              </div>
              {modal === 'transfer' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">To account</label>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/60"
                  >
                    <option value="">Select account</option>
                    {allAccounts.filter(a => a.currency === account.currency).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name || a.currency} — {a.account_number}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Description (optional)</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/60"
                  placeholder="Note"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setModal(null); setError(''); }}
                className="flex-1 border border-slate-700 py-2.5 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || !amount || (modal === 'transfer' && !toAccount)}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
