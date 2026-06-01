import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTradesStore } from '../store/tradesStore';
import TradeForm from '../components/journal/TradeForm';
import type { Trade } from '../types/trade';
import { assignPlaybook } from '../lib/playbooksStore';

export default function TradeFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trades, addTrade, updateTrade } = useTradesStore();

  const editTrade = id ? trades.find((t) => t.id === id) : undefined;
  const isEdit = !!editTrade;

  // Pre-fill from voice dictation (navigate('/journal/new', { state: { prefill } }))
  const voicePrefill = (location.state as { prefill?: Partial<Trade> } | null)?.prefill;

  async function handleSubmit(data: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>) {
    if (isEdit && editTrade) {
      await updateTrade(editTrade.id, data);
    } else {
      const newTrade = await addTrade(data);
      // Apply pending playbook (set by TradeForm.handleSubmit when creating)
      const pending = sessionStorage.getItem('tj_pending_playbook');
      sessionStorage.removeItem('tj_pending_playbook');
      if (pending && newTrade?.id) {
        assignPlaybook(newTrade.id, pending);
      }
    }
    navigate('/journal');
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          {isEdit
            ? `Editing trade — ${editTrade?.instrument} ${editTrade?.direction}`
            : voicePrefill
            ? '🎤 Voice-dictated trade — review and confirm'
            : 'Record a new trade in your journal'}
        </div>
        {voicePrefill && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: 'rgba(77,158,255,0.1)', border: '1px solid rgba(77,158,255,0.3)', borderRadius: 4, fontSize: 11, color: '#3D8EF0' }}>
            ✓ Pre-filled by Groq AI — verify each field before saving
          </div>
        )}
      </div>
      <TradeForm
        initialData={editTrade ?? (voicePrefill as Trade | undefined)}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/journal')}
      />
    </div>
  );
}
