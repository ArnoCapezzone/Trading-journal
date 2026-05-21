import { useState } from 'react';
import { generateCSVTemplate, parseCustomCSV } from '../../utils/exportUtils';
import { detectDuplicates } from '../../utils/mt5Parser';
import { useTradesStore } from '../../store/tradesStore';
import type { Trade } from '../../types/trade';
import { calculateTrade } from '../../utils/calculations';
import { format } from 'date-fns';

type State = 'idle' | 'preview' | 'importing' | 'done' | 'error';

export default function CSVImporter() {
  const { trades, importTrades } = useTradesStore();
  const [state, setState] = useState<State>('idle');
  const [dragging, setDragging] = useState(false);
  const [toImport, setToImport] = useState<Partial<Trade>[]>([]);
  const [dupCount, setDupCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseCustomCSV(content);
        if (parsed.length === 0) {
          setErrorMsg('No valid trades found. Make sure your CSV matches the template format.');
          setState('error');
          return;
        }
        const { toImport: ti, duplicates } = detectDuplicates(parsed, trades);
        setToImport(ti);
        setDupCount(duplicates.length);
        setFileName(file.name);
        setState('preview');
      } catch (err) {
        setErrorMsg(`Parse error: ${String(err)}`);
        setState('error');
      }
    };
    reader.readAsText(file);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      setErrorMsg('Only .csv files are supported');
      setState('error');
      return;
    }
    parseFile(file);
  }

  async function handleImport() {
    setState('importing');
    try {
      const res = await importTrades(toImport);
      setImportResult(res);
      setState('done');
    } catch (err) {
      setErrorMsg(`Import failed: ${String(err)}`);
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setToImport([]);
    setDupCount(0);
    setImportResult(null);
    setErrorMsg('');
  }

  if (state === 'done' && importResult) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#00d17a', marginBottom: 8 }}>Import Complete</div>
        <div style={{ color: '#8892a4', fontSize: 14, marginBottom: 24 }}>
          {importResult.imported} trade{importResult.imported !== 1 ? 's' : ''} imported
          {importResult.duplicates > 0 && `, ${importResult.duplicates} duplicate${importResult.duplicates !== 1 ? 's' : ''} skipped`}
        </div>
        <button onClick={reset} style={{ padding: '8px 20px', backgroundColor: '#4d9eff', border: 'none', borderRadius: 6, color: '#0f1117', fontWeight: 600, cursor: 'pointer' }}>
          Import Another File
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ff4d4d', marginBottom: 8 }}>Error</div>
        <div style={{ color: '#8892a4', fontSize: 13, marginBottom: 24 }}>{errorMsg}</div>
        <button onClick={reset} style={{ padding: '8px 20px', backgroundColor: '#22263a', border: '1px solid #2d3148', borderRadius: 6, color: '#e8eaf0', cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (state === 'preview') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Preview — {fileName}</div>
            <div style={{ fontSize: 12, color: '#8892a4', marginTop: 4 }}>
              {toImport.length} new trade{toImport.length !== 1 ? 's' : ''}
              {dupCount > 0 && <span style={{ color: '#ff9a3c', marginLeft: 8 }}>⚠ {dupCount} duplicates skipped</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid #2d3148', borderRadius: 5, color: '#8892a4', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            <button
              onClick={handleImport}
              disabled={toImport.length === 0}
              style={{ padding: '7px 20px', backgroundColor: toImport.length > 0 ? '#4d9eff' : '#2d3148', border: 'none', borderRadius: 5, color: toImport.length > 0 ? '#0f1117' : '#8892a4', fontWeight: 600, fontSize: 12, cursor: toImport.length > 0 ? 'pointer' : 'not-allowed' }}
            >
              Import {toImport.length} Trade{toImport.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#0f1117' }}>
                {['Date', 'Symbol', 'Dir', 'Entry', 'Exit', 'Lots', 'Est. P&L', 'Setup'].map((h) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#8892a4', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #2d3148' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {toImport.slice(0, 50).map((t, i) => {
                const calc = t.entryPrice && t.exitPrice && t.lotSize ? calculateTrade(t as Trade) : null;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #2d3148' }}>
                    <td style={{ padding: '6px 10px', color: '#8892a4', fontFamily: '"JetBrains Mono", monospace' }}>
                      {t.exitTime ? format(new Date(t.exitTime), 'dd/MM/yy') : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#e8eaf0', fontFamily: '"JetBrains Mono", monospace' }}>{t.instrument}</td>
                    <td style={{ padding: '6px 10px', color: t.direction === 'LONG' ? '#00d17a' : '#ff4d4d', fontWeight: 700 }}>{t.direction === 'LONG' ? 'L' : 'S'}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: '#e8eaf0' }}>{t.entryPrice?.toFixed(5)}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: '#e8eaf0' }}>{t.exitPrice?.toFixed(5)}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: '#e8eaf0' }}>{t.lotSize}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: calc?.isWin ? '#00d17a' : '#ff4d4d' }}>
                      {calc ? `${calc.pnlDollar >= 0 ? '+' : ''}$${calc.pnlDollar.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#8892a4' }}>{t.setup ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: '#8892a4', lineHeight: 1.6 }}>
          Import trades from a custom CSV file. Download the template to see the expected format.
        </div>
        <button
          onClick={generateCSVTemplate}
          style={{
            padding: '8px 16px',
            backgroundColor: '#22263a',
            border: '1px solid #2d3148',
            borderRadius: 6,
            color: '#4d9eff',
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: 16,
          }}
        >
          ⬇ Download Template
        </button>
      </div>

      <div
        style={{
          border: `2px dashed ${dragging ? '#4d9eff' : '#2d3148'}`,
          borderRadius: 10,
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragging ? 'rgba(77,158,255,0.05)' : 'transparent',
          transition: 'all 0.2s',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = '.csv';
          inp.onchange = (e) => handleFiles((e.target as HTMLInputElement).files);
          inp.click();
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 6 }}>Drop your CSV file here</div>
        <div style={{ fontSize: 12, color: '#8892a4' }}>or <span style={{ color: '#4d9eff' }}>browse files</span></div>
      </div>
    </div>
  );
}
