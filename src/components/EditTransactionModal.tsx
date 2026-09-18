import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { maskAccountNumber } from '../lib/format';
import { Alert, Button, Input, Modal } from './ui';

interface Props {
  transaction: any | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Admin: edit date/time, amount, description, reference for any transaction. */
export default function EditTransactionModal({ transaction, onClose, onSaved }: Props) {
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!transaction) return;
    try {
      const d = new Date(transaction.created_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDate(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    } catch {
      setDate('');
    }
    setDesc(transaction.description || '');
    setRef(transaction.reference || '');
    setAmount(String(Math.abs(parseFloat(transaction.amount) || 0)));
    setError('');
  }, [transaction]);

  const save = async () => {
    if (!transaction?.id) return;
    setError('');
    setBusy(true);
    try {
      const body: any = { description: desc, reference: ref };
      if (date) {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) {
          setError('Invalid date and time.');
          setBusy(false);
          return;
        }
        body.created_at = d.toISOString();
      }
      if (amount !== '' && Number.isFinite(parseFloat(amount))) {
        body.amount = Math.abs(parseFloat(amount));
      }
      await api.editTransaction(transaction.id, body);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not update transaction');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={transaction !== null} onClose={onClose} title="Edit transaction">
      {transaction && (
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <p className="text-caption text-content-muted">
            {transaction.full_name || 'Client'} · {maskAccountNumber(transaction.account_number)} ·{' '}
            {transaction.type}
          </p>
          <Input
            label="Date & time"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint="Change the posted date and time at any time"
          />
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Currency: ${transaction.currency || '—'}`}
          />
          <Input
            label="Description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Statement line"
          />
          <Input
            label="Reference"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Reference code"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} loadingLabel="Saving…" fullWidth>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
