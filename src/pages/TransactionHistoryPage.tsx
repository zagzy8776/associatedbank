import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatMoney } from '../lib/api';
import { formatDate } from '../lib/format';
import { Alert, Card, EmptyState, Input, PageHeader, SectionHeading, StatusBadge } from '../components/ui';
import { Receipt, ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react';

interface Transaction { id: string; type: string; amount: string; currency: string; description?: string; reference?: string; status?: string; created_at: string; }

function isCredit(type: string) { return type === 'deposit' || type === 'admin_credit' || type === 'transfer_in'; }
function getIcon(type: string) { return isCredit(type) ? ArrowDownLeft : ArrowRightLeft; }

export default function TransactionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const res = await api.getTransactions(id);
      setTransactions(res.transactions || []);
    } catch (e: any) { setError(e?.message || 'Failed to load transactions'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter
    ? transactions.filter(tx =>
        tx.type.includes(filter.toLowerCase()) ||
        (tx.description || '').toLowerCase().includes(filter.toLowerCase()) ||
        (tx.reference || '').toLowerCase().includes(filter.toLowerCase())
      )
    : transactions;

  return (
    <div className="min-h-screen bg-surface">
      <PageHeader title="Transaction History" subtitle="All transactions for this account" backTo="/dashboard" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert>}
        <Input label="Filter transactions" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by type, description, or reference…" containerClassName="max-w-md" />
        <SectionHeading title={`${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`} icon={Receipt} />
        {loading ? <div className="text-content-muted text-sm py-8 text-center">Loading…</div>
        : filtered.length === 0 ? <EmptyState icon={Receipt} title="No transactions found" description={filter ? 'Try a different filter.' : 'Transactions will appear here.'} />
        : <div className="space-y-3">{filtered.map(tx => {
            const credit = isCredit(tx.type);
            const Icon = getIcon(tx.type);
            return (
              <Card key={tx.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-control flex items-center justify-center shrink-0 ${credit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-caption text-content-muted">{formatDate(tx.created_at)}</p>
                      {tx.reference && <p className="text-micro text-content-muted">Ref: {tx.reference}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${credit ? 'text-emerald-400' : 'text-red-400'}`}>
                      {credit ? '+' : '−'}{formatMoney(Math.abs(parseFloat(tx.amount)), tx.currency)}
                    </p>
                    {tx.status && tx.status !== 'completed' && <StatusBadge status={tx.status} />}
                  </div>
                </div>
              </Card>
            );
          })}</div>}
      </main>
    </div>
  );
}