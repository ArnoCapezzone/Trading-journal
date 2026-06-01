import { useState, useCallback } from 'react';
import { parseMT5CSV, parseMT5JSON, detectDuplicates } from '../../utils/mt5Parser';
import { useTradesStore } from '../../store/tradesStore';
import type { Trade } from '../../types/trade';
import { calculateTrade } from '../../utils/calculations';
import { format } from 'date-fns';

type State = 'idle' | 'preview' | 'importing' | 'done' | 'error';

interface ParsedResult {
  toImport: Partial<Trade>[];
  duplicates: Partial<Trade>[];
  fileName: string;
}

export default function MT5Importer() {
  const { trades, importTrades } = useTradesStore();
  const [state, setState] = useState<State>('idle');
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        let parsed: Partial<Trade>[] = [];
        if (file.name.endsWith('.json')) {
          parsed = parseMT5JSON(content);
        } else {
          parsed = parseMT5CSV(content);
        }

        if (parsed.length === 0) {
          setErrorMsg('No valid trades found in the file. Check the format.');
          setState('error');
          return;
        }

        const { toImport, duplicates } = detectDuplicates(parsed, trades);
        setResult({ toImport, duplicates, fileName: file.name });
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
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
      setErrorMsg('Only .csv and .json files are supported');
      setState('error');
      return;
    }
    parseFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [trades]);

  async function handleImport() {
    if (!result) return;
    setState('importing');
    try {
      const res = await importTrades(result.toImport);
      setImportResult(res);
      setState('done');
    } catch (err) {
      setErrorMsg(`Import failed: ${String(err)}`);
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setResult(null);
    setImportResult(null);
    setErrorMsg('');
  }

  const dropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${dragging ? '#3D8EF0' : 'var(--border-default)'}`,
    borderRadius: 10,
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: dragging ? 'rgba(77,158,255,0.05)' : 'transparent',
    transition: 'all 0.2s',
  };

  if (state === 'done' && importResult) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#00C47A', marginBottom: 8 }}>Import Complete</div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 24 }}>
          {importResult.imported} trade{importResult.imported !== 1 ? 's' : ''} imported
          {importResult.duplicates > 0 && `, ${importResult.duplicates} duplicate${importResult.duplicates !== 1 ? 's' : ''} skipped`}
        </div>
        <button
          onClick={reset}
          style={{ padding: '8px 20px', backgroundColor: '#3D8EF0', border: 'none', borderRadius: 6, color: 'var(--text-on-accent)', fontWeight: 600, cursor: 'pointer' }}
        >
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
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 24, maxWidth: 400, margin: '0 auto' }}>{errorMsg}</div>
        <button onClick={reset} style={{ padding: '8px 20px', backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (state === 'preview' && result) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Preview — {result.fileName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {result.toImport.length} new trade{result.toImport.length !== 1 ? 's' : ''}
              {result.duplicates.length > 0 && (
                <span style={{ color: '#F0A030', marginLeft: 8 }}>
                  ⚠ {result.duplicates.length} duplicate{result.duplicates.length !== 1 ? 's' : ''} will be skipped
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={result.toImport.length === 0}
              style={{
                padding: '7px 20px',
                backgroundColor: result.toImport.length > 0 ? '#3D8EF0' : 'var(--border-default)',
                border: 'none',
                borderRadius: 5,
                color: result.toImport.length > 0 ? 'var(--bg-app)' : 'var(--text-tertiary)',
                fontWeight: 600,
                fontSize: 12,
                cursor: result.toImport.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Import {result.toImport.length} Trade{result.toImport.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                {['Date', 'Symbol', 'Dir', 'Entry', 'Exit', 'Lots', 'Est. P&L', 'Ticket'].map((h) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.toImport.slice(0, 50).map((t, i) => {
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
                    <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>{t.mt5TicketId ?? '—'}</td>
                  </tr>
                );
              })}
              {result.toImport.length > 50 && (
                <tr>
                  <td colSpan={8} style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11 }}>
                    ... and {result.toImport.length - 50} more trades
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Mac instructions with MQL5 script */}
      <div style={{ backgroundColor: 'rgba(77,158,255,0.07)', border: '1px solid rgba(77,158,255,0.25)', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#3D8EF0', marginBottom: 10 }}>
          📋 Comment exporter depuis MT5 Mac
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Method 1: MQL5 Script */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              ✅ Méthode recommandée — Script MQL5
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
              <li>Dans MT5 → onglet <strong style={{ color: 'var(--text-primary)' }}>Navigator</strong></li>
              <li>Ouvre <strong style={{ color: 'var(--text-primary)' }}>Scripts</strong> → double-clic sur <code style={{ color: '#3D8EF0', backgroundColor: 'var(--bg-app)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>ExportTradingJournal</code></li>
              <li>Clique OK (choisis le nombre de jours)</li>
              <li>Le fichier se crée automatiquement ici :<br />
                <code style={{ color: '#F0A030', backgroundColor: 'var(--bg-app)', padding: '2px 5px', borderRadius: 3, fontSize: 10, display: 'inline-block', marginTop: 4 }}>
                  ~/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files/trading_journal_export.csv
                </code>
              </li>
              <li>Glisse ce fichier ci-dessous ↓</li>
            </ol>
          </div>
          {/* Method 2: Native export */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              Méthode alternative — Export natif MT5
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
              <li>Onglet <strong style={{ color: 'var(--text-primary)' }}>Historique du compte</strong> (en bas)</li>
              <li>Clic droit → <strong style={{ color: 'var(--text-primary)' }}>Enregistrer comme rapport détaillé</strong></li>
              <li>Si le dialogue plante, cherche le fichier sauvegardé dans <code style={{ color: '#F0A030', backgroundColor: 'var(--bg-app)', padding: '1px 4px', borderRadius: 3, fontSize: 10 }}>MQL5/Files/</code></li>
            </ol>
          </div>
        </div>
      </div>

      <div
        style={dropZoneStyle}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = '.csv,.json';
          inp.onchange = (e) => handleFiles((e.target as HTMLInputElement).files);
          inp.click();
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Drop your MT5 file here
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          or <span style={{ color: '#3D8EF0', cursor: 'pointer' }}>browse files</span> — .csv or .json
        </div>
      </div>
    </div>
  );
}
