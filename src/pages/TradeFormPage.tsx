import { useParams, useNavigate } from 'react-router-dom';
import { useTradesStore } from '../store/tradesStore';
import TradeForm from '../components/journal/TradeForm';
import type { Trade } from '../types/trade';

export default function TradeFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { trades, addTrade, updateTrade } = useTradesStore();

  const editTrade = id ? trades.find((t) => t.id === id) : undefined;
  const isEdit = !!editTrade;

  async function handleSubmit(data: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>) {
    if (isEdit && editTrade) {
      await updateTrade(editTrade.id, data);
    } else {
      await addTrade(data);
    }
    navigate('/journal');
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#8892a4' }}>
          {isEdit ? `Editing trade — ${editTrade?.instrument} ${editTrade?.direction}` : 'Record a new trade in your journal'}
        </div>
      </div>
      <TradeForm
        initialData={editTrade}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/journal')}
      />
    </div>
  );
}
