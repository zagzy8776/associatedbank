import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, formatMoney } from '../lib/api';
import { currencyMeta } from '../lib/currencies';
import { formatDate, maskAccountNumber, titleCase } from '../lib/format';
import { required } from '../lib/validation';
import {
  Alert, Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, Modal,
  SearchField, SectionHeading, Select, SkeletonList, StatusBadge,
} from '../components/ui';
import { cx } from '../lib/designTokens';
import AdminLayout, { type AdminTab } from '../components/AdminLayout';
import EditTransactionModal from '../components/EditTransactionModal';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Check, ClipboardList, Coins, Lock, Plus,
  ScrollText, Shield, Unlock, Users, Wallet, X,
} from 'lucide-react';

type Tab = AdminTab;

const SEARCHABLE: Tab[] = ['users', 'accounts', 'transactions'];

const EMPTY_CREATE_FORM = { user_id: '', currency: 'GBP', account_name: '', initial_deposit: '' };

export default function AdminPanel() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState('');

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustAccountId, setAdjustAccountId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('');

  const [showAddTx, setShowAddTx] = useState(false);
  const [addTxAccountId, setAddTxAccountId] = useState('');
  const [addTxType, setAddTxType] = useState('salary');
  const [addTxAmount, setAddTxAmount] = useState('');
  const [addTxDesc, setAddTxDesc] = useState('');
  const [addTxUpdateBalance, setAddTxUpdateBalance] = useState(true);
  const [editTx, setEditTx] = useState<any | null>(null);

  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [cryptoAccounts, setCryptoAccounts] = useState<any[]>([]);

  const loadTab = useCallback(
    async (target: Tab, query = '') => {
      setLoading(true);
      setError('');
      try {
        if (target === 'overview') {
          setOverview(await api.adminOverview());
        } else if (target === 'users') {
          setUsers((await api.adminUsers(query)).users ?? []);
        } else if (target === 'accounts') {
          setAccounts((await api.adminAccounts(query)).accounts ?? []);
        } else if (target === 'transactions') {
          setTransactions((await api.adminTransactions(query)).transactions ?? []);
        } else if (target === 'activity') {
          setActivity((await api.adminActivity()).activity ?? []);
        } else if (target === 'deposits') {
          setRequests((await api.adminRequests()).requests ?? []);
          try { setDepositRequests((await api.adminDeposits()).deposits ?? []); } catch { /* may not exist yet */ }
        } else if (target === 'audit') {
          try { setAuditLogs((await api.getAuditLogs()).audit_logs ?? []); } catch { setAuditLogs([]); }
        } else if (target === 'crypto') {
          try { setCryptoAccounts((await api.adminCrypto()).crypto_accounts ?? []); } catch { setCryptoAccounts([]); }
        }
      } catch (e: any) {
        setError(e?.message || 'We could not load that section.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadTab(tab, SEARCHABLE.includes(tab) ? search : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const selectTab = (next: Tab) => {
    setTab(next);
    setSearch('');
    setError('');
  };

  const toggleUserLock = async (id: string, locked: boolean) => {
    setBusy(true);
    setActionError('');
    try {
      await api.lockUser(id, !locked);
      setNotice(locked ? 'Client unlocked.' : 'Client locked and unable to sign in.');
      await loadTab('users', search);
    } catch (e: any) {
      setActionError(e?.message || 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAccountLock = async (id: string, locked: boolean) => {
    setBusy(true);
    setActionError('');
    try {
      await api.lockAccount(id, !locked);
      setNotice(locked ? 'Account unlocked.' : 'Account locked and unable to transact.');
      await loadTab('accounts', search);
    } catch (e: any) {
      setActionError(e?.message || 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true);
    setActionError('');
    try {
      await api.reviewRequest(id, { status });
      setNotice(status === 'approved' ? 'Request approved and account opened.' : 'Request rejected.');
      await loadTab('deposits');
    } catch (e: any) {
      setActionError(e?.message || 'That decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustBalance = async () => {
    setActionError('');
    if (!adjustAccountId) { setActionError('No account selected.'); return; }
    if (!adjustAmount || isNaN(parseFloat(adjustAmount)) || parseFloat(adjustAmount) <= 0) {
      setActionError('Enter a valid positive amount.'); return;
    }
    setBusy(true);
    try {
      const result = await api.adjustBalance({
        account_id: adjustAccountId,
        amount: parseFloat(adjustAmount),
        adjustment_type: adjustType || 'credit',
        reason: adjustReason || `Admin ${adjustType || 'credit'}`
      });
      setShowAdjust(false); setAdjustAmount(''); setAdjustReason('');
      setNotice(`Account ${adjustType === 'credit' ? 'credited' : 'debited'} successfully. New balance: ${result.newBalance}`);
      await loadTab('accounts');
    } catch (e: any) { setActionError(e?.message || 'Adjustment failed'); }
    finally { setBusy(false); }
  };

  const handleAddTransaction = async () => {
    setActionError('');
    if (!addTxAccountId || !addTxType || !addTxAmount) { setActionError('Fill in all required fields.'); return; }
    setBusy(true);
    try {
      await api.adminAddTransaction(addTxAccountId, { type: addTxType, amount: parseFloat(addTxAmount), description: addTxDesc, update_balance: addTxUpdateBalance });
      setShowAddTx(false); setAddTxAmount(''); setAddTxDesc('');
      setNotice('Transaction added successfully.');
      await loadTab('accounts');
    } catch (e: any) { setActionError(e?.message || 'Failed to add transaction'); }
    finally { setBusy(false); }
  };

  const handleAccountStatus = async (accountId: string, action: string) => {
    setActionError(''); setBusy(true);
    try {
      await api.setAccountStatus(accountId, { action });
      setNotice(`Account ${action}ed successfully.`);
      await loadTab('accounts');
    } catch (e: any) { setActionError(e?.message || `Failed to ${action} account`); }
    finally { setBusy(false); }
  };

  const handleDepositReview = async (id: string, status: 'approved' | 'rejected') => {
    setActionError(''); setBusy(true);
    try {
      await api.reviewDeposit(id, { status });
      setNotice(status === 'approved' ? 'Deposit approved and funds credited.' : 'Deposit request rejected.');
      await loadTab('deposits');
    } catch (e: any) { setActionError(e?.message || 'Review failed'); }
    finally { setBusy(false); }
  };

  const handleCryptoReview = async (id: string, status: 'active' | 'rejected' | 'suspended') => {
    setActionError(''); setBusy(true);
    try {
      await api.reviewCrypto(id, { status });
      setNotice(`Crypto account ${status === 'active' ? 'approved' : status}.`);
      await loadTab('crypto');
    } catch (e: any) { setActionError(e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const handleCryptoAdjust = async (id: string, amount: number, reason?: string) => {
    setActionError(''); setBusy(true);
    try {
      await api.adjustCryptoBalance(id, { amount, reason });
      setNotice('Crypto balance adjusted.');
      await loadTab('crypto');
    } catch (e: any) { setActionError(e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const createAccount = async () => {
    const userIdError = required(createForm.user_id, 'Enter the client ID supplied by the client profile.');
    if (userIdError) {
      setCreateError(userIdError);
      return;
    }
    setBusy(true);
    setCreateError('');
    try {
      await api.adminCreateAccount({
        user_id: createForm.user_id,
        currency: createForm.currency,
        account_name: createForm.account_name || undefined,
        initial_deposit: createForm.initial_deposit || 0,
      });
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setNotice('Account created for the client.');
      await loadTab('accounts', search);
    } catch (e: any) {
      setCreateError(e?.message || 'The account could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout activeTab={tab} onTabChange={selectTab}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div />
        <Button variant="primary" size="sm" onClick={() => { setCreateError(''); setShowCreate(true); }}
          leftIcon={<Plus className="w-4 h-4" />}>New account</Button>
      </div>

      {notice && <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert>}
      {actionError && <Alert tone="error" title="That change could not be saved" onDismiss={() => setActionError('')}>{actionError}</Alert>}

      {SEARCHABLE.includes(tab) && (
        <div className="mb-6 md:hidden">
          <SearchField value={search} onChange={setSearch} onSubmit={() => loadTab(tab, search)} placeholder={`Search ${tab}…`} />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading admin data…"><SkeletonList count={4} /></LoadingState>
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadTab(tab, search)} />
      ) : (
        <>
          {tab === 'overview' && (
            <div className="animate-fade-in">
              <SectionHeading title="Bank at a glance" icon={Shield} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <StatCard label="Total clients" value={overview?.users?.total || 0} icon={Users} />
                <StatCard label="Locked clients" value={overview?.users?.locked || 0} icon={Lock} alert />
                <StatCard label="Total accounts" value={overview?.accounts?.total || 0} icon={Wallet} />
                <StatCard label="Locked accounts" value={overview?.accounts?.locked || 0} icon={Lock} alert />
              </div>
              <SectionHeading title="Assets by currency" dot />
              {(overview?.assets_by_currency || []).length === 0 ? (
                <EmptyState icon={Wallet} title="No accounts opened yet" description="Currency totals appear here as soon as clients open accounts." className="mb-8" />
              ) : (
                <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
                  {(overview?.assets_by_currency || []).map((a: any) => {
                    const meta = currencyMeta(a.currency);
                    return (
                      <Card key={a.currency} className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-label text-content-secondary">{meta.label}</span>
                          <span className="text-xl" aria-hidden="true">{meta.flag}</span>
                        </div>
                        <p className="text-xl font-semibold tabular-nums">{formatMoney(a.total, a.currency)}</p>
                      </Card>
                    );
                  })}
                </div>
              )}
              <SectionHeading title="Recent admin activity" dot />
              {(overview?.recent_activity || []).length === 0 ? (
                <EmptyState icon={Activity} title="No activity recorded yet" />
              ) : (
                <ul className="space-y-2">
                  {(overview?.recent_activity || []).slice(0, 10).map((a: any) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-raised/40 px-4 py-2.5 text-sm">
                      <span className="text-content-primary">{a.description || a.action}</span>
                      <span className="text-caption text-content-muted">{formatDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'transactions' && (
            <div className="animate-fade-in">
              <SectionHeading title="Transactions" icon={Activity} action={<span className="text-caption text-content-muted">{transactions.length} shown</span>} />
              <SearchField className="mb-5 max-w-md" value={search} onChange={setSearch} onSubmit={() => loadTab('transactions', search)} placeholder="Search by reference, email or description" label="Search transactions" />
              {transactions.length === 0 ? (
                <EmptyState icon={Activity} title="No transactions found" description={search ? `Nothing matches “${search}”.` : 'Money movements across all client accounts are listed here, newest first.'} />
              ) : (
                <ul className="space-y-2.5">
                  {transactions.map((t) => {
                    const ty = (t.type || '').toLowerCase();
                    const credit = ['deposit', 'transfer_in', 'credit', 'admin_credit'].includes(ty);
                    const Icon = credit ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <li
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditTx(t)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditTx(t); } }}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-3.5 cursor-pointer hover:border-line-strong hover:bg-surface-raised/70 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cx('w-10 h-10 rounded-control flex items-center justify-center shrink-0', credit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')} aria-hidden="true">
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize">
                              {ty === 'withdrawal' || ty === 'transfer_out' ? 'Withdrawal' : ty === 'transfer_in' ? 'Transfer in' : t.type}
                            </p>
                            <p className="text-caption text-content-muted truncate">
                              {t.full_name} · {maskAccountNumber(t.account_number)} · {t.description || t.reference || 'No description'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cx('text-sm font-semibold tabular-nums', credit ? 'text-emerald-400' : 'text-red-400')}>
                            <span aria-hidden="true">{credit ? '+' : '−'}</span>
                            {formatMoney(t.amount, t.currency)}
                          </p>
                          <p className="text-micro text-content-muted">{formatDate(t.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab !== 'overview' && tab !== 'transactions' && (
            <EmptyState icon={Activity} title="Open a section from the menu" description="Users, accounts, deposits and more are available in the admin sidebar." />
          )}
        </>
      )}

      <EditTransactionModal
        transaction={editTx}
        onClose={() => setEditTx(null)}
        onSaved={() => {
          setNotice('Transaction updated. Date, time and details saved.');
          loadTab('transactions', search);
        }}
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create account for a client">
        <div className="space-y-4">
          {createError && <Alert tone="error">{createError}</Alert>}
          <Input label="Client user ID" value={createForm.user_id} onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })} required />
          <Select label="Currency" value={createForm.currency} onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
          <Input label="Account name (optional)" value={createForm.account_name} onChange={(e) => setCreateForm({ ...createForm, account_name: e.target.value })} />
          <Input label="Initial deposit (optional)" type="number" value={createForm.initial_deposit} onChange={(e) => setCreateForm({ ...createForm, initial_deposit: e.target.value })} />
          <Button onClick={createAccount} loading={busy} fullWidth>Create account</Button>
        </div>
      </Modal>

      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title={`${adjustType === 'credit' ? 'Credit' : 'Debit'} Account`}>
        <div className="space-y-4">
          <Select label="Type" value={adjustType} onChange={(e) => setAdjustType(e.target.value as 'credit' | 'debit')}>
            <option value="credit">Credit (add funds)</option>
            <option value="debit">Debit (remove funds)</option>
          </Select>
          <Input label="Amount" type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
          <Input label="Reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
          <Button onClick={handleAdjustBalance} loading={busy} variant={adjustType === 'credit' ? 'success' : 'danger'} fullWidth>
            {adjustType === 'credit' ? 'Credit Account' : 'Debit Account'}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}

function StatCard({ label, value, icon: Icon, alert }: { label: string; value: number; icon: any; alert?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption text-content-muted">{label}</span>
        <Icon className={cx('w-4 h-4', alert ? 'text-red-400' : 'text-content-muted')} />
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function LockToggleButton({ locked, disabled, onClick }: { locked: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={disabled}
      onClick={onClick}
      leftIcon={locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
      className={locked ? 'border-emerald-500/40 text-emerald-300' : undefined}
    >
      {locked ? 'Unlock' : 'Lock'}
    </Button>
  );
}
