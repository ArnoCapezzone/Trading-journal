import { useState } from 'react';
import MT5Importer from '../components/import/MT5Importer';
import CSVImporter from '../components/import/CSVImporter';
import { useTradesStore } from '../store/tradesStore';
import { exportToCSV, exportToJSON } from '../utils/exportUtils';

type Tab = 'mt5' | 'csv' | 'export';

const TABS: { value: Tab; label: string }[] = [
  { value: 'mt5', label: 'MT5 Import' },
  { value: 'csv', label: 'CSV Import' },
  { value: 'export', label: 'Export' },
];

export default function Import() {
  const [activeTab, setActiveTab] = useState<Tab>('mt5');
  const { trades, getFilteredTrades } = useTradesStore();
  const filteredTrades = getFilteredTrades();

  return (
    <div style={{ padding: 24 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, backgroundColor: '#0D1017', padding: 4, borderRadius: 8, border: '1px solid #252D3F', width: 'fit-content' }}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            style={{
              padding: '7px 18px',
              borderRadius: 5,
              border: 'none',
              backgroundColor: activeTab === tab.value ? '#141823' : 'transparent',
              color: activeTab === tab.value ? '#EEF0F6' : '#8E97AC',
              fontSize: 13,
              fontWeight: activeTab === tab.value ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ backgroundColor: '#0D1017', border: '1px solid #252D3F', borderRadius: 8, padding: 24 }}>
        {activeTab === 'mt5' && <MT5Importer />}
        {activeTab === 'csv' && <CSVImporter />}
        {activeTab === 'export' && (
          <div>
            <div style={{ fontSize: 13, color: '#8E97AC', marginBottom: 24, lineHeight: 1.6 }}>
              Export your trade data for backup or analysis in external tools.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
              {/* CSV export */}
              <div style={{ backgroundColor: '#080B12', border: '1px solid #252D3F', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 20, marginBottom: 10 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#EEF0F6', marginBottom: 6 }}>Export as CSV</div>
                <div style={{ fontSize: 12, color: '#8E97AC', marginBottom: 16, lineHeight: 1.5 }}>
                  Export trades with all calculated fields (P&L, pips, duration, R:R) — compatible with Excel, Google Sheets.
                </div>
                <div style={{ fontSize: 11, color: '#8E97AC', marginBottom: 12 }}>
                  {filteredTrades.length !== trades.length ? (
                    <span style={{ color: '#F0A030' }}>Active filters: {filteredTrades.length} trades</span>
                  ) : (
                    <span>{trades.length} total trades</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => exportToCSV(filteredTrades)}
                    disabled={filteredTrades.length === 0}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: filteredTrades.length > 0 ? '#3D8EF0' : '#141823',
                      border: 'none',
                      borderRadius: 5,
                      color: filteredTrades.length > 0 ? '#080B12' : '#8E97AC',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: filteredTrades.length > 0 ? 'pointer' : 'not-allowed',
                      width: '100%',
                    }}
                  >
                    Export {filteredTrades.length} Trades (CSV)
                  </button>
                  {filteredTrades.length !== trades.length && (
                    <button
                      onClick={() => exportToCSV(trades)}
                      style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid #252D3F', borderRadius: 5, color: '#8E97AC', fontSize: 12, cursor: 'pointer', width: '100%' }}
                    >
                      Export All {trades.length} Trades
                    </button>
                  )}
                </div>
              </div>

              {/* JSON backup */}
              <div style={{ backgroundColor: '#080B12', border: '1px solid #252D3F', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 20, marginBottom: 10 }}>💾</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#EEF0F6', marginBottom: 6 }}>Full Backup (JSON)</div>
                <div style={{ fontSize: 12, color: '#8E97AC', marginBottom: 16, lineHeight: 1.5 }}>
                  Complete backup including all fields, notes, tags, and screenshots. Use to restore your journal.
                </div>
                <div style={{ fontSize: 11, color: '#8E97AC', marginBottom: 12 }}>
                  {trades.length} total trades
                </div>
                <button
                  onClick={() => exportToJSON(trades)}
                  disabled={trades.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: trades.length > 0 ? '#141823' : '#0D1017',
                    border: `1px solid ${trades.length > 0 ? '#252D3F' : '#0D1017'}`,
                    borderRadius: 5,
                    color: trades.length > 0 ? '#EEF0F6' : '#8E97AC',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: trades.length > 0 ? 'pointer' : 'not-allowed',
                    width: '100%',
                  }}
                >
                  Download Full Backup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
