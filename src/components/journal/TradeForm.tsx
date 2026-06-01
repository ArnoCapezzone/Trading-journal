import { useState, useEffect } from 'react';
import type { Trade, TradeDirection, SetupType, Timeframe } from '../../types/trade';
import { calculateTrade } from '../../utils/calculations';
import { useSettingsStore } from '../../store/settingsStore';
import { listPlaybooks, getTradePlaybookId, assignPlaybook, type Playbook } from '../../lib/playbooksStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface Props {
  initialData?: Trade;
  onSubmit: (data: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const INSTRUMENTS = ['EURUSD', 'GBPUSD', 'NZDUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'USDJPY', 'GBPJPY', 'EURJPY', 'NAS100', 'US500', 'XAUUSD'];
const SETUPS: SetupType[] = ['BREAKOUT', 'REVERSAL', 'SUPPORT_RESISTANCE', 'TREND_FOLLOWING', 'RANGE', 'NEWS', 'OTHER'];
const TIMEFRAMES: Timeframe[] = ['1M', '5M', '15M', '30M', '1H', '4H', 'D', 'W'];

function toDatetimeLocal(d?: Date): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function inputStyle(hasError = false): React.CSSProperties {
  return {
    width: '100%',
    padding: '7px 10px',
    backgroundColor: 'var(--bg-app)',
    border: `1px solid ${hasError ? '#F04848' : 'var(--border-default)'}`,
    borderRadius: 5,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-tertiary)',
    fontWeight: 500,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-default)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 12 }}>
      {children}
    </div>
  );
}

