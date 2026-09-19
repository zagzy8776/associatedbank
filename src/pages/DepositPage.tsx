import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatMoney } from '../lib/api';
import { formatRelativeDay } from '../lib/format';
import { currencyMeta } from '../lib/currencies';
import { Alert, Button, Card, EmptyState, Input, Modal, PageHeader, Select, SectionHeading, Skeleton, SkeletonCard, StatusBadge } from '../components/ui';
import { ArrowDownLeft, Clock, CheckCircle2, Plus, Hourglass, XCircle } from 'lucide-react';
import { cx } from '../lib/designTokens';

interface Account { id: string; account_number: string; account_name: string; currency: string; balance: string; }
interface DepositReq { id: string; amount: string; currency: string; status: string; account_number: string; account_name: string; reference?: string; admin_note?: string; created_at: string; reviewed_at?: string; }

export default function DepositPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [deposits, setDeposits] = useState<DepositReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, d] = await Promise.all([api.getAccounts(), api.getMyDeposits()]);
      setAccounts(a.accounts || []); setDeposits(d.deposits || []);
    } catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    let pending = 0;
    let approved = 0;
    for (const d of deposits) {
      const cur = (d.currency || 'GBP').toUpperCase();
      byCurrency[cur] = (byCurrency[cur] || 0) + (parseFloat(d.amount || '0') || 0);
      if (d.status === 'pending') pending += 1;
      if (d.status === 'approved') approved += 1;
    }
    const currencies = Object.keys(byCurrency);
    const primaryCurrency = currencies[0] || accounts[0]?.currency || 'GBP';
    const primaryTotal = byCurrency[primaryCurrency] || 0;
    return {
      byCurrency,
      currencies,
      primaryCurrency,
      primaryTotal,
      pending,
      approved,
      count: deposits.length,
    };
  }, [deposits, accounts]);

  const handleSubmit = async () => {
    setFormError(''); setSuccess('');
    if (!accountId) { setFormError('Select an account'); return; }
    if (!amount || parseFloat(amount) <= 0) { setFormError('Enter a valid amount'); return; }
    setBusy(true);
    try {
      await api.createDepositRequest({ account_id: accountId, amount: parseFloat(amount), reference: reference.trim() || undefined });
      setSuccess('Deposit request submitted! Awaiting admin approval.');
      setShowModal(false); setAmount(''); setReference(''); await load();
    } catch (e: any) { setFormError(e?.message || 'Failed to submit'); }
    finally { setBusy(false); }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader title="Deposits" subtitle="Request funds to your account" backTo="/dashboard" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">

        <Card className="relative p-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/15 via-transparent to-emerald-400/5 pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-caption text-content-muted mb-1">
                {stats.currencies.length > 1 ? 'Deposits by currency' : 'Total deposited'}
              </p>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : stats.currencies.length === 0 ? (
                <p className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">{formatMoney(0, stats.primaryCurrency)}</p>
              ) : stats.currencies.length === 1 ? (
                <p className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
                  {formatMoney(stats.primaryTotal, stats.primaryCurrency)}
                </p>
              ) : (
                <div className="space-y-1">
                  {stats.currencies.map((code) => (
                    <p key={code} className="text-lg md:text-xl font-bold tracking-tight tabular-nums">
                      {formatMoney(stats.byCurrency[code], code)}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-caption text-content-muted mt-1.5">
                {stats.count} deposit{stats.count !== 1 ? 's' : ''} · {stats.approved} approved
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {stats.pending > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-400/10 text-brand-300 text-caption font-medium">
                  <Hourglass className="w-3.5 h-3.5" /> {stats.pending} pending
                </span>
              )}
              <Button onClick={() => setShowModal(true)} leftIcon={<Plus className="w-4 h-4" />}>New Deposit</Button>
            </div>
          </div>
        </Card>

        {error && <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert>}
        {success && <Alert tone="success" onDismiss={() => setSuccess('')}>{success}</Alert>}

        <SectionHeading title="Deposit History" icon={Clock} />
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
        ) : deposits.length === 0 ? (
          <EmptyState icon={ArrowDownLeft} title="No deposits yet"
            description="Request your first deposit to fund your account."
            action={<Button onClick={() => setShowModal(true)} leftIcon={<Plus className="w-4 h-4" />}>Request Deposit</Button>}
            hint="Deposits are reviewed and approved by admin." />
        ) : (
          <div className="space-y-3">
            {deposits.map(d => {
              const meta = currencyMeta(d.currency);
              const isPending = d.status === 'pending';
              const isApproved = d.status === 'approved';
              return (
                <Card key={d.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <span className={cx('w-11 h-11 rounded-card flex items-center justify-center shrink-0',
                      isPending ? 'bg-brand-400/10' : isApproved ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                      {isPending ? <Hourglass className="w-5 h-5 text-brand-400" />
                        : isApproved ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        : <XCircle className="w-5 h-5 text-red-400" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{formatMoney(d.amount, d.currency)}</p>
                        <StatusBadge status={d.status} />
                      </div>
                      <p className="text-caption text-content-muted mt-0.5">
                        {d.account_name || `${d.currency} Account`} · {meta.flag} {d.currency}
                      </p>
                      <p className="text-micro text-content-muted mt-0.5">{formatRelativeDay(d.created_at)}</p>
                      {d.admin_note && <p className="text-caption text-content-secondary mt-1 italic">"{d.admin_note}"</p>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Modal open={showModal} onClose={() => { setShowModal(false); setFormError(''); }}
          title="Request a Deposit" description="Your request will be reviewed by an admin before funds are credited.">
          <div className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}
            <Select label="To Account" value={accountId} onChange={e => setAccountId(e.target.value)} required>
              <option value="">Select an account</option>
              {accounts.map(a => {
                const m = currencyMeta(a.currency);
                return <option key={a.id} value={a.id}>{m.flag} {a.account_name || `${a.currency} Account`} — {formatMoney(a.balance, a.currency)}</option>;
              })}
            </Select>
            <Input label="Amount" type="number" inputMode="decimal" step="0.01" min="0.01"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required
              leadingIcon={selectedAccount ? <span className="text-sm font-medium">{currencyMeta(selectedAccount.currency).symbol}</span> : undefined}
              hint={selectedAccount ? `Current balance: ${formatMoney(selectedAccount.balance, selectedAccount.currency)}` : undefined} />
            <Input label="Reference (optional)" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="e.g. Bank wire, Salary" hint="A note for your records." />
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={busy} loadingLabel="Submitting…" fullWidth>Submit Request</Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}
