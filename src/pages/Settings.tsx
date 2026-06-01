import { useState, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useTradesStore } from '../store/tradesStore';
import { useAuthStore } from '../store/authStore';
import { exportToJSON, importFromJSON } from '../utils/exportUtils';
import { supabase } from '../lib/supabase';
import { downloadBackup, restoreLocalData, getLocalDataSummary } from '../lib/localBackup';
import { useThemeStore, type ThemePreference } from '../store/themeStore';

const INSTRUMENTS = ['EURUSD', 'GBPUSD', 'NZDUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'USDJPY', 'GBPJPY', 'EURJPY', 'NAS100', 'US500', 'XAUUSD'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 24 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{sublabel}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function Settings() {
  const {
    accountBalance,
    currency,
    balanceMode,
    favoriteInstruments,
    updateSetting,
  } = useSettingsStore();

  const { trades, loadTrades } = useTradesStore();
  const { user, signOut } = useAuthStore();
  const { preference: themePref, resolved: themeResolved, setPreference: setThemePref } = useThemeStore();

  const [localBalance, setLocalBalance] = useState(String(accountBalance));
  const [resetInput, setResetInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [localBackupMsg, setLocalBackupMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const localBackupFileRef = useRef<HTMLInputElement>(null);

  const localSummary = getLocalDataSummary();
  const totalLocalSize = localSummary.reduce((s, x) => s + x.size, 0);

  async function handleLocalRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('This will OVERWRITE your current playbooks, goals, plans, and mentor chats with the backup file. Continue?')) {
      if (localBackupFileRef.current) localBackupFileRef.current.value = '';
      return;
    }
    try {
      const text = await file.text();
      const result = restoreLocalData(text);
      if (result.ok) {
        setLocalBackupMsg(`✓ Restored ${result.keysRestored.length} data sections. Reload to see changes.`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setLocalBackupMsg(`Error: ${result.errors.join('; ')}`);
      }
    } catch (err) {
      setLocalBackupMsg(`Error: ${String(err)}`);
    }
    if (localBackupFileRef.current) localBackupFileRef.current.value = '';
  }

  function handleBalanceSave() {
    const val = parseFloat(localBalance);
    if (!isNaN(val) && val > 0) {
      updateSetting('accountBalance', val);
    }
  }

  function toggleFavorite(instr: string) {
    const set = new Set(favoriteInstruments);
    if (set.has(instr)) set.delete(instr);
    else set.add(instr);
    updateSetting('favoriteInstruments', Array.from(set));
  }

  async function handleReset() {
    if (resetInput !== 'RESET') return;
    await supabase.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await loadTrades();
    setShowResetConfirm(false);
    setResetInput('');
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const imported = importFromJSON(content);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');
      const rows = imported.map((t) => ({ ...t, user_id: currentUser.id, id: t.id }));
      await supabase.from('trades').upsert(rows);
      await loadTrades();
      setImportMsg(`✓ Restored ${imported.length} trades`);
      setTimeout(() => setImportMsg(''), 4000);
    } catch (err) {
      setImportMsg(`Error: ${String(err)}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-default)',
    borderRadius: 5,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: '"JetBrains Mono", monospace',
    outline: 'none',
  };

  function RadioGroup({ options, value, onChange }: { options: { v: string; label: string }[]; value: string; onChange: (v: string) => void }) {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              padding: '6px 14px',
              borderRadius: 5,
              border: `1px solid ${value === o.v ? '#3D8EF0' : 'var(--border-default)'}`,
              backgroundColor: value === o.v ? 'rgba(77,158,255,0.15)' : 'transparent',
              color: value === o.v ? '#3D8EF0' : 'var(--text-tertiary)',
              fontSize: 12,
              fontWeight: value === o.v ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      {/* Logged-in user */}
      <Section title="Account">
        <Row label="Signed in as" sublabel="Your trades are synced to this account">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'var(--text-primary)' }}>
              {user?.email}
            </span>
            <button
              onClick={signOut}
              style={{
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                color: 'var(--text-tertiary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </Row>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Row
          label="Theme"
          sublabel={`Currently ${themeResolved === 'dark' ? 'dark' : 'light'} mode${themePref === 'system' ? ' (auto from system)' : ''}`}
        >
          <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 7, padding: 3 }}>
            {([
              { v: 'system', label: 'Auto' },
              { v: 'light', label: 'Light' },
              { v: 'dark', label: 'Dark' },
            ] as { v: ThemePreference; label: string }[]).map((opt) => {
              const active = themePref === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => setThemePref(opt.v)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 5,
                    border: 'none',
                    backgroundColor: active ? 'var(--bg-surface-3)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Row>
      </Section>

      {/* Balance */}
      <Section title="Trading Account">
        <Row label="Account Balance" sublabel="Used to calculate P&L % and risk metrics">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              value={localBalance}
              onChange={(e) => setLocalBalance(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
              onBlur={handleBalanceSave}
              onKeyDown={(e) => e.key === 'Enter' && handleBalanceSave()}
            />
            <select
              value={currency}
              onChange={(e) => updateSetting('currency', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </Row>

        <Row
          label="Balance Mode"
          sublabel="Fixed: always use the balance above. Dynamic: use balance at trade entry time."
        >
          <RadioGroup
            options={[{ v: 'fixed', label: 'Fixed' }, { v: 'dynamic', label: 'Dynamic' }]}
            value={balanceMode}
            onChange={(v) => updateSetting('balanceMode', v)}
          />
        </Row>
      </Section>

      {/* Instruments */}
      <Section title="Favorite Instruments">
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          Quick-access instruments shown first in dropdowns
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INSTRUMENTS.map((instr) => {
            const active = favoriteInstruments.includes(instr);
            return (
              <button
                key={instr}
                onClick={() => toggleFavorite(instr)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: `1px solid ${active ? '#3D8EF0' : 'var(--border-default)'}`,
                  backgroundColor: active ? 'rgba(77,158,255,0.12)' : 'transparent',
                  color: active ? '#3D8EF0' : 'var(--text-tertiary)',
                  fontSize: 11,
                  fontFamily: '"JetBrains Mono", monospace',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {instr}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Data */}
      <Section title="Data Management">
        <Row label="Export Backup" sublabel="Download a full JSON backup of all trades">
          <button
            onClick={() => exportToJSON(trades)}
            disabled={trades.length === 0}
            style={{
              padding: '7px 16px',
              backgroundColor: 'var(--bg-surface-2)',
              border: '1px solid var(--border-default)',
              borderRadius: 5,
              color: trades.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 12,
              cursor: trades.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            💾 Export Backup ({trades.length} trades)
          </button>
        </Row>

        <Row label="Import Backup" sublabel="Restore trades from a previously exported JSON backup">
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '7px 16px',
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              📂 Import from Backup
            </button>
            {importMsg && (
              <div style={{ marginTop: 6, fontSize: 11, color: importMsg.startsWith('Error') ? '#F04848' : '#00C47A' }}>
                {importMsg}
              </div>
            )}
            <input ref={fileRef} type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </div>
        </Row>

        <Row
          label="Reset All Data"
          sublabel="Permanently delete all trades. This action cannot be undone."
        >
          <div>
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  padding: '7px 16px',
                  backgroundColor: 'rgba(255,77,77,0.1)',
                  border: '1px solid #F04848',
                  borderRadius: 5,
                  color: '#F04848',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                🗑 Reset All Data
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ fontSize: 11, color: '#F04848' }}>Type <strong>RESET</strong> to confirm:</div>
                <input
                  type="text"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder="Type RESET"
                  style={{
                    ...inputStyle,
                    width: 120,
                    borderColor: resetInput === 'RESET' ? '#F04848' : 'var(--border-default)',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setShowResetConfirm(false); setResetInput(''); }}
                    style={{ padding: '5px 12px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={resetInput !== 'RESET'}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: resetInput === 'RESET' ? '#F04848' : 'var(--bg-surface-2)',
                      border: 'none',
                      borderRadius: 4,
                      color: resetInput === 'RESET' ? 'var(--bg-app)' : 'var(--text-tertiary)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: resetInput === 'RESET' ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Delete All
                  </button>
                </div>
              </div>
            )}
          </div>
        </Row>
      </Section>

      {/* Local Data Backup */}
      <Section title="Local Data Backup">
        <Row
          label="Backup Playbooks, Goals, Plans, Mentor chats"
          sublabel="These are stored only in your browser. Export regularly to avoid loss if you clear cache or switch devices."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <button
              onClick={downloadBackup}
              disabled={localSummary.length === 0}
              style={{
                padding: '7px 16px',
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                color: localSummary.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12,
                cursor: localSummary.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ⬇ Download local backup ({(totalLocalSize / 1024).toFixed(1)} KB)
            </button>
            <button
              onClick={() => localBackupFileRef.current?.click()}
              style={{
                padding: '7px 16px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ⬆ Restore from backup
            </button>
            <input ref={localBackupFileRef} type="file" accept=".json" onChange={handleLocalRestore} style={{ display: 'none' }} />
            {localBackupMsg && (
              <div style={{ fontSize: 11, color: localBackupMsg.startsWith('Error') ? '#F04848' : '#00C47A' }}>
                {localBackupMsg}
              </div>
            )}
          </div>
        </Row>

        {localSummary.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Currently stored locally
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {localSummary.map((item) => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{item.label}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {item.count} item{item.count !== 1 ? 's' : ''} · {(item.size / 1024).toFixed(2)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* About */}
      <Section title="About">
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
          <div><strong style={{ color: 'var(--text-primary)' }}>Trading Journal</strong> v1.0.0</div>
          <div>Local-first trading performance tracker. All data stored in your browser (IndexedDB).</div>
          <div style={{ marginTop: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
            Stack: React 18 + TypeScript + Dexie + Zustand + Chart.js
          </div>
        </div>
      </Section>
    </div>
  );
}