export default function TradeForm({ initialData, onSubmit, onCancel }: Props) {
  const accountBalance = useSettingsStore((s) => s.accountBalance);
  const isMobile = useIsMobile();

  // Form state
  const [instrument, setInstrument] = useState(initialData?.instrument ?? 'EURUSD');
  const [direction, setDirection] = useState<TradeDirection>(initialData?.direction ?? 'LONG');
  const [entryTime, setEntryTime] = useState(toDatetimeLocal(initialData?.entryTime));
  const [exitTime, setExitTime] = useState(toDatetimeLocal(initialData?.exitTime));
  const [entryPrice, setEntryPrice] = useState(String(initialData?.entryPrice ?? ''));
  const [exitPrice, setExitPrice] = useState(String(initialData?.exitPrice ?? ''));
  const [lotSize, setLotSize] = useState(String(initialData?.lotSize ?? ''));
  const [stopLoss, setStopLoss] = useState(String(initialData?.stopLoss ?? ''));
  const [takeProfit, setTakeProfit] = useState(String(initialData?.takeProfit ?? ''));
  const [commission, setCommission] = useState(String(initialData?.commission ?? '0'));
  const [swap, setSwap] = useState(String(initialData?.swap ?? '0'));
  const [timeframe, setTimeframe] = useState<Timeframe | ''>(initialData?.timeframe ?? '');
  const [setup, setSetup] = useState<SetupType | ''>(initialData?.setup ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [chartImage, setChartImage] = useState<string | undefined>(initialData?.chartImageBase64);
  const [status, setStatus] = useState<'COMPLETE' | 'PENDING_REVIEW'>(initialData?.status ?? 'COMPLETE');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Playbooks
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbookId, setPlaybookId] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    setPlaybooks(listPlaybooks());
    if (initialData?.id) {
      const pid = getTradePlaybookId(initialData.id);
      if (pid) setPlaybookId(pid);
    }
  }, [initialData?.id]);

  const activePlaybook = playbooks.find((p) => p.id === playbookId) ?? null;

  // Live preview
  const previewTrade: Partial<Trade> = {
    instrument,
    direction,
    entryPrice: parseFloat(entryPrice) || 0,
    exitPrice: parseFloat(exitPrice) || 0,
    entryTime: entryTime ? new Date(entryTime) : new Date(),
    exitTime: exitTime ? new Date(exitTime) : new Date(),
    lotSize: parseFloat(lotSize) || 0,
    stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
    commission: parseFloat(commission) || 0,
    swap: parseFloat(swap) || 0,
    accountBalanceAtEntry: accountBalance,
  };

  const canPreview = previewTrade.entryPrice! > 0 && previewTrade.exitPrice! > 0 && previewTrade.lotSize! > 0;
  const preview = canPreview ? calculateTrade(previewTrade as Trade, accountBalance) : null;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!instrument.trim()) errs.instrument = 'Required';
    if (!entryPrice || isNaN(parseFloat(entryPrice))) errs.entryPrice = 'Required';
    if (!exitPrice || isNaN(parseFloat(exitPrice))) errs.exitPrice = 'Required';
    if (!entryTime) errs.entryTime = 'Required';
    if (!exitTime) errs.exitTime = 'Required';
    if (!lotSize || isNaN(parseFloat(lotSize)) || parseFloat(lotSize) <= 0) errs.lotSize = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // Persist playbook assignment if trade has an id (edit mode)
    // For new trades, we'll need to assign post-creation; we save the
    // pending playbookId to a session map and the parent handles it via onSubmit completion.
    // Simplest: store under tradeId once we have it. For now, assign after create
    // by relying on the fact that initialData.id exists on edit.
    if (initialData?.id) {
      assignPlaybook(initialData.id, playbookId || null);
    } else {
      // For new trades, stash the chosen playbook in sessionStorage so the
      // submit handler can pick it up after Supabase returns the new id.
      if (playbookId) sessionStorage.setItem('tj_pending_playbook', playbookId);
      else sessionStorage.removeItem('tj_pending_playbook');
    }
    onSubmit({
      source: initialData?.source ?? 'MANUAL',
      status,
      instrument: instrument.trim().toUpperCase(),
      direction,
      entryPrice: parseFloat(entryPrice),
      exitPrice: parseFloat(exitPrice),
      entryTime: new Date(entryTime),
      exitTime: new Date(exitTime),
      lotSize: parseFloat(lotSize),
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      commission: parseFloat(commission) || 0,
      swap: parseFloat(swap) || 0,
      timeframe: timeframe || undefined,
      setup: setup || undefined,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      chartImageBase64: chartImage,
      accountBalanceAtEntry: accountBalance,
      mt5TicketId: initialData?.mt5TicketId,
    });
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!tags.includes(tag)) setTags((t) => [...t, tag]);
      setTagInput('');
    }
  }

  function handleImageUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setChartImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  const monoInput: React.CSSProperties = { ...inputStyle(), fontFamily: '"JetBrains Mono", monospace' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 220px', gap: 20 }}>
      {/* Main form */}
      <div>
        <Section title="A — Trade Data">
          <FormRow>
            <div>
              <label style={labelStyle()}>Instrument *</label>
              <div style={{ position: 'relative' }}>
                <input
                  list="instruments-list"
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value.toUpperCase())}
                  style={{ ...monoInput, borderColor: errors.instrument ? '#F04848' : 'var(--border-default)' }}
                  placeholder="e.g. EURUSD"
                />
                <datalist id="instruments-list">
                  {INSTRUMENTS.map((i) => <option key={i} value={i} />)}
                </datalist>
              </div>
              {errors.instrument && <div style={{ fontSize: 10, color: '#F04848', marginTop: 3 }}>{errors.instrument}</div>}
            </div>
            <div>
              <label style={labelStyle()}>Direction *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['LONG', 'SHORT'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    style={{
                      flex: 1,
                      padding: '7px',
                      borderRadius: 5,
                      border: `1px solid ${direction === d ? (d === 'LONG' ? '#00C47A' : '#F04848') : 'var(--border-default)'}`,
                      backgroundColor: direction === d ? (d === 'LONG' ? 'rgba(0,209,122,0.15)' : 'rgba(255,77,77,0.15)') : 'var(--bg-app)',
                      color: direction === d ? (d === 'LONG' ? '#00C47A' : '#F04848') : 'var(--text-tertiary)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                  </button>
                ))}
              </div>
            </div>
          </FormRow>

          <FormRow>
            <div>
              <label style={labelStyle()}>Entry Time *</label>
              <input
                type="datetime-local"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                style={{ ...inputStyle(!!errors.entryTime), fontFamily: '"JetBrains Mono", monospace' }}
              />
              {errors.entryTime && <div style={{ fontSize: 10, color: '#F04848', marginTop: 3 }}>{errors.entryTime}</div>}
            </div>
            <div>
              <label style={labelStyle()}>Exit Time *</label>
              <input
                type="datetime-local"
                value={exitTime}
                onChange={(e) => setExitTime(e.target.value)}
                style={{ ...inputStyle(!!errors.exitTime), fontFamily: '"JetBrains Mono", monospace' }}
              />
              {errors.exitTime && <div style={{ fontSize: 10, color: '#F04848', marginTop: 3 }}>{errors.exitTime}</div>}
            </div>
          </FormRow>

          <FormRow cols={3}>
            <div>
              <label style={labelStyle()}>Entry Price *</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                style={{ ...monoInput, borderColor: errors.entryPrice ? '#F04848' : 'var(--border-default)' }}
                placeholder="1.08500"
              />
              {errors.entryPrice && <div style={{ fontSize: 10, color: '#F04848', marginTop: 3 }}>{errors.entryPrice}</div>}
            </div>
            <div>
              <label style={labelStyle()}>Exit Price *</label>
              <input
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                style={{ ...monoInput, borderColor: errors.exitPrice ? '#F04848' : 'var(--border-default)' }}
                placeholder="1.09200"
              />
              {errors.exitPrice && <div style={{ fontSize: 10, color: '#F04848', marginTop: 3 }}>{errors.exitPrice}</div>}
            </div>
            <div>
              <label style={labelStyle()}>Lot Size *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                style={{ ...monoInput, borderColor: errors.lotSize ? '#F04848' : 'var(--border-default)' }}
                placeholder="0.10"
              />
              {errors.lotSize && <div style={{ fontSize: 10, color: '#F04848', marginTop: 3 }}>{errors.lotSize}</div>}
            </div>
          </FormRow>

          <FormRow cols={4}>
            <div>
              <label style={labelStyle()}>Stop Loss</label>
              <input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} style={monoInput} placeholder="Optional" />
            </div>
            <div>
              <label style={labelStyle()}>Take Profit</label>
              <input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} style={monoInput} placeholder="Optional" />
            </div>
            <div>
              <label style={labelStyle()}>Commission</label>
              <input type="number" step="any" value={commission} onChange={(e) => setCommission(e.target.value)} style={monoInput} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle()}>Swap</label>
              <input type="number" step="any" value={swap} onChange={(e) => setSwap(e.target.value)} style={monoInput} placeholder="0" />
            </div>
          </FormRow>

          <FormRow>
            <div>
              <label style={labelStyle()}>Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['COMPLETE', 'PENDING_REVIEW'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    style={{
                      flex: 1,
                      padding: '7px',
                      borderRadius: 5,
                      border: `1px solid ${status === s ? (s === 'COMPLETE' ? '#00C47A' : '#F0A030') : 'var(--border-default)'}`,
                      backgroundColor: status === s ? (s === 'COMPLETE' ? 'rgba(0,209,122,0.12)' : 'rgba(255,154,60,0.12)') : 'var(--bg-app)',
                      color: status === s ? (s === 'COMPLETE' ? '#00C47A' : '#F0A030') : 'var(--text-tertiary)',
                      fontWeight: 600,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {s === 'COMPLETE' ? '✓ Complete' : '⚠ Pending Review'}
                  </button>
                ))}
              </div>
            </div>
          </FormRow>
        </Section>

        <Section title="B — Context">
          <FormRow>
            <div>
              <label style={labelStyle()}>Timeframe</label>
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe | '')} style={{ ...inputStyle(), cursor: 'pointer' }}>
                <option value="">— Select —</option>
                {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle()}>Setup</label>
              <select value={setup} onChange={(e) => setSetup(e.target.value as SetupType | '')} style={{ ...inputStyle(), cursor: 'pointer' }}>
                <option value="">— Select —</option>
                {SETUPS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </FormRow>

          {/* Playbook selector */}
          {playbooks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle()}>Strategy Playbook</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={playbookId}
                  onChange={(e) => { setPlaybookId(e.target.value); setCheckedItems(new Set()); }}
                  style={{ ...inputStyle(), cursor: 'pointer', flex: 1 }}
                >
                  <option value="">— None —</option>
                  {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {activePlaybook && (
                  <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: activePlaybook.color, flexShrink: 0 }} />
                )}
              </div>

              {/* Inline checklist */}
              {activePlaybook && activePlaybook.checklist.length > 0 && (
                <div style={{ marginTop: 10, padding: '10px 12px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Pre-trade checklist
                    </div>
                    <div style={{ fontSize: 10, color: checkedItems.size === activePlaybook.checklist.length ? '#00C47A' : '#F0A030', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
                      {checkedItems.size}/{activePlaybook.checklist.length}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {activePlaybook.checklist.map((item, idx) => {
                      const checked = checkedItems.has(idx);
                      return (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: checked ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: checked ? 'line-through' : 'none' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = new Set(checkedItems);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              setCheckedItems(next);
                            }}
                            style={{ accentColor: activePlaybook.color, cursor: 'pointer' }}
                          />
                          {item}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle()}>Notes <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>{notes.length}/500</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              placeholder="Trade notes, observations, lessons learned..."
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle()}>Tags (press Enter to add)</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              style={inputStyle()}
              placeholder="e.g. morning, london, news..."
            />
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      backgroundColor: 'rgba(77,158,255,0.12)',
                      border: '1px solid rgba(77,158,255,0.3)',
                      borderRadius: 3,
                      fontSize: 11,
                      color: '#3D8EF0',
                    }}
                  >
                    {tag}
                    <span
                      onClick={() => setTags((t) => t.filter((x) => x !== tag))}
                      style={{ cursor: 'pointer', opacity: 0.7, lineHeight: 1 }}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Screenshot upload */}
          <div>
            <label style={labelStyle()}>Chart Screenshot (max 2MB)</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleImageUpload(file);
              }}
              style={{
                border: '2px dashed var(--border-default)',
                borderRadius: 6,
                padding: chartImage ? 0 : '20px',
                textAlign: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
              onClick={() => {
                const inp = document.createElement('input');
                inp.type = 'file';
                inp.accept = 'image/*';
                inp.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleImageUpload(file);
                };
                inp.click();
              }}
            >
              {chartImage ? (
                <div style={{ position: 'relative' }}>
                  <img src={chartImage} alt="Chart" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setChartImage(undefined); }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      border: '1px solid #F04848',
                      borderRadius: 4,
                      color: '#F04848',
                      padding: '3px 7px',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                  <div>Drag & drop or click to upload</div>
                  <div style={{ fontSize: 10, marginTop: 4 }}>PNG, JPG, WEBP — max 2MB</div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 20px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              color: 'var(--text-tertiary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '9px 24px',
              backgroundColor: '#3D8EF0',
              border: 'none',
              borderRadius: 6,
              color: 'var(--text-on-accent)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {initialData ? 'Save Changes' : 'Add Trade'}
          </button>
        </div>
      </div>

      {/* Preview panel */}
      <div>
        <div
          style={{
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            padding: 16,
            position: 'sticky',
            top: 80,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Live Preview
          </div>

          {!canPreview ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
              Fill in prices and lot size
            </div>
          ) : preview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PreviewRow label="P&L" value={`${preview.pnlDollar >= 0 ? '+' : ''}$${preview.pnlDollar.toFixed(2)}`} color={preview.pnlDollar >= 0 ? '#00C47A' : '#F04848'} large />
              {preview.pnlPercent !== null && (
                <PreviewRow label="P&L %" value={`${preview.pnlPercent >= 0 ? '+' : ''}${preview.pnlPercent.toFixed(2)}%`} color={preview.pnlPercent >= 0 ? '#00C47A' : '#F04848'} />
              )}
              <PreviewRow label="Pips" value={`${preview.pnlPips >= 0 ? '+' : ''}${preview.pnlPips.toFixed(1)}`} color={preview.pnlPips >= 0 ? '#00C47A' : '#F04848'} />
              {preview.rrRatio !== null && (
                <PreviewRow label="R:R" value={`${preview.rrRatio.toFixed(2)}R`} color={preview.rrRatio >= 1 ? '#00C47A' : '#F0A030'} />
              )}
              <PreviewRow
                label="Duration"
                value={
                  preview.durationMinutes < 60
                    ? `${preview.durationMinutes}m`
                    : `${Math.floor(preview.durationMinutes / 60)}h ${preview.durationMinutes % 60}m`
                }
                color="#EEF0F6"
              />
              <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 5, backgroundColor: preview.isWin ? 'rgba(0,209,122,0.1)' : 'rgba(255,77,77,0.1)', border: `1px solid ${preview.isWin ? '#00C47A' : '#F04848'}`, textAlign: 'center', fontSize: 12, fontWeight: 700, color: preview.isWin ? '#00C47A' : '#F04848' }}>
                {preview.isWin ? '🟢 WIN' : '🔴 LOSS'}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: large ? 18 : 13, fontWeight: large ? 700 : 600, color, fontFamily: '"JetBrains Mono", monospace' }}>{value}</div>
    </div>
  );
}
