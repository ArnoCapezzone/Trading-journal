import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTradesStore } from '../store/tradesStore';
import type { Trade } from '../types/trade';
import TradeFilters from '../components/journal/TradeFilters';
import TradeTable from '../components/journal/TradeTable';
import TradeDetail from '../components/journal/TradeDetail';

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
        <div style={{ fontSize: 12, color: '#8892a4' }}>
          {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
          {filteredTrades.length !== trades.length && ` (filtered from ${trades.length})`}
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
      <div style={{ backgroundColor: '#1a1d27', border: '1px solid #2d3148', borderRadius: 8, overflow: 'hidden' }}>
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
