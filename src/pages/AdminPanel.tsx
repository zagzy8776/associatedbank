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
import {
  Activity, ArrowDownLeft, ArrowUpRight, Check, ClipboardList, Lock, Plus,
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

  // Admin action modals
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

  // New data states for deposit requests and audit logs
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

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
        } else if (target === 'deposits' || target === 'requests') {
          setRequests((await api.adminRequests()).requests ?? []);
          try { setDepositRequests((await api.adminDeposits()).deposits ?? []); } catch { /* may not exist yet */ }
        } else if (target === 'audit') {
          try { setAuditLogs((await api.getAuditLogs()).audit_logs ?? []); } catch { setAuditLogs([]); }
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

  // Map 'requests' to 'deposits' for backward compatibility
  const effectiveTab = tab === 'deposits' ? 'requests' : tab;

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
      await loadTab('requests');
    } catch (e: any) {
      setActionError(e?.message || 'That decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustBalance = async () => {
    setActionError('');
    if (!adjustAccountId || !adjustAmount || parseFloat(adjustAmount) <= 0) {
      setActionError('Select an account and enter a valid amount.'); return;
    }
    setBusy(true);
    try {
      await api.adjustBalance({ account_id: adjustAccountId, amount: parseFloat(adjustAmount), adjustment_type: adjustType, reason: adjustReason });
      setShowAdjust(false); setAdjustAmount(''); setAdjustReason('');
      setNotice(`Account ${adjustType === 'credit' ? 'credited' : 'debited'} successfully.`);
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

      {/* Mobile search for searchable tabs */}
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
                    <StatCard
                      label="Locked accounts"
                      value={overview?.accounts?.locked || 0}
                      icon={Lock}
                      alert
                    />
                  </div>

                  <SectionHeading title="Assets by currency" dot />
                  {(overview?.assets_by_currency || []).length === 0 ? (
                    <EmptyState
                      icon={Wallet}
                      title="No accounts opened yet"
                      description="Currency totals appear here as soon as clients open accounts."
                      className="mb-8"
                    />
                  ) : (
                    <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
                      {(overview?.assets_by_currency || []).map((a: any) => {
                        const meta = currencyMeta(a.currency);
                        return (
                          <Card key={a.currency} className="p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-label text-content-secondary">{meta.label}</span>
                              <span className="text-xl" aria-hidden="true">
                                {meta.flag}
                              </span>
                            </div>
                            <p className="text-xl font-semibold tabular-nums">
                              {formatMoney(a.total, a.currency)}
                            </p>
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
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-raised/40 px-4 py-2.5 text-sm"
                        >
                          <span className="text-content-primary">{a.description || a.action}</span>
                          <span className="text-caption text-content-muted">{formatDate(a.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {tab === 'users' && (
                <div className="animate-fade-in">
                  <SectionHeading
                    title="Clients"
                    icon={Users}
                    action={<span className="text-caption text-content-muted">{users.length} shown</span>}
                  />
                  <SearchField
                    className="mb-5 max-w-md"
                    value={search}
                    onChange={setSearch}
                    onSubmit={() => loadTab('users', search)}
                    placeholder="Search by name or email"
                    label="Search clients"
                  />

                  {users.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No clients found"
                      description={
                        search
                          ? `No client matches “${search}”. Try a different name or email.`
                          : 'Client profiles appear here as soon as people register.'
                      }
                    />
                  ) : (
                    <ul className="space-y-2.5">
                      {users.map((u) => (
                        <li
                          key={u.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-3.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.full_name}</p>
                            <p className="text-caption text-content-muted truncate">
                              {u.email} · {u.account_count ?? 0} account
                              {(u.account_count ?? 0) === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'}>{u.role}</Badge>
                            <LockToggleButton
                              locked={Boolean(u.is_locked)}
                              disabled={busy}
                              onClick={() => toggleUserLock(u.id, u.is_locked)}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
{tab === 'accounts' && (
                <div className="animate-fade-in">
                  <SectionHeading
                    title="Accounts"
                    icon={Wallet}
                    action={
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          setCreateError('');
                          setShowCreate(true);
                        }}
                        leftIcon={<Plus className="w-4 h-4" />}
                      >
                        Create
                      </Button>
                    }
                  />
                  <SearchField
                    className="mb-5 max-w-md"
                    value={search}
                    onChange={setSearch}
                    onSubmit={() => loadTab('accounts', search)}
                    placeholder="Search by account number, holder or email"
                    label="Search accounts"
                  />

                  {accounts.length === 0 ? (
                    <EmptyState
                      icon={Wallet}
                      title="No accounts found"
                      description={
                        search
                          ? `No account matches “${search}”.`
                          : 'Open the first account for a client using the Create button.'
                      }
                      action={
                        <Button
                          onClick={() => {
                            setCreateError('');
                            setShowCreate(true);
                          }}
                          leftIcon={<Plus className="w-4 h-4" />}
                        >
                          Create account
                        </Button>
                      }
                    />
                  ) : (
                    <ul className="space-y-2.5">
                      {accounts.map((a) => {
                        const meta = currencyMeta(a.currency);
                        return (
                          <li
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-3.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="w-10 h-10 rounded-control bg-surface-overlay/60 flex items-center justify-center text-lg shrink-0"
                                aria-hidden="true"
                              >
                                {meta.flag}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium font-mono truncate">
                                  {maskAccountNumber(a.account_number)}
                                </p>
                                <p className="text-caption text-content-muted truncate">
                                  {a.full_name} · {a.currency} ·{' '}
                                  <span className="tabular-nums">
                                    {formatMoney(a.balance, a.currency)}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              <StatusBadge status={a.status} locked={a.is_locked} />
                              <Button size="sm" variant="success" disabled={busy}
                                onClick={() => { setAdjustAccountId(a.id); setAdjustType('credit'); setAdjustAmount(''); setAdjustReason(''); setShowAdjust(true); }}>
                                + Money
                              </Button>
                              <Button size="sm" variant="secondary" disabled={busy}
                                onClick={() => { setAddTxAccountId(a.id); setAddTxType('salary'); setAddTxAmount(''); setAddTxDesc(''); setShowAddTx(true); }}>
                                + Tx
                              </Button>
                              {a.is_locked || a.status === 'blocked' ? (
                                <Button size="sm" variant="secondary" disabled={busy}
                                  onClick={() => handleAccountStatus(a.id, a.is_locked ? 'unlock' : 'unblock')}
                                  leftIcon={<Unlock className="w-3.5 h-3.5" />}>
                                  {a.is_locked ? 'Unlock' : 'Unblock'}
                                </Button>
                              ) : (
                                <Button size="sm" variant="danger" disabled={busy}
                                  onClick={() => handleAccountStatus(a.id, 'block')}
                                  leftIcon={<Lock className="w-3.5 h-3.5" />}>
                                  Block
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {tab === 'transactions' && (
                <div className="animate-fade-in">
                  <SectionHeading
                    title="Transactions"
                    icon={Activity}
                    action={
                      <span className="text-caption text-content-muted">{transactions.length} shown</span>
                    }
                  />
                  <SearchField
                    className="mb-5 max-w-md"
                    value={search}
                    onChange={setSearch}
                    onSubmit={() => loadTab('transactions', search)}
                    placeholder="Search by reference, email or description"
                    label="Search transactions"
                  />

                  {transactions.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title="No transactions found"
                      description={
                        search
                          ? `Nothing matches “${search}”.`
                          : 'Money movements across all client accounts are listed here, newest first.'
                      }
                    />
                  ) : (
                    <ul className="space-y-2.5">
                      {transactions.map((t) => {
                        const credit = t.type === 'deposit';
                        const Icon = credit ? ArrowDownLeft : ArrowUpRight;
                        return (
                          <li
                            key={t.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-3.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={cx(
                                  'w-10 h-10 rounded-control flex items-center justify-center shrink-0',
                                  credit
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/15 text-red-400',
                                )}
                                aria-hidden="true"
                              >
                                <Icon className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium capitalize">
                                  {t.type === 'withdrawal' ? 'Withdrawal' : t.type}
                                </p>
                                <p className="text-caption text-content-muted truncate">
                                  {t.full_name} · {maskAccountNumber(t.account_number)} ·{' '}
                                  {t.description || t.reference || 'No description'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p
                                className={cx(
                                  'text-sm font-semibold tabular-nums',
                                  credit ? 'text-emerald-400' : 'text-red-400',
                                )}
                              >
                                <span aria-hidden="true">{credit ? '+' : '−'}</span>
                                <span className="sr-only">{credit ? 'credit of ' : 'debit of '}</span>
                                {formatMoney(t.amount, t.currency)}
                              </p>
                              <p className="text-micro text-content-muted mt-0.5">
                                {formatDate(t.created_at)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
{(tab === 'requests' || tab === 'deposits') && (
                <div className="animate-fade-in">
                  <SectionHeading title="Account requests" icon={ClipboardList} />
                  {requests.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title="No account requests"
                      description="Clients asking to open a new currency account will appear here for approval."
                    />
                  ) : (
                    <ul className="space-y-3">
                      {requests.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {r.currency} account — {r.account_name || 'Unnamed'}
                              </p>
                              <p className="text-caption text-content-muted mt-1">
                                Requested by {r.requester_name} ({r.requester_email})
                              </p>
                              {r.reason && (
                                <p className="text-caption text-content-secondary mt-1">“{r.reason}”</p>
                              )}
                              <p className="text-micro text-content-muted mt-1.5">
                                Submitted {formatDate(r.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={r.status} />
                              {r.status === 'pending' && (
                                <>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => reviewRequest(r.id, 'approved')}
                                    leftIcon={<Check className="w-3.5 h-3.5" />}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => reviewRequest(r.id, 'rejected')}
                                    leftIcon={<X className="w-3.5 h-3.5" />}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* DEPOSIT REQUESTS */}
              {(tab === 'deposits' || tab === 'requests') && (
                <div className="animate-fade-in mt-8">
                  <SectionHeading title="Deposit Requests" icon={ArrowDownLeft}
                    action={<span className="text-caption text-content-muted">{depositRequests.filter(d => d.status === 'pending').length} pending</span>} />
                  {depositRequests.length === 0 ? (
                    <EmptyState icon={ArrowDownLeft} title="No deposit requests"
                      description="Customer deposit requests will appear here for approval." />
                  ) : (
                    <ul className="space-y-3">
                      {depositRequests.map((d) => (
                        <li key={d.id} className="rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{formatMoney(d.amount, d.currency)} Deposit</p>
                              <p className="text-caption text-content-muted mt-1">
                                {d.customer_name} ({d.customer_email}) · {d.account_number}
                              </p>
                              {d.reference && <p className="text-caption text-content-secondary mt-1">Ref: {d.reference}</p>}
                              <p className="text-micro text-content-muted mt-1">{formatDate(d.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <StatusBadge status={d.status} />
                              {d.status === 'pending' && (
                                <>
                                  <Button variant="success" size="sm" disabled={busy}
                                    onClick={() => handleDepositReview(d.id, 'approved')}
                                    leftIcon={<Check className="w-3.5 h-3.5" />}>Approve</Button>
                                  <Button variant="danger" size="sm" disabled={busy}
                                    onClick={() => handleDepositReview(d.id, 'rejected')}
                                    leftIcon={<X className="w-3.5 h-3.5" />}>Reject</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* AUDIT LOG */}
              {tab === 'audit' && (
                <div className="animate-fade-in">
                  <SectionHeading title="Audit Log" icon={ScrollText}
                    action={<span className="text-caption text-content-muted">{auditLogs.length} entries</span>} />
                  {auditLogs.length === 0 ? (
                    <EmptyState icon={ScrollText} title="No audit entries"
                      description="Admin actions like balance adjustments, account status changes, and transaction edits will appear here." />
                  ) : (
                    <ul className="space-y-2">
                      {auditLogs.map((log) => (
                        <li key={log.id} className="rounded-card border border-line-subtle bg-surface-raised/40 px-4 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</p>
                              <p className="text-caption text-content-muted mt-0.5">
                                By {log.actor_name || log.actor_id} · {log.target_type}: {log.target_id?.slice(0, 8)}…
                              </p>
                              {log.reason && <p className="text-caption text-content-secondary mt-0.5">"{log.reason}"</p>}
                            </div>
                            <p className="text-micro text-content-muted shrink-0">{formatDate(log.created_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === 'activity' && (
                <div className="animate-fade-in">
                  <SectionHeading
                    title="Activity log"
                    icon={ScrollText}
                    action={<span className="text-caption text-content-muted">{activity.length} entries</span>}
                  />
                  {activity.length === 0 ? (
                    <EmptyState
                      icon={ScrollText}
                      title="No activity recorded"
                      description="Every administrative and client action is written to this audit trail."
                    />
                  ) : (
                    <ul className="space-y-2">
                      {activity.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line-subtle bg-surface-raised/40 px-4 py-2.5 text-sm"
                        >
                          <span className="text-content-secondary min-w-0">
                            <span className="text-content-primary">{a.description || a.action}</span>
                            {a.full_name && <span className="text-content-muted"> · {a.full_name}</span>}
                          </span>
                          <span className="text-caption text-content-muted shrink-0">
                            {formatDate(a.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create account for a client"
        description="Accounts are created instantly and appear in the client's dashboard."
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowCreate(false)} disabled={busy}>
              Cancel
            </Button>
            <Button fullWidth onClick={createAccount} loading={busy} loadingLabel="Creating…">
              Create account
            </Button>
          </>
        }
      >
        {createError && (
          <Alert tone="error" onDismiss={() => setCreateError('')}>
            {createError}
          </Alert>
        )}

        <div className="space-y-5">
          <Input
            label="Client ID"
            required
            value={createForm.user_id}
            onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
            placeholder="Client profile UUID"
            hint="Copy this from the client profile in the Clients tab."
          />
          <Select
            label="Currency"
            value={createForm.currency}
            onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
          >
            <option value="GBP">🇬🇧 GBP — British Pound</option>
            <option value="USD">🇺🇸 USD — US Dollar</option>
            <option value="EUR">🇪🇺 EUR — Euro</option>
          </Select>
          <Input
            label="Account name"
            value={createForm.account_name}
            onChange={(e) => setCreateForm({ ...createForm, account_name: e.target.value })}
            placeholder="Everyday Checking"
          />
          <Input
            label="Initial deposit (optional)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={createForm.initial_deposit}
            onChange={(e) => setCreateForm({ ...createForm, initial_deposit: e.target.value })}
            placeholder="0.00"
            hint="Recorded as an audited deposit on the new account."
          />
        </div>
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)}
        title={`${adjustType === 'credit' ? 'Credit' : 'Debit'} Account`}
        description="Add or remove funds from this account. This action is logged in the audit trail.">
        <div className="space-y-4">
          {actionError && <Alert tone="error">{actionError}</Alert>}
          <Select label="Type" value={adjustType} onChange={e => setAdjustType(e.target.value as 'credit' | 'debit')}>
            <option value="credit">Credit (add funds)</option>
            <option value="debit">Debit (remove funds)</option>
          </Select>
          <Input label="Amount" type="number" inputMode="decimal" step="0.01" min="0.01"
            value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0.00" required />
          <Input label="Reason" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
            placeholder="e.g. Demo funding, correction" hint="Required for audit trail." />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setShowAdjust(false)}>Cancel</Button>
          <Button onClick={handleAdjustBalance} loading={busy} loadingLabel="Processing…"
            variant={adjustType === 'credit' ? 'success' : 'danger'} fullWidth>
            {adjustType === 'credit' ? 'Credit Account' : 'Debit Account'}
          </Button>
        </div>
      </Modal>

      {/* Add Transaction Modal */}
      <Modal open={showAddTx} onClose={() => setShowAddTx(false)}
        title="Add Transaction"
        description="Create a simulated transaction entry for this account.">
        <div className="space-y-4">
          {actionError && <Alert tone="error">{actionError}</Alert>}
          <Select label="Transaction Type" value={addTxType} onChange={e => setAddTxType(e.target.value)}>
            <option value="salary">Salary</option>
            <option value="rent_payment">Rent Payment</option>
            <option value="card_payment">Card Payment</option>
            <option value="transfer">Transfer</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="fee">Fee</option>
            <option value="bonus">Bonus</option>
            <option value="refund">Refund</option>
            <option value="crypto_purchase">Crypto Purchase</option>
            <option value="crypto_sale">Crypto Sale</option>
          </Select>
          <Input label="Amount" type="number" inputMode="decimal" step="0.01"
            value={addTxAmount} onChange={e => setAddTxAmount(e.target.value)} placeholder="0.00" required
            hint="Use negative values for debits (e.g. -250.00)" />
          <Input label="Description" value={addTxDesc} onChange={e => setAddTxDesc(e.target.value)}
            placeholder="e.g. Monthly salary payment" />
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input type="checkbox" checked={addTxUpdateBalance} onChange={e => setAddTxUpdateBalance(e.target.checked)}
              className="rounded border-line-strong" />
            Update account balance
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setShowAddTx(false)}>Cancel</Button>
          <Button onClick={handleAddTransaction} loading={busy} loadingLabel="Adding…" fullWidth>Add Transaction</Button>
        </div>
      </Modal>

    </AdminLayout>
  );
}
/** Compact metric tile used across the admin overview (Req 9.1). */
function StatCard({
  label,
  value,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: number | string;
  icon: typeof Shield;
  alert?: boolean;
}) {
  const isAlert = alert && Number(value) > 0;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-content-secondary">{label}</p>
          <p
            className={cx(
              'text-2xl font-semibold tabular-nums mt-1.5',
              isAlert ? 'text-red-400' : 'text-content-primary',
            )}
          >
            {value}
          </p>
        </div>
        <span
          className={cx(
            'w-9 h-9 rounded-control flex items-center justify-center shrink-0',
            isAlert ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400',
          )}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" />
        </span>
      </div>
    </Card>
  );
}

/** Lock / unlock control shared by the client and account lists. */
function LockToggleButton({
  locked,
  disabled,
  onClick,
}: {
  locked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={locked ? 'secondary' : 'danger'}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={locked}
      leftIcon={locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
      className={locked ? 'border-emerald-500/40 text-emerald-300' : undefined}
    >
      {locked ? 'Unlock' : 'Lock'}
    </Button>
  );
}
