import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatMoney } from '../lib/api';
import { currencyMeta } from '../lib/currencies';
import { maskAccountNumber, formatRelativeDay } from '../lib/format';
import { Alert, Button, Card, EmptyState, Input, Modal, PageHeader, Select, SectionHeading, Skeleton, SkeletonCard, StatusBadge } from '../components/ui';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Clock, Send } from 'lucide-react';
import { cx } from '../lib/designTokens';

interface Account { id: string; account_number: string; account_name: string; currency: string; balance: string; status: string; is_locked: boolean; }
interface Transfer { id: string; type: string; amount: string; currency: string; description?: string; status?: string; created_at: string; }

export default function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [fromAccount, setFromAccount] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, t] = await Promise.all([api.getAccounts(), api.getTransfers()]);
      setAccounts(a.accounts || []); setTransfers(t.transfers || []);
    } catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const sent = transfers.filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
    const received = transfers.filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
    return { sent, received, count: transfers.length };
  }, [transfers]);

  const handleTransfer = async () => {
    setFormError(''); setSuccess('');
    if (!fromAccount) { setFormError('Select a sender account'); return; }
    if (!toNumber.trim()) { setFormError('Enter recipient account number'); return; }
    if (!amount || parseFloat(amount) <= 0) { setFormError('Enter a valid amount'); return; }
    setBusy(true);
    try {
      await api.initiateTransfer({ from_account_id: fromAccount, to_account_number: toNumber.trim().toUpperCase(), amount: parseFloat(amount), reference: reference.trim() || undefined });
      setSuccess(`Transfer of ${formatMoney(parseFloat(amount), accounts.find(a=>a.id===fromAccount)?.currency||'GBP')} to ${toNumber} was successful!`);
      setShowModal(false); setToNumber(''); setAmount(''); setReference(''); await load();
    } catch (e: any) { setFormError(e?.message || 'Transfer failed'); }
    finally { setBusy(false); }
  };

  const sel = accounts.find(a => a.id === fromAccount);

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader title="Transfers" subtitle="Send money to any account" backTo="/dashboard" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">

        {/* ── Hero Summary ── */}
        <Card className="relative p-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/15 via-transparent to-brand-400/5 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-caption text-content-muted mb-1">Total Sent</p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
                {loading ? <Skeleton className="h-8 w-32" /> : formatMoney(stats.sent, 'GBP')}
              </p>
              <p className="text-caption text-content-muted mt-1.5">
                {stats.count} transfer{stats.count !== 1 ? 's' : ''} · {formatMoney(stats.received, 'GBP')} received
              </p>
            </div>
            <Button onClick={() => setShowModal(true)} leftIcon={<Send className="w-4 h-4" />}>Send Money</Button>
          </div>
        </Card>

        {error && <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert>}
        {success && <Alert tone="success" onDismiss={() => setSuccess('')}>{success}</Alert>}

        {/* ── Transfer History ── */}
        <SectionHeading title="Transfer History" icon={Clock} />
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
        ) : transfers.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No transfers yet"
            description="Send money to another account to see it here."
            action={<Button onClick={() => setShowModal(true)} leftIcon={<Send className="w-4 h-4" />}>Send Money</Button>}
            hint="Transfers between accounts are processed instantly." />
        ) : (
          <div className="space-y-3">
            {transfers.map(tx => {
              const amt = parseFloat(tx.amount);
              const isCredit = amt > 0;
              return (
                <Card key={tx.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <span className={cx('w-11 h-11 rounded-card flex items-center justify-center shrink-0',
                      isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10')}>
                      {isCredit ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" /> : <ArrowUpRight className="w-5 h-5 text-red-400" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{isCredit ? 'Received' : 'Sent'} {formatMoney(Math.abs(amt), tx.currency)}</p>
                        {tx.status && <StatusBadge status={tx.status} />}
                      </div>
                      <p className="text-caption text-content-muted mt-0.5 truncate">{tx.description || (isCredit ? 'Incoming transfer' : 'Outgoing transfer')}</p>
                      <p className="text-micro text-content-muted mt-0.5">{formatRelativeDay(tx.created_at)}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Transfer Modal ── */}
        <Modal open={showModal} onClose={() => { setShowModal(false); setFormError(''); }}
          title="Send Money" description="Transfer funds to any account number.">
          <div className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}
            <Select label="From Account" value={fromAccount} onChange={e => setFromAccount(e.target.value)} required>
              <option value="">Select an account</option>
              {accounts.filter(a => !a.is_locked && a.status === 'active').map(a => {
                const m = currencyMeta(a.currency);
                return <option key={a.id} value={a.id}>{m.flag} {a.account_name || `${a.currency} Account`} — {maskAccountNumber(a.account_number)} ({formatMoney(a.balance, a.currency)})</option>;
              })}
            </Select>
            <Input label="Recipient Account Number" value={toNumber}
              onChange={e => setToNumber(e.target.value.toUpperCase())} placeholder="SIM-USD-0000012345" required
              hint="Enter the full account number in SIM-XXX-XXXXXXXX format." />
            <Input label="Amount" type="number" inputMode="decimal" step="0.01" min="0.01"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required
              leadingIcon={sel ? <span className="text-sm font-medium">{currencyMeta(sel.currency).symbol}</span> : undefined}
              hint={sel ? `Available: ${formatMoney(sel.balance, sel.currency)}` : undefined} />
            <Input label="Reference (optional)" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="e.g. Rent payment, Invoice #123" hint="The recipient will see this note." />
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleTransfer} loading={busy} loadingLabel="Sending…" fullWidth>Confirm Transfer</Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}