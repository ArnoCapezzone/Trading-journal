import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTradesStore } from '../store/tradesStore';
import type { Trade } from '../types/trade';
import TradeFilters from '../components/journal/TradeFilters';
import TradeTable from '../components/journal/TradeTable';
import TradeDetail from '../components/journal/TradeDetail';
import VoiceTradeInput from '../components/journal/VoiceTradeInput';

export default function Journal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { trades, filters, setFilters, clearFilters, getFilteredTrades, deleteTrade } = useTradesStore();

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Apply ?filter=pending from URL
  useEffect(() => {
    if (searchParams.get('filter') === 'pending') {
      setFilters({ status: 'PENDING_REVIEW' });
    }
  }, []);

  const filteredTrades = useMemo(() => getFilteredTrades(), [trades, filters]);

  const availableInstruments = useMemo(
    () => [...new Set(trades.map((t) => t.instrument))].sort(),
    [trades]
  );

  function handleDelete(id: string) {
    deleteTrade(id);
    if (selectedTrade?.id === id) setSelectedTrade(null);
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
          {filteredTrades.length !== trades.length && ` (filtered from ${trades.length})`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceTradeInput />
          <button
            onClick={() => navigate('/journal/new')}
            style={{
              padding: '7px 16px',
              backgroundColor: '#3D8EF0',
              border: 'none',
              borderRadius: 6,
              color: 'var(--text-on-accent)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + New Trade
          </button>
        </div>
      </div>

      {/* Filters */}
      <TradeFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClear={clearFilters}
        availableInstruments={availableInstruments}
      />

      {/* Table */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        <TradeTable
          trades={filteredTrades}
          onView={(t) => setSelectedTrade(t)}
          onEdit={(t) => navigate(`/journal/edit/${t.id}`)}
          onDelete={handleDelete}
        />
      </div>

      {/* Detail modal */}
      {selectedTrade && (
        <TradeDetail
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={(t) => {
            setSelectedTrade(null);
            navigate(`/journal/edit/${t.id}`);
          }}
        />
      )}
    </div>
  );
}
