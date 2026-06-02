import { useState, useEffect } from 'react';
import React from 'react';
import { useSyncStore } from '../../store/syncStore';
import { useAccountsStore } from '../../lib/accountsStore';

// ── MQL5 EA source (embedded, user can copy it) ───────────────────
const EA_SOURCE = `//+------------------------------------------------------------------+
//|  TradingJournalExport.mq5                                        |
//|  Exports closed trades to CSV for Trading Journal app            |
//|  → Place in: MT5 → File → Open Data Folder → MQL5 → Experts     |
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "1.10"
#property description "Auto-exports closed positions to trading_journal.csv"

input string InpFileName = "trading_journal.csv"; // CSV filename

void OnInit()      { ExportHistory(); }
void OnDeinit(const int) {}
void OnTick()      {}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &,
                        const MqlTradeResult &)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
      ExportHistory();
}

struct PosData {
   long     posId;
   string   symbol;
   string   type;
   double   size, openPrice, closePrice, sl, tp, swap, profit, commission;
   datetime openTime, closeTime;
   long     ticket;
};

void ExportHistory()
{
   if(!HistorySelect(0, TimeCurrent() + 86400)) return;
   int total = HistoryDealsTotal();

   PosData positions[];
   int posCount = 0;

   for(int i = 0; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;

      long dealType  = HistoryDealGetInteger(ticket, DEAL_TYPE);
      if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;

      long  entry   = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      long  posId   = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      datetime time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);

      int idx = -1;
      for(int j = 0; j < posCount; j++)
         if(positions[j].posId == posId) { idx = j; break; }

      if(idx == -1)
      {
         ArrayResize(positions, posCount + 1);
         idx = posCount++;
         positions[idx].posId      = posId;
         positions[idx].symbol     = HistoryDealGetString(ticket, DEAL_SYMBOL);
         positions[idx].type       = (dealType == DEAL_TYPE_BUY) ? "buy" : "sell";
         positions[idx].size       = 0;
         positions[idx].openPrice  = 0;
         positions[idx].closePrice = 0;
         positions[idx].sl         = 0;
         positions[idx].tp         = 0;
         positions[idx].openTime   = 0;
         positions[idx].closeTime  = 0;
         positions[idx].swap       = 0;
         positions[idx].profit     = 0;
         positions[idx].commission = 0;
         positions[idx].ticket     = (long)ticket;
      }

      if(entry == DEAL_ENTRY_IN)
      {
         positions[idx].openPrice = HistoryDealGetDouble(ticket, DEAL_PRICE);
         positions[idx].openTime  = time;
         positions[idx].size      = HistoryDealGetDouble(ticket, DEAL_VOLUME);
         double sl = HistoryDealGetDouble(ticket, DEAL_SL);
         double tp = HistoryDealGetDouble(ticket, DEAL_TP);
         if(sl != 0) positions[idx].sl = sl;
         if(tp != 0) positions[idx].tp = tp;
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
      {
         positions[idx].closePrice = HistoryDealGetDouble(ticket, DEAL_PRICE);
         positions[idx].closeTime  = time;
      }

      positions[idx].commission += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      positions[idx].swap       += HistoryDealGetDouble(ticket, DEAL_SWAP);
      positions[idx].profit     += HistoryDealGetDouble(ticket, DEAL_PROFIT);
   }

   int fh = FileOpen(InpFileName, FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
   if(fh == INVALID_HANDLE) { Print("Cannot open: ", InpFileName); return; }

   FileWrite(fh, "Ticket","Open Time","Type","Size","Symbol",
                 "Price","S/L","T/P","Close Time","Close Price",
                 "Swap","Profit","Commission");

   int written = 0;
   for(int i = 0; i < posCount; i++)
   {
      if(positions[i].openPrice == 0 || positions[i].closePrice == 0) continue;
      if(positions[i].closeTime == 0) continue;
      FileWrite(fh,
         IntegerToString(positions[i].ticket),
         TimeToString(positions[i].openTime,  TIME_DATE|TIME_SECONDS),
         positions[i].type,
         DoubleToString(positions[i].size, 2),
         positions[i].symbol,
         DoubleToString(positions[i].openPrice,  5),
         DoubleToString(positions[i].sl,  5),
         DoubleToString(positions[i].tp,  5),
         TimeToString(positions[i].closeTime, TIME_DATE|TIME_SECONDS),
         DoubleToString(positions[i].closePrice, 5),
         DoubleToString(positions[i].swap,       2),
         DoubleToString(positions[i].profit,     2),
         DoubleToString(positions[i].commission, 2)
      );
      written++;
   }

   FileClose(fh);
   Print("TradingJournal: ", written, " trades exported to ", InpFileName);
}`;

// ── Helpers ───────────────────────────────────────────────────────
function fmtAgo(ts: number): string {
  if (!ts) return 'never';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}min ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

const POLL_OPTIONS = [
  { v: 15, label: '15 s' },
  { v: 30, label: '30 s' },
  { v: 60, label: '1 min' },
  { v: 300, label: '5 min' },
];

// ── Step badge ────────────────────────────────────────────────────
function Step({ n, label, done }: { n: number; label: React.ReactNode; done?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <div style={{
        minWidth: 22, height: 22, borderRadius: '50%',
        backgroundColor: done ? '#00C47A' : '#3D8EF0',
        color: '#fff', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        {done ? '✓' : n}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{label}</div>
    </div>
  );
}

// ── EA code block — always accessible ────────────────────────────
function EACodeBlock() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(EA_SOURCE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-faint)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: show ? 10 : 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          Code EA MQL5 — à coller dans MetaTrader
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={copy}
            style={{
              padding: '5px 14px',
              backgroundColor: copied ? 'rgba(0,196,122,0.12)' : '#3D8EF0',
              border: copied ? '1px solid rgba(0,196,122,0.4)' : 'none',
              borderRadius: 5,
              color: copied ? '#00C47A' : '#fff',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copié !' : '⎘ Copier le code'}
          </button>
          <button
            onClick={() => setShow(v => !v)}
            style={{ padding: '5px 10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
          >
            {show ? 'Masquer' : 'Voir'}
          </button>
        </div>
      </div>
      {show && (
        <pre style={{
          padding: '10px 12px',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border-faint)',
          borderRadius: 6,
          fontSize: 10,
          fontFamily: '"JetBrains Mono", monospace',
          color: 'var(--text-secondary)',
          overflowX: 'auto',
          maxHeight: 240,
          overflowY: 'auto',
          lineHeight: 1.5,
          whiteSpace: 'pre',
          margin: 0,
        }}>
          {EA_SOURCE}
        </pre>
      )}
    </div>
  );
}

// ── Mac path helper ───────────────────────────────────────────────
const MAC_PATHS = [
  {
    label: 'Wine standard (MetaQuotes)',
    path: '~/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files',
  },
  {
    label: 'CrossOver',
    path: '~/Library/Application Support/CrossOver/Bottles/MetaTrader 5/drive_c/Program Files/MetaTrader 5/MQL5/Files',
  },
];

function MacPathBox() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copy = (path: string, idx: number) => {
    // Expand ~ to give the real path hint
    navigator.clipboard.writeText(path).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        Sur Mac, <strong style={{ color: 'var(--text-secondary)' }}>Open Data Folder n'ouvre pas le Finder</strong>.
        À la place : dans le Finder, appuie sur{' '}
        <kbd style={{ padding: '1px 5px', backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 3, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}>⌘ Shift G</kbd>
        {' '}et colle le chemin correspondant à ton installation :
      </div>
      {MAC_PATHS.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <div style={{
            flex: 1,
            padding: '6px 10px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-faint)',
            borderRadius: 5,
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{p.label}</span>
            {p.path}
          </div>
          <button
            onClick={() => copy(p.path, i)}
            style={{
              padding: '5px 10px',
              backgroundColor: copiedIdx === i ? 'rgba(0,196,122,0.12)' : 'var(--bg-surface-2)',
              border: `1px solid ${copiedIdx === i ? 'rgba(0,196,122,0.4)' : 'var(--border-default)'}`,
              borderRadius: 5,
              color: copiedIdx === i ? '#00C47A' : 'var(--text-secondary)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {copiedIdx === i ? '✓' : '⎘ Copier'}
          </button>
        </div>
      ))}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        Sur <strong>Windows</strong> : dans MT5, <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>File → Open Data Folder</code> fonctionne normalement — navigue ensuite dans <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>MQL5 → Files</code>.
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function MT5SyncSection() {
  const sync = useSyncStore();
  const accounts = useAccountsStore((s) => s.accounts).filter((a) => !a.archived);
  const [showEA, setShowEA] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => { /* force re-render for "X ago" */ }, 5000);
    return () => clearInterval(id);
  }, []);

  const copyEA = () => {
    navigator.clipboard.writeText(EA_SOURCE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!sync.supported) {
    return (
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
          MT5 AutoSync
        </div>
        <div style={{ padding: '12px 14px', backgroundColor: 'rgba(240,72,72,0.07)', border: '1px solid rgba(240,72,72,0.25)', borderRadius: 6, fontSize: 12, color: '#F04848', lineHeight: 1.6 }}>
          Ton navigateur ne supporte pas l'API File System Access. Utilise <strong>Chrome, Edge, Brave ou Opera sur desktop</strong>.
        </div>
      </div>
    );
  }

  const statusColor = sync.status === 'error' ? '#F04848'
    : sync.status === 'syncing' ? '#F0A030'
    : sync.status === 'no-permission' ? '#F0A030'
    : sync.enabled ? '#00C47A'
    : 'var(--text-muted)';

  const statusLabel = sync.status === 'error' ? 'Erreur'
    : sync.status === 'syncing' ? 'Sync…'
    : sync.status === 'no-permission' ? 'Permission manquante'
    : sync.enabled ? 'Actif'
    : 'Inactif';

  const folderReady = sync.hasHandle && sync.permission === 'granted';

  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          MT5 AutoSync
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor, boxShadow: folderReady && sync.enabled ? `0 0 5px ${statusColor}` : 'none' }} />
          <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        </div>
      </div>

      {/* ── Setup guide (shown until folder is picked) ── */}
      {!sync.hasHandle && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Configuration — à faire une seule fois
          </div>

          {/* Step 1 — install EA */}
          <Step n={1} label={
            <>
              <strong>Installe l'EA dans MT5</strong> — copie le code ci-dessous dans{' '}
              <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '1px 4px', backgroundColor: 'var(--bg-app)', borderRadius: 3 }}>
                File → Open Data Folder → MQL5 → Experts
              </code>{' '}
              sous le nom <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '1px 4px', backgroundColor: 'var(--bg-app)', borderRadius: 3 }}>TradingJournalExport.mq5</code>,
              puis attache-le à n'importe quel chart (ex: EURUSD M1).
            </>
          } />

          {/* EA copy block */}
          <div style={{ marginBottom: 12, marginLeft: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <button
                onClick={() => setShowEA((v) => !v)}
                style={{ background: 'none', border: 'none', color: '#3D8EF0', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                {showEA ? '▲ Masquer le code' : '▼ Afficher le code MQL5'}
              </button>
              <button
                onClick={copyEA}
                style={{
                  padding: '5px 14px',
                  backgroundColor: copied ? 'rgba(0,196,122,0.12)' : '#3D8EF0',
                  border: copied ? '1px solid rgba(0,196,122,0.4)' : 'none',
                  borderRadius: 5,
                  color: copied ? '#00C47A' : '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copié !' : '⎘ Copier le code'}
              </button>
            </div>
            {showEA && (
              <pre style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-faint)',
                borderRadius: 6,
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: 'var(--text-secondary)',
                overflowX: 'auto',
                maxHeight: 260,
                overflowY: 'auto',
                lineHeight: 1.5,
                whiteSpace: 'pre',
                margin: 0,
              }}>
                {EA_SOURCE}
              </pre>
            )}
          </div>

          {/* Step 2 — find the folder */}
          <Step n={2} label={
            <>
              <strong>Ouvre le dossier Files dans le Finder</strong>
              <MacPathBox />
            </>
          } />

          {/* Step 3 — pick folder */}
          <Step n={3} label={
            <>
              <strong>Sélectionne ce dossier ici</strong> — clique sur le bouton ci-dessous,
              navigue jusqu'au dossier <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '1px 4px', backgroundColor: 'var(--bg-app)', borderRadius: 3 }}>Files</code>{' '}
              que tu viens d'ouvrir, et valide.
            </>
          } />

          <div style={{ marginLeft: 32 }}>
            <button
              onClick={() => sync.pickFolder()}
              style={{
                padding: '9px 22px',
                backgroundColor: '#3D8EF0',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(61,142,240,0.35)',
              }}
            >
              📁 Sélectionner le dossier MQL5/Files
            </button>
          </div>
        </div>
      )}

      {/* ── Folder selected — condensed view ── */}
      {sync.hasHandle && (
        <>
          {/* Folder row */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Dossier MT5/Files
              </span>
              <button
                onClick={() => sync.clearFolder()}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Changer
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{
                flex: 1, padding: '8px 11px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                fontSize: 12,
                fontFamily: '"JetBrains Mono", monospace',
                color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: '#00C47A' }}>📁</span> {sync.folderName}
              </div>
              <button
                onClick={() => sync.pickFolder()}
                style={{ padding: '8px 14px', backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Rechoisir
              </button>
            </div>
          </div>

          {/* Permission warning */}
          {sync.permission !== 'granted' && (
            <div style={{ padding: '10px 12px', backgroundColor: 'rgba(240,160,48,0.07)', border: '1px solid rgba(240,160,48,0.3)', borderRadius: 6, fontSize: 12, color: '#F0A030', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span>⚠️ Autorisation de lecture requise.</span>
              <button
                onClick={() => sync.reauthorize()}
                style={{ padding: '4px 12px', backgroundColor: '#F0A030', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Autoriser
              </button>
            </div>
          )}

          {/* Settings grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Fréquence
              </label>
              <div style={{ display: 'flex', gap: 3, padding: 3, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6 }}>
                {POLL_OPTIONS.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => sync.setPollInterval(o.v)}
                    style={{
                      flex: 1, padding: '5px 4px', borderRadius: 4, border: 'none',
                      backgroundColor: sync.pollIntervalSec === o.v ? 'var(--bg-surface-3)' : 'transparent',
                      color: sync.pollIntervalSec === o.v ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: 11, fontWeight: sync.pollIntervalSec === o.v ? 600 : 400, cursor: 'pointer',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Importer vers
              </label>
              <select
                value={sync.targetAccountId}
                onChange={(e) => sync.setTargetAccountId(e.target.value)}
                style={{ width: '100%', padding: '7px 9px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">— Compte actif —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.broker ? ` · ${a.broker}` : ''}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Nom du fichier CSV
              </label>
              <input
                type="text"
                value={sync.filename}
                onChange={(e) => sync.setFilename(e.target.value)}
                placeholder="trading_journal.csv"
                style={{ width: '100%', padding: '7px 9px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {sync.enabled ? (
              <button
                onClick={() => sync.disable()}
                style={{ padding: '7px 16px', backgroundColor: 'rgba(240,72,72,0.10)', border: '1px solid rgba(240,72,72,0.4)', borderRadius: 5, color: '#F04848', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                ⏸ Pause
              </button>
            ) : (
              <button
                onClick={() => sync.enable()}
                disabled={sync.permission === 'denied'}
                style={{ padding: '7px 16px', backgroundColor: '#00C47A', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: sync.permission === 'denied' ? 0.4 : 1 }}
              >
                ▶ Démarrer AutoSync
              </button>
            )}
            <button
              onClick={() => sync.syncNow()}
              disabled={sync.status === 'syncing'}
              style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12, cursor: sync.status === 'syncing' ? 'wait' : 'pointer', opacity: sync.status === 'syncing' ? 0.5 : 1 }}
            >
              ↻ Sync maintenant
            </button>
          </div>

          {/* Error */}
          {sync.lastError && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: 'rgba(240,72,72,0.08)', border: '1px solid rgba(240,72,72,0.2)', borderRadius: 6, fontSize: 11, color: '#F04848', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {sync.lastError}
            </div>
          )}

          {/* Status panel */}
          <div style={{ marginTop: 14, padding: '12px 14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 6, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Dernier sync</span>
              <span style={{ color: 'var(--text-primary)' }}>{sync.lastSyncAt ? fmtAgo(sync.lastSyncAt) : 'jamais'}</span>
            </div>
            {sync.lastSyncAt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Dernier import</span>
                <span style={{ color: '#00C47A' }}>+{sync.lastImportedCount} nouveaux · {sync.lastDuplicateCount} doublons</span>
              </div>
            )}
            {!sync.lastSyncAt && sync.hasHandle && sync.permission === 'granted' && (
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                En attente du fichier <code>{sync.filename}</code>… L'EA doit être actif dans MT5.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── EA code — always visible ── */}
      <EACodeBlock />
    </div>
  );
}
