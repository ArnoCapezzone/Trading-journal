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
        <div style={{ fontSize: 18, fontWeight: 700, color: '#00C47A', marginBottom: 8 }}>Import Complete</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 24 }}>
          {importResult.imported} trade{importResult.imported !== 1 ? 's' : ''} imported
          {importResult.duplicates > 0 && `, ${importResult.duplicates} duplicate${importResult.duplicates !== 1 ? 's' : ''} skipped`}
        </div>
        <button onClick={reset} style={{ padding: '8px 20px', backgroundColor: '#3D8EF0', border: 'none', borderRadius: 6, color: 'var(--text-on-accent)', fontWeight: 600, cursor: 'pointer' }}>
          Import Another File
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F04848', marginBottom: 8 }}>Error</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 24 }}>{errorMsg}</div>
        <button onClick={reset} style={{ padding: '8px 20px', backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer' }}>
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
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Preview — {fileName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {toImport.length} new trade{toImport.length !== 1 ? 's' : ''}
              {dupCount > 0 && <span style={{ color: '#F0A030', marginLeft: 8 }}>⚠ {dupCount} duplicates skipped</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            <button
              onClick={handleImport}
              disabled={toImport.length === 0}
              style={{ padding: '7px 20px', backgroundColor: toImport.length > 0 ? '#3D8EF0' : 'var(--border-default)', border: 'none', borderRadius: 5, color: toImport.length > 0 ? 'var(--bg-app)' : 'var(--text-tertiary)', fontWeight: 600, fontSize: 12, cursor: toImport.length > 0 ? 'pointer' : 'not-allowed' }}
            >
              Import {toImport.length} Trade{toImport.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                {['Date', 'Symbol', 'Dir', 'Entry', 'Exit', 'Lots', 'Est. P&L', 'Setup'].map((h) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {toImport.slice(0, 50).map((t, i) => {
                const calc = t.entryPrice && t.exitPrice && t.lotSize ? calculateTrade(t as Trade) : null;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>
                      {t.exitTime ? format(new Date(t.exitTime), 'dd/MM/yy') : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>{t.instrument}</td>
                    <td style={{ padding: '6px 10px', color: t.direction === 'LONG' ? '#00C47A' : '#F04848', fontWeight: 700 }}>{t.direction === 'LONG' ? 'L' : 'S'}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)' }}>{t.entryPrice?.toFixed(5)}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)' }}>{t.exitPrice?.toFixed(5)}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)' }}>{t.lotSize}</td>
                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono", monospace', color: calc?.isWin ? '#00C47A' : '#F04848' }}>
                      {calc ? `${calc.pnlDollar >= 0 ? '+' : ''}$${calc.pnlDollar.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)' }}>{t.setup ?? '—'}</td>
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
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          Import trades from a custom CSV file. Download the template to see the expected format.
        </div>
        <button
          onClick={generateCSVTemplate}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            color: '#3D8EF0',
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
          border: `2px dashed ${dragging ? '#3D8EF0' : 'var(--border-default)'}`,
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
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Drop your CSV file here</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>or <span style={{ color: '#3D8EF0' }}>browse files</span></div>
      </div>
    </div>
  );
}
