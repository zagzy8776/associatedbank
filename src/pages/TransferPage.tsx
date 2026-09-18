import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, formatMoney } from '../lib/api';
import { currencyMeta } from '../lib/currencies';
import { maskAccountNumber, formatRelativeDay } from '../lib/format';
import {
  Alert, Button, Card, EmptyState, Input, Modal, PageHeader, Select,
  SectionHeading, Skeleton, SkeletonCard, StatusBadge,
} from '../components/ui';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Clock, Send, Wallet } from 'lucide-react';
import { cx } from '../lib/designTokens';

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  currency: string;
  balance: string;
  status?: string;
  is_locked?: boolean;
}
interface Transfer {
  id: string;
  type: string;
  amount: string;
  currency: string;
  description?: string;
  status?: string;
  created_at: string;
}

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
      const rows: Account[] = a.accounts || [];
      setAccounts(rows);
      setTransfers(t.transfers || []);
      setFromAccount((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        const first = rows.find((r) => !r.is_locked && (!r.status || r.status === 'active'));
        return first?.id || rows[0]?.id || '';
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const usableAccounts = useMemo(
    () => accounts.filter((a) => !a.is_locked && (!a.status || a.status === 'active')),
    [accounts],
  );

  const balanceByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) {
      map[a.currency] = (map[a.currency] || 0) + (parseFloat(a.balance) || 0);
    }
    return map;
  }, [accounts]);

  const primary = usableAccounts[0] || accounts[0];
  const primaryCurrency = primary?.currency || 'USD';
  const primaryBalance = balanceByCurrency[primaryCurrency] || 0;

  const stats = useMemo(() => {
    const sent = transfers
      .filter((t) => parseFloat(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
    const received = transfers
      .filter((t) => parseFloat(t.amount) > 0)
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    return { sent, received, count: transfers.length };
  }, [transfers]);

  const sel = accounts.find((a) => a.id === fromAccount);

  const openSend = () => {
    if (!fromAccount && usableAccounts[0]) setFromAccount(usableAccounts[0].id);
    setFormError('');
    setShowModal(true);
  };

  const handleTransfer = async () => {
    setFormError('');
    setSuccess('');
    if (!fromAccount) {
      setFormError('Select a sender account');
      return;
    }
    if (!toNumber.trim()) {
      setFormError('Enter recipient account number');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setFormError('Enter a valid amount');
      return;
    }
    const avail = parseFloat(sel?.balance || '0');
    if (parseFloat(amount) > avail) {
      setFormError(`Insufficient balance. Available: ${formatMoney(avail, sel?.currency || primaryCurrency)}`);
      return;
    }
    setBusy(true);
    try {
      const cleaned = toNumber.trim().replace(/\s+/g, '');
      await api.initiateTransfer({
        from_account_id: fromAccount,
        to_account_number: cleaned,
        amount: parseFloat(amount),
        reference: reference.trim() || undefined,
      });
      setSuccess(
        `Transfer of ${formatMoney(parseFloat(amount), sel?.currency || primaryCurrency)} to ${cleaned} was successful!`,
      );
      setShowModal(false);
      setToNumber('');
      setAmount('');
      setReference('');
      await load();
    } catch (e: any) {
      setFormError(e?.message || 'Transfer failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader title="Transfers" subtitle="Send money from your accounts" backTo="/dashboard" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">

        <Card className="relative p-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/15 via-transparent to-brand-400/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-caption text-content-muted mb-1 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  Available to send
                </p>
                <p className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-40" />
                  ) : (
                    formatMoney(primaryBalance, primaryCurrency)
                  )}
                </p>
                <p className="text-caption text-content-muted mt-1.5">
                  {accounts.length === 0
                    ? 'No accounts yet'
                    : accounts.length === 1
                      ? `1 ${primaryCurrency} account · ${maskAccountNumber(primary?.account_number || '')}`
                      : `${accounts.length} accounts across ${Object.keys(balanceByCurrency).length} currencies`}
                </p>
              </div>
              <Button onClick={openSend} leftIcon={<Send className="w-4 h-4" />} disabled={!usableAccounts.length}>
                Send Money
              </Button>
            </div>

            {Object.keys(balanceByCurrency).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.entries(balanceByCurrency).map(([code, total]) => {
                  const m = currencyMeta(code);
                  return (
                    <div
                      key={code}
                      className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-surface-raised/50 px-3 py-1.5"
                    >
                      <span aria-hidden="true">{m.flag}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(total, code)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-micro text-content-muted mt-4">
              {stats.count} transfer{stats.count !== 1 ? 's' : ''} ·{' '}
              {formatMoney(stats.sent, primaryCurrency)} sent ·{' '}
              {formatMoney(stats.received, primaryCurrency)} received
            </p>
          </div>
        </Card>

        {error && (
          <Alert tone="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert tone="success" onDismiss={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {accounts.length > 0 && (
          <section>
            <SectionHeading title="From accounts" icon={Wallet} />
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((a) => {
                const m = currencyMeta(a.currency);
                const active = a.id === fromAccount;
                const isDisabled = Boolean(a.is_locked) || Boolean(a.status && a.status !== 'active');
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setFromAccount(a.id);
                      openSend();
                    }}
                    disabled={isDisabled}
                    className={cx(
                      'text-left rounded-card border px-4 py-3 transition-colors',
                      active
                        ? 'border-brand-400 bg-brand-500/10'
                        : 'border-line-subtle bg-surface-raised/40 hover:border-line-strong',
                      isDisabled && 'opacity-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {m.flag} {a.account_name || `${a.currency} Account`}
                        </p>
                        <p className="text-micro text-content-muted font-mono mt-0.5">
                          {maskAccountNumber(a.account_number)}
                        </p>
                      </div>
                      <p className="text-sm font-bold tabular-nums shrink-0">
                        {formatMoney(a.balance, a.currency)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <SectionHeading title="Transfer history" icon={Clock} />
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers yet"
            description="When you send money, it will appear here with the amount and date."
            action={
              <Button onClick={openSend} leftIcon={<Send className="w-4 h-4" />} disabled={!usableAccounts.length}>
                Send Money
              </Button>
            }
            hint="Internal transfers between Rubicon accounts are instant."
          />
        ) : (
          <div className="space-y-3">
            {transfers.map((tx) => {
              const amt = parseFloat(tx.amount);
              const isCredit = amt > 0;
              return (
                <Card key={tx.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <span
                      className={cx(
                        'w-11 h-11 rounded-card flex items-center justify-center shrink-0',
                        isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10',
                      )}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-red-400" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          {isCredit ? 'Received' : 'Sent'}{' '}
                          {formatMoney(Math.abs(amt), tx.currency)}
                        </p>
                        {tx.status && <StatusBadge status={tx.status} />}
                      </div>
                      <p className="text-caption text-content-muted mt-0.5 truncate">
                        {tx.description || (isCredit ? 'Incoming transfer' : 'Outgoing transfer')}
                      </p>
                      <p className="text-micro text-content-muted mt-0.5">
                        {formatRelativeDay(tx.created_at)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Modal
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setFormError('');
          }}
          title="Send Money"
          description="Enter the recipient's Rubicon account number and amount."
        >
          <div className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            <Select
              label="From account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              required
            >
              <option value="">Select an account</option>
              {usableAccounts.map((a) => {
                const m = currencyMeta(a.currency);
                return (
                  <option key={a.id} value={a.id}>
                    {m.flag} {a.account_name || `${a.currency} Account`} —{' '}
                    {maskAccountNumber(a.account_number)} ({formatMoney(a.balance, a.currency)})
                  </option>
                );
              })}
            </Select>

            {sel && (
              <div className="rounded-control border border-line-subtle bg-surface-raised/40 px-3 py-2.5 flex items-center justify-between">
                <span className="text-caption text-content-muted">Available</span>
                <span className="text-sm font-bold tabular-nums">
                  {formatMoney(sel.balance, sel.currency)}
                </span>
              </div>
            )}

            <Input
              label="Recipient account number"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))}
              placeholder="401837294501"
              required
              hint="12-digit Rubicon number. Same currency only for internal transfers."
            />

            <Input
              label="Amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              leadingIcon={
                sel ? (
                  <span className="text-sm font-medium">{currencyMeta(sel.currency).symbol}</span>
                ) : undefined
              }
              hint={
                sel
                  ? `Max you can send: ${formatMoney(sel.balance, sel.currency)}`
                  : 'Select an account first'
              }
            />

            <Input
              label="Reference (optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Rent payment"
              hint="Shown to the recipient on their statement."
            />
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} loading={busy} loadingLabel="Sending…" fullWidth>
              Confirm Transfer
            </Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}
