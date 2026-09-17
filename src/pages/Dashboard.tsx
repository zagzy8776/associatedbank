import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, formatMoney } from '../lib/api';
import { CURRENCIES, currencyMeta } from '../lib/currencies';
import { maskAccountNumber, maskBalance, titleCase, formatDate, formatRelativeDay } from '../lib/format';
import { useBalanceVisibility, useScrolled } from '../hooks/useBalanceVisibility';
import {
  Alert, Button, Card, EmptyState, IconButton, Input, Modal, SectionHeading,
  Select, SkeletonList, SkipLink, StatusBadge,
} from '../components/ui';
import { cx } from '../lib/designTokens';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Clock, CreditCard, Eye, EyeOff,
  Home, LogOut, Menu, Plus, Send, Shield, Wallet, TrendingUp, Coins,
} from 'lucide-react';
import { NotificationBell } from '../components/NotificationBell';

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  currency: string;
  balance: string;
  status: string;
  is_locked: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  currency: string;
  description?: string;
  reference?: string;
  status?: string;
  created_at: string;
  account_number?: string;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const { hideBalances, toggle } = useBalanceVisibility();
  const scrolled = useScrolled();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const load = useCallback(async () => {
    setError('');
    try {
      const { accounts: rows } = await api.getAccounts();
      setAccounts(rows || []);
      // Load recent transactions from the first account
      if (rows?.length) {
        try {
          const txRes = await api.getTransactions(rows[0].id);
          setRecentTx((txRes.transactions || []).slice(0, 5));
        } catch { /* silent */ }
      }
    } catch (e: any) {
      setError(e?.message || 'We could not load your accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalByCurrency = useMemo(
    () =>
      accounts.reduce((acc, a) => {
        acc[a.currency] = (acc[a.currency] || 0) + parseFloat(a.balance || '0');
        return acc;
      }, {} as Record<string, number>),
    [accounts],
  );

  const countByCurrency = useMemo(
    () =>
      accounts.reduce((acc, a) => {
        acc[a.currency] = (acc[a.currency] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [accounts],
  );

  const openNewAccount = (currency?: string) => {
    const available = CURRENCIES.filter(c => !countByCurrency[c.code]);
    if (available.length === 0) return;
    setNewCurrency(currency || available[0].code);
    setNewName('');
    setCreateError('');
    setShowNew(true);
  };

  // Currencies the user doesn't have yet
  const availableCurrencies = CURRENCIES.filter(c => !countByCurrency[c.code]);
  const allCurrenciesTaken = availableCurrencies.length === 0;

  const createAccount = async () => {
    setCreating(true);
    setCreateError('');
    try {
      await api.createAccount({
        currency: newCurrency,
        account_name: newName.trim() || undefined,
      });
      setShowNew(false);
      setNewName('');
      await load();
    } catch (e: any) {
      setCreateError(e?.message || 'The account could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const signOut = () => { logout(); navigate('/'); };

  // Primary currency balance (first account's currency or GBP)
  const primaryCurrency = accounts[0]?.currency || 'GBP';
  const totalBalance = useMemo(() => Object.values(totalByCurrency).reduce((s, v) => s + v, 0), [totalByCurrency]);

  return (
    <div className="min-h-screen bg-surface text-content-primary flex flex-col">
      <SkipLink />

      {/* ── Sticky Header ── */}
      <header
        className={cx(
          'sticky top-0 z-header bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/75 border-b transition-colors duration-base',
          scrolled ? 'border-line-subtle shadow-card' : 'border-transparent',
        )}
      >
        <div className="w-full max-w-sm mx-auto px-4 sm:max-w-md md:max-w-2xl lg:max-w-4xl">
          <div className="h-16 flex items-center justify-between gap-3">
            <Link to="/dashboard" className="flex items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-label="Rubicon Capital home">
              <span className="w-9 h-9 rounded-control bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-surface text-base shadow-amber">R</span>
              <span className="font-semibold text-base tracking-tight hidden xs:inline">Rubicon Capital</span>
            </Link>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Link to="/profile" aria-label="Profile"
                className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-amber hover:shadow-amber-strong transition-shadow">
                {user?.full_name?.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 w-full max-w-sm mx-auto px-4 pt-6 pb-28 sm:max-w-md md:max-w-2xl lg:max-w-4xl">

        {/* ── Hero Balance Card ── */}
        <Card className="relative p-6 mb-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-transparent to-brand-400/10 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-content-secondary text-sm">{greeting}, {user?.full_name?.split(' ')[0] || ''}</p>
              <IconButton label={hideBalances ? 'Show balances' : 'Hide balances'} onClick={toggle}
                className="border border-line-strong bg-surface-raised/40">
                {hideBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </IconButton>
            </div>
            <p className="text-caption text-content-muted mb-1">Total Balance</p>
            <p className="text-3xl md:text-4xl font-bold tracking-tight tabular-nums">
              {maskBalance(formatMoney(totalBalance, primaryCurrency), hideBalances)}
            </p>
            <p className="text-caption text-content-muted mt-2">
              Across {accounts.length} account{accounts.length !== 1 ? 's' : ''} · {Object.keys(totalByCurrency).length} currenc{Object.keys(totalByCurrency).length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </Card>

        {/* ── Quick Actions ── */}
        <div className={`grid ${allCurrenciesTaken ? 'grid-cols-3' : 'grid-cols-4'} gap-3 mb-8`}>
          {[
            { icon: Send, label: 'Send', color: 'from-brand-400 to-brand-600', onClick: () => navigate('/transfers') },
            { icon: ArrowDownLeft, label: 'Deposit', color: 'from-emerald-400 to-emerald-600', onClick: () => navigate('/deposits') },
            { icon: Coins, label: 'Crypto', color: 'from-sky-400 to-sky-600', onClick: () => navigate('/crypto') },
            ...(!allCurrenciesTaken ? [{ icon: Plus, label: 'New Account', color: 'from-violet-400 to-violet-600', onClick: () => openNewAccount() }] : []),
          ].map(({ icon: Icon, label, color, onClick }) => (
            <button key={label} type="button" onClick={onClick}
              className="flex flex-col items-center gap-2 py-3 rounded-card hover:bg-surface-overlay/50 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
              <span className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shadow-card`}>
                <Icon className="w-5 h-5 text-white" />
              </span>
              <span className="text-caption font-medium text-content-secondary">{label}</span>
            </button>
          ))}
        </div>

        {error && (
          <Alert tone="error" title="We could not load your accounts" onDismiss={() => setError('')}
            action={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>
            {error}
          </Alert>
        )}

        {/* ── Recent Activity ── */}
        {recentTx.length > 0 && (
          <section className="mb-8" aria-labelledby="activity-heading">
            <SectionHeading id="activity-heading" title="Recent Activity" icon={Clock}
              action={<button onClick={() => accounts[0] && navigate(`/account/${accounts[0].id}`)}
                className="text-caption text-brand-400 hover:text-brand-300 font-medium">View all</button>} />
            <div className="space-y-2">
              {recentTx.map(tx => {
                const credit = tx.type === 'deposit' || tx.type === 'admin_credit' || parseFloat(tx.amount) > 0;
                return (
                  <Card key={tx.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cx('w-9 h-9 rounded-control flex items-center justify-center shrink-0',
                        credit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                        {credit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description || tx.type.replace(/_/g, ' ')}</p>
                        <p className="text-micro text-content-muted">{formatRelativeDay(tx.created_at)}</p>
                      </div>
                    </div>
                    <p className={cx('text-sm font-semibold tabular-nums shrink-0 ml-3',
                      credit ? 'text-emerald-400' : 'text-content-primary')}>
                      {credit ? '+' : '−'}{formatMoney(Math.abs(parseFloat(tx.amount)), tx.currency)}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
        {/* ── Portfolio Overview ── */}
        <section className="mb-8" aria-labelledby="portfolio-heading">
          <SectionHeading id="portfolio-heading" title="Portfolio" icon={TrendingUp} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {CURRENCIES.map(({ code, label, flag }) => {
              const total = totalByCurrency[code] || 0;
              const count = countByCurrency[code] || 0;
              return (
                <Card key={code} interactive={count > 0} className="relative group p-4 overflow-hidden">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-card bg-surface-overlay/70 flex items-center justify-center text-lg shrink-0">{flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-content-muted">{label}</p>
                      <p className="text-lg font-bold tracking-tight tabular-nums">
                        {maskBalance(formatMoney(total, code), hideBalances)}
                      </p>
                    </div>
                    {count > 0 ? (
                      <span className="text-micro text-content-muted">{count} acct{count !== 1 ? 's' : ''}</span>
                    ) : (
                      <button type="button" onClick={() => openNewAccount(code)}
                        className="text-caption text-brand-400 hover:text-brand-300 font-medium">Open →</button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ── Your Accounts ── */}
        <section aria-labelledby="accounts-heading">
          <SectionHeading id="accounts-heading" title="Your Accounts" icon={Wallet}
            action={accounts.length > 0 ? <span className="text-caption text-content-muted">{accounts.length} total</span> : undefined} />
          {loading ? <SkeletonList count={3} />
          : accounts.length === 0 ? (
            <EmptyState icon={Wallet} title="No accounts yet"
              description="Open your first account in sterling, dollars or euros."
              action={<Button onClick={() => openNewAccount()} leftIcon={<Plus className="w-4 h-4" />}>Open your first account</Button>}
              hint="You can hold all three currencies at the same time." />
          ) : (
            <div className="grid gap-3 md:gap-4">
              {accounts.map(a => <AccountCard key={a.id} account={a} hideBalances={hideBalances} />)}
            </div>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-line-subtle text-center">
          <p className="text-micro text-content-muted">© {new Date().getFullYear()} Rubicon Capital</p>
        </footer>
      </main>

      {/* ── Bottom Navigation ── */}
      <nav aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-header bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 border-t border-line-subtle">
        <div className="max-w-sm mx-auto px-2 sm:max-w-md md:max-w-2xl lg:max-w-4xl">
          <div className="h-20 flex items-center justify-around">
            <NavItem icon={Home} label="Home" active />
            <NavItem icon={CreditCard} label="Deposits" onClick={() => navigate('/deposits')} />
            <NavItem icon={ArrowLeftRight} label="Transfer" onClick={() => navigate('/transfers')} />
            <NavItem icon={Wallet} label="Crypto" onClick={() => navigate('/crypto')} />
            <NavItem icon={Menu} label="More" onClick={() => navigate('/profile')} />
          </div>
        </div>
      </nav>

      {/* ── New Account Modal ── */}
      <Modal open={showNew} onClose={() => setShowNew(false)}
        title="Open a new account" description="Choose a currency for your new account.">
        <div className="space-y-5">
          {createError && <Alert tone="error" onDismiss={() => setCreateError('')}>{createError}</Alert>}
          {availableCurrencies.length === 0 ? (
            <p className="text-sm text-content-secondary">You already have accounts in all available currencies.</p>
          ) : (
            <>
              <Select label="Currency" value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
                {availableCurrencies.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
              </Select>
              <Input label="Account name (optional)" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Everyday Checking" maxLength={80} hint="Leave blank and we will name it after the currency." />
            </>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
          <Button onClick={createAccount} loading={creating} loadingLabel="Creating…" fullWidth>Create account</Button>
        </div>
      </Modal>
    </div>
  );
}

function AccountCard({ account, hideBalances }: { account: Account; hideBalances: boolean }) {
  const meta = currencyMeta(account.currency);
  return (
    <Link to={`/account/${account.id}`}
      className={cx(
        'group relative flex items-center justify-between gap-4 rounded-card border border-line-subtle',
        'bg-gradient-to-br from-surface-raised/70 to-surface-raised/40 px-4 py-4 lg:px-5',
        'transition-all duration-slow ease-standard hover:border-line-strong hover:shadow-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
      )}>
      <div className="flex items-center gap-4 min-w-0">
        <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-card bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-surface font-bold text-base shrink-0 shadow-amber">
          {meta.symbol}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-body group-hover:text-brand-300 transition-colors duration-fast truncate">
            {titleCase(account.account_name || `${account.currency} Account`)}
          </p>
          <p className="text-caption text-content-muted font-mono mt-1">{maskAccountNumber(account.account_number)}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-body tabular-nums mb-1.5">
          {maskBalance(formatMoney(account.balance, account.currency), hideBalances)}
        </p>
        <StatusBadge status={account.status} locked={account.is_locked} />
      </div>
      <span className="absolute inset-0 rounded-card bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-slow pointer-events-none" />
    </Link>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: typeof Home; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      className={cx(
        'flex flex-col items-center gap-1 min-w-[70px] py-2 px-3 rounded-control',
        'transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        active ? 'text-brand-400 bg-brand-400/10' : 'text-content-muted hover:text-content-primary hover:bg-surface-overlay/60',
      )}>
      <Icon className="w-5 h-5" />
      <span className="text-caption font-medium">{label}</span>
      <span className={cx('w-1 h-1 rounded-full', active ? 'bg-brand-400' : 'bg-transparent')} />
    </button>
  );
}