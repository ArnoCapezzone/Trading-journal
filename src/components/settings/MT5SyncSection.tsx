import { useState, useEffect } from 'react';
import { useSyncStore } from '../../store/syncStore';
import { useAccountsStore } from '../../lib/accountsStore';

// ── Updated MQL5 EA — sends trades via WebRequest ─────────────────
function buildEASource(webhookUrl: string, userId: string, token: string): string {
  return `//+------------------------------------------------------------------+
//|  TradingJournalSync.mq5                                          |
//|  Sends closed trades to Trading Journal via HTTP                 |
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "2.0"
#property description "Syncs closed positions to your Trading Journal app"

// ---- CONFIGURATION (auto-filled from your app) ------------------
input string WebhookURL = "${webhookUrl}";
input string UserID     = "${userId}";
input string Token      = "${token}";
// -----------------------------------------------------------------

void OnInit()      { SendTrades(); }
void OnDeinit(const int) {}
void OnTick()      {}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &,
                        const MqlTradeResult &)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
      SendTrades();
}

struct PosData {
   long     posId, ticket;
   string   symbol, type;
   double   size, openPrice, closePrice, sl, tp, swap, profit, commission;
   datetime openTime, closeTime;
};

void SendTrades()
{
   if(!HistorySelect(0, TimeCurrent() + 86400)) return;
   int total = HistoryDealsTotal();
   PosData positions[];
   int posCount = 0;

   for(int i = 0; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      long dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
      if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;
      long  entry  = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      long  posId  = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      datetime time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      int idx = -1;
      for(int j = 0; j < posCount; j++)
         if(positions[j].posId == posId) { idx = j; break; }
      if(idx == -1)
      {
         ArrayResize(positions, posCount + 1);
         idx = posCount++;
         positions[idx].posId = posId;
         positions[idx].ticket = (long)ticket;
         positions[idx].symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
         positions[idx].type   = (dealType == DEAL_TYPE_BUY) ? "buy" : "sell";
         positions[idx].size = positions[idx].openPrice = positions[idx].closePrice = 0;
         positions[idx].sl = positions[idx].tp = 0;
         positions[idx].openTime = positions[idx].closeTime = 0;
         positions[idx].swap = positions[idx].profit = positions[idx].commission = 0;
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

   // Build JSON
   string json = "[";
   int count = 0;
   for(int i = 0; i < posCount; i++)
   {
      if(positions[i].openPrice == 0 || positions[i].closePrice == 0) continue;
      if(positions[i].closeTime == 0) continue;
      if(count > 0) json += ",";
      json += "{";
      json += "\\"ticket\\":" + IntegerToString(positions[i].ticket) + ",";
      json += "\\"symbol\\":\\"" + positions[i].symbol + "\\",";
      json += "\\"type\\":\\"" + positions[i].type + "\\",";
      json += "\\"size\\":" + DoubleToString(positions[i].size, 2) + ",";
      json += "\\"open_price\\":" + DoubleToString(positions[i].openPrice, 5) + ",";
      json += "\\"close_price\\":" + DoubleToString(positions[i].closePrice, 5) + ",";
      json += "\\"sl\\":" + DoubleToString(positions[i].sl, 5) + ",";
      json += "\\"tp\\":" + DoubleToString(positions[i].tp, 5) + ",";
      json += "\\"open_time\\":\\"" + TimeToString(positions[i].openTime, TIME_DATE|TIME_SECONDS) + "\\",";
      json += "\\"close_time\\":\\"" + TimeToString(positions[i].closeTime, TIME_DATE|TIME_SECONDS) + "\\",";
      json += "\\"swap\\":" + DoubleToString(positions[i].swap, 2) + ",";
      json += "\\"profit\\":" + DoubleToString(positions[i].profit, 2) + ",";
      json += "\\"commission\\":" + DoubleToString(positions[i].commission, 2);
      json += "}";
      count++;
   }
   json += "]";

   string body = "{\\"userId\\":\\"" + UserID + "\\",\\"token\\":\\"" + Token + "\\",\\"trades\\":" + json + "}";
   string headers = "Content-Type: application/json\\r\\n";
   char bodyArr[], result[];
   StringToCharArray(body, bodyArr, 0, StringLen(body));
   string resHeaders;
   int code = WebRequest("POST", WebhookURL, headers, 5000, bodyArr, result, resHeaders);
   if(code == 200)
      Print("TradingJournal: ", count, " trades synced successfully");
   else
      Print("TradingJournal sync error: HTTP ", code, " — add ", WebhookURL, " to allowed URLs in Tools > Options > Expert Advisors");
}`;
}

const PLACEHOLDER_EA = buildEASource(
  'https://your-app.vercel.app/api/mt5sync',
  'YOUR_USER_ID',
  'YOUR_TOKEN'
);

// ── Helpers ───────────────────────────────────────────────────────
function fmtAgo(ts: number): string {
  if (!ts) return 'jamais';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5) return 'à l\'instant';
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  return `${Math.round(diff / 3600)}h`;
}

const POLL_OPTIONS = [
  { v: 60,   label: '1 min' },
  { v: 300,  label: '5 min' },
  { v: 900,  label: '15 min' },
  { v: 3600, label: '1 h' },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        padding: '4px 12px',
        backgroundColor: copied ? 'rgba(0,196,122,0.12)' : 'var(--bg-surface-2)',
        border: `1px solid ${copied ? 'rgba(0,196,122,0.4)' : 'var(--border-default)'}`,
        borderRadius: 5,
        color: copied ? '#00C47A' : 'var(--text-secondary)',
        fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {copied ? '✓ Copié' : `⎘ ${label}`}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function MT5SyncSection() {
  const sync = useSyncStore();
  const accounts = useAccountsStore((s) => s.accounts).filter((a) => !a.archived);
  const [showEA, setShowEA] = useState(false);

  useEffect(() => {
    const id = setInterval(() => { /* re-render for "X ago" */ }, 10_000);
    return () => clearInterval(id);
  }, []);

  const webhookUrl = `${window.location.origin}/api/mt5sync`;
  const eaSource = sync.creds
    ? buildEASource(webhookUrl, sync.creds.userId, sync.creds.token)
    : PLACEHOLDER_EA;

  const statusColor = sync.status === 'error' ? '#F04848'
    : sync.status === 'syncing' ? '#F0A030'
    : sync.status === 'disconnected' ? 'var(--text-muted)'
    : sync.enabled ? '#00C47A'
    : 'var(--text-muted)';

  const statusLabel = sync.status === 'error' ? 'Erreur'
    : sync.status === 'syncing' ? 'Sync…'
    : sync.status === 'disconnected' ? 'Non connecté'
    : sync.enabled ? 'Actif'
    : 'En pause';

  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          MT5 AutoSync
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor, boxShadow: sync.enabled && sync.status === 'idle' ? `0 0 5px ${statusColor}` : 'none' }} />
          <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        </div>
      </div>

      {/* Loading */}
      {sync.loadingCreds && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Chargement du token…</div>
      )}

      {/* ── Step 1: Supabase setup reminder (shown until creds loaded) ── */}
      {!sync.creds && !sync.loadingCreds && (
        <div style={{ padding: '12px 14px', backgroundColor: 'rgba(240,160,48,0.07)', border: '1px solid rgba(240,160,48,0.3)', borderRadius: 6, fontSize: 12, color: '#F0A030', lineHeight: 1.7, marginBottom: 16 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Setup requis</strong>
          Crée la table Supabase et ajoute la variable Vercel — voir les instructions ci-dessous.
        </div>
      )}

      {/* ── Webhook info (once creds loaded) ── */}
      {sync.creds && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Ton endpoint
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ flex: 1, padding: '7px 10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 5, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {webhookUrl}
            </div>
            <CopyButton text={webhookUrl} label="URL" />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1, padding: '7px 10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 5, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sync.creds.token}
            </div>
            <CopyButton text={sync.creds.token} label="Token" />
          </div>
        </div>
      )}

      {/* ── Sync controls (once creds loaded) ── */}
      {sync.creds && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fréquence</label>
              <div style={{ display: 'flex', gap: 3, padding: 3, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6 }}>
                {POLL_OPTIONS.map((o) => (
                  <button key={o.v} onClick={() => sync.setPollInterval(o.v)} style={{ flex: 1, padding: '5px 4px', borderRadius: 4, border: 'none', backgroundColor: sync.pollIntervalSec === o.v ? 'var(--bg-surface-3)' : 'transparent', color: sync.pollIntervalSec === o.v ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 11, fontWeight: sync.pollIntervalSec === o.v ? 600 : 400, cursor: 'pointer' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Importer vers</label>
              <select value={sync.targetAccountId} onChange={(e) => sync.setTargetAccountId(e.target.value)} style={{ width: '100%', padding: '7px 9px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Compte actif —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.broker ? ` · ${a.broker}` : ''}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sync.enabled ? (
              <button onClick={() => sync.disable()} style={{ padding: '7px 16px', backgroundColor: 'rgba(240,72,72,0.10)', border: '1px solid rgba(240,72,72,0.4)', borderRadius: 5, color: '#F04848', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ⏸ Pause
              </button>
            ) : (
              <button onClick={() => sync.enable()} style={{ padding: '7px 16px', backgroundColor: '#00C47A', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ▶ Démarrer AutoSync
              </button>
            )}
            <button onClick={() => sync.syncNow()} disabled={sync.status === 'syncing'} style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12, cursor: sync.status === 'syncing' ? 'wait' : 'pointer', opacity: sync.status === 'syncing' ? 0.5 : 1 }}>
              ↻ Sync maintenant
            </button>
          </div>

          {sync.lastError && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: 'rgba(240,72,72,0.08)', border: '1px solid rgba(240,72,72,0.2)', borderRadius: 6, fontSize: 11, color: '#F04848', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {sync.lastError}
            </div>
          )}

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
          </div>
        </>
      )}

      {/* ── EA code — always visible ── */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-faint)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showEA ? 10 : 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            Code EA MQL5 {sync.creds ? <span style={{ color: '#00C47A', fontSize: 10 }}>● token inclus</span> : <span style={{ color: '#F0A030', fontSize: 10 }}>⚠ connecte-toi d'abord</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <CopyButton text={eaSource} label="Copier le code" />
            <button onClick={() => setShowEA(v => !v)} style={{ padding: '4px 10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              {showEA ? 'Masquer' : 'Voir'}
            </button>
          </div>
        </div>
        {showEA && (
          <pre style={{ padding: '10px 12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 6, fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)', overflowX: 'auto', maxHeight: 240, overflowY: 'auto', lineHeight: 1.5, whiteSpace: 'pre', margin: 0 }}>
            {eaSource}
          </pre>
        )}

        {/* Setup instructions */}
        <div style={{ marginTop: 12, padding: '12px 14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 6, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Setup (une seule fois)</strong>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>1. Supabase</strong> — va sur{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#3D8EF0' }}>supabase.com/dashboard</a>
            {' '}→ ton projet → <strong>SQL Editor</strong> → colle et exécute :
          </div>
          <pre style={{ padding: '8px 10px', backgroundColor: 'var(--bg-surface)', borderRadius: 5, fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-secondary)', margin: '4px 0 10px', whiteSpace: 'pre', overflowX: 'auto' }}>
{`create table if not exists mt5_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trades  jsonb not null default '[]',
  synced_at timestamptz default now()
);
alter table mt5_sync enable row level security;
create policy "own" on mt5_sync for all using (auth.uid() = user_id);`}
          </pre>
          <div style={{ marginBottom: 4 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>2. Vercel</strong> — va sur{' '}
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: '#3D8EF0' }}>vercel.com/dashboard</a>
            {' '}→ ton projet → Settings → Environment Variables → ajoute :
            <br />
            <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, padding: '1px 4px', backgroundColor: 'var(--bg-surface)', borderRadius: 3 }}>SUPABASE_SERVICE_ROLE_KEY</code>
            {' '}= clé <em>service_role</em> depuis Supabase → Settings → API → puis redéploie.
          </div>
          <div>
            <strong style={{ color: 'var(--text-secondary)' }}>3. MT5</strong> — copie le code EA ci-dessus → colle dans l'éditeur MT5 (F4) → compile (F7) → attache au chart → dans MT5 :{' '}
            <strong>Tools → Options → Expert Advisors</strong> → coche <em>"Allow WebRequests"</em> et ajoute l'URL de ton app.
          </div>
        </div>
      </div>
    </div>
  );
}
