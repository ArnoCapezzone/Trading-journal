import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transcribeAudio, routeTranscript, applyRoute, type RouteResult } from '../../lib/voiceRouter';

type RecordState = 'idle' | 'recording' | 'processing';

const TARGET_LABELS: Record<string, string> = {
  daily_plan_morning: '📋 Plan du jour',
  daily_plan_evening: '🌙 Bilan du soir',
  trade_form:         '📈 Nouveau trade',
  trade_review:       '🔍 Review trade',
  trade_note:         '📝 Note trade',
  unknown:            '❓ Non reconnu',
};

const TARGET_COLORS: Record<string, string> = {
  daily_plan_morning: '#3D8EF0',
  daily_plan_evening: '#8B5CF6',
  trade_form:         '#00C47A',
  trade_review:       '#06B6D4',
  trade_note:         '#F0A030',
  unknown:            'var(--text-muted)',
};

// ── Animated mic icon ─────────────────────────────────────────────
function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3"
        fill={recording ? '#fff' : 'currentColor'}
        style={{ transition: 'fill 0.2s' }}
      />
      <path d="M5 11a7 7 0 0 0 14 0" stroke={recording ? '#fff' : 'currentColor'} strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="12" y1="18" x2="12" y2="22" stroke={recording ? '#fff' : 'currentColor'} strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="22" x2="15" y2="22" stroke={recording ? '#fff' : 'currentColor'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Confirmation card ─────────────────────────────────────────────
function ConfirmCard({
  result,
  onApply,
  onDismiss,
}: {
  result: RouteResult;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const color = TARGET_COLORS[result.target] ?? 'var(--text-muted)';
  const label = TARGET_LABELS[result.target] ?? result.target;

  const fieldLabels: Record<string, string> = {
    bias: 'Bias', keyLevels: 'Niveaux', setupsToWatch: 'Setups', maxTrades: 'Max trades',
    preNotes: 'Notes', preMood: 'Humeur', preMoodTags: 'Tags',
    followedPlan: 'Plan suivi', bestDecision: 'Meilleure décision', lesson: 'Leçon',
    instrument: 'Paire', direction: 'Direction', entryPrice: 'Entrée', exitPrice: 'Sortie',
    stopLoss: 'SL', takeProfit: 'TP', lotSize: 'Taille', notes: 'Notes', setup: 'Setup',
    note: 'Note', tags: 'Tags', timeframe: 'TF', identifier: 'Cible',
  };

  // Detect trade_review with multiple reviews
  const reviews = result.target === 'trade_review' && Array.isArray(result.data.reviews)
    ? (result.data.reviews as Record<string, unknown>[])
    : null;

  // For non-review, build flat field list
  const fields = !reviews
    ? Object.entries(result.data)
        .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
        .slice(0, 6)
    : [];

  const renderFieldValue = (v: unknown): string => {
    if (Array.isArray(v)) return v.join(', ');
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (obj.instrument || obj.recency) {
        return [obj.instrument, obj.recency].filter(Boolean).join(' · ');
      }
      return JSON.stringify(v);
    }
    return String(v);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 20, zIndex: 9999,
      width: 320, maxWidth: 'calc(100vw - 40px)',
      backgroundColor: 'var(--bg-surface)',
      border: `1px solid ${color}40`,
      borderRadius: 12,
      boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${color}20`,
      overflow: 'hidden',
      animation: 'slideUp 0.2s ease-out',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>

      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>{result.summary}</span>
      </div>

      {/* Transcript */}
      <div style={{ padding: '8px 14px 6px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4, borderBottom: fields.length > 0 ? '1px solid var(--border-faint)' : 'none' }}>
        "{result.transcript}"
      </div>

      {/* Extracted fields — flat (non-review) */}
      {fields.length > 0 && (
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {fields.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text-tertiary)', minWidth: 90 }}>{fieldLabels[k] ?? k}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>
                {renderFieldValue(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Trade reviews — one card per trade */}
      {reviews && reviews.length > 0 && (
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {reviews.map((rev, i) => {
            const id = rev.identifier as { instrument?: string; recency?: string } | undefined;
            const headerLine = id ? [id.instrument, id.recency].filter(Boolean).join(' · ') : `Trade #${i + 1}`;
            const entries = Object.entries(rev).filter(([k, v]) =>
              k !== 'identifier' && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
            );
            return (
              <div key={i} style={{ padding: '8px 10px', backgroundColor: 'var(--bg-app)', borderRadius: 6, border: '1px solid var(--border-faint)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#06B6D4', marginBottom: 4 }}>🔍 {headerLine}</div>
                {entries.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 6, fontSize: 11, marginTop: 2 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: 70 }}>{fieldLabels[k] ?? k}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, flex: 1 }}>{renderFieldValue(v)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Buttons */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8, borderTop: '1px solid var(--border-faint)' }}>
        {result.target !== 'unknown' ? (
          <button
            onClick={onApply}
            style={{ flex: 1, padding: '8px', backgroundColor: color, border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ✓ Appliquer
          </button>
        ) : null}
        <button
          onClick={onDismiss}
          style={{ flex: result.target === 'unknown' ? 1 : 0, padding: '8px 14px', backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border-default)', borderRadius: 7, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}

// ── Main floating button ──────────────────────────────────────────
export default function VoiceButton() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecordState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);

  const [textMode, setTextMode] = useState(false);
  const [textValue, setTextValue] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-clear error after 4s
  useEffect(() => {
    if (error) {
      errorTimerRef.current = setTimeout(() => setError(null), 4000);
      return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
    }
  }, [error]);

  const startRecording = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setState('recording');
    } catch {
      setError('Microphone inaccessible');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setState('processing');
    recorder.onstop = async () => {
      // Stop stream
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

      try {
        const transcript = await transcribeAudio(blob);
        if (!transcript.trim()) { setState('idle'); setError('Rien entendu, réessaie'); return; }
        const routeResult = await routeTranscript(transcript);
        setResult(routeResult);
        setState('idle');
      } catch (e) {
        setError((e as Error).message?.slice(0, 80) ?? 'Erreur');
        setState('idle');
      }
    };
    recorder.stop();
  };

  const handleClick = () => {
    if (state === 'idle') startRecording();
    else if (state === 'recording') stopRecording();
  };

  const submitText = async () => {
    const text = textValue.trim();
    if (!text) return;
    setError(null);
    setResult(null);
    setState('processing');
    try {
      const routeResult = await routeTranscript(text);
      setResult(routeResult);
      setTextValue('');
      setTextMode(false);
    } catch (e) {
      setError((e as Error).message?.slice(0, 80) ?? 'Erreur');
    } finally {
      setState('idle');
    }
  };

  const openTextMode = () => {
    setError(null);
    setResult(null);
    setTextMode(true);
    setTimeout(() => textInputRef.current?.focus(), 50);
  };

  const handleApply = async () => {
    if (!result) return;
    const { navigateTo, navigateState, asyncWork } = applyRoute(result);
    setResult(null);
    try {
      if (asyncWork) await asyncWork;
    } catch (e) {
      setError((e as Error).message?.slice(0, 100) ?? 'Erreur lors de la mise à jour');
      return;
    }
    if (navigateTo) navigate(navigateTo, navigateState ? { state: navigateState } : undefined);
  };

  const btnColor = state === 'recording' ? '#F04848'
    : state === 'processing' ? '#F0A030'
    : '#3D8EF0';

  const btnTitle = state === 'idle' ? 'Dicter (cliquer pour démarrer)'
    : state === 'recording' ? 'Enregistrement… (cliquer pour arrêter)'
    : 'Traitement en cours…';

  return (
    <>
      {/* Confirmation card */}
      {result && (
        <ConfirmCard
          result={result}
          onApply={handleApply}
          onDismiss={() => setResult(null)}
        />
      )}

      {/* Error toast */}
      {error && (
        <div style={{
          position: 'fixed', bottom: 90, right: 20, zIndex: 9998,
          padding: '10px 14px',
          backgroundColor: 'rgba(240,72,72,0.12)',
          border: '1px solid rgba(240,72,72,0.35)',
          borderRadius: 8,
          fontSize: 12, color: '#F04848',
          maxWidth: 280,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {error}
        </div>
      )}

      {/* Text input panel */}
      {textMode && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
          width: 320, maxWidth: 'calc(100vw - 48px)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          padding: 12,
          animation: 'slideUp 0.2s ease-out',
        }}>
          <style>{`@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>
            ⌨️ Écris : plan, trade, ou review
          </div>
          <textarea
            ref={textInputRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitText(); }
              if (e.key === 'Escape') { setTextMode(false); setTextValue(''); }
            }}
            placeholder="Ex: sur mon EURUSD long de ce matin j'ai coupé trop tôt par peur…"
            rows={3}
            style={{
              width: '100%', padding: '8px 10px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-default)',
              borderRadius: 7,
              color: 'var(--text-primary)',
              fontSize: 13, fontFamily: 'inherit',
              outline: 'none', resize: 'none', boxSizing: 'border-box',
              lineHeight: 1.4,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => void submitText()}
              disabled={!textValue.trim() || state === 'processing'}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, border: 'none',
                backgroundColor: textValue.trim() ? '#3D8EF0' : 'var(--bg-surface-2)',
                color: textValue.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 700,
                cursor: textValue.trim() ? 'pointer' : 'default',
              }}
            >
              {state === 'processing' ? '⟳ Analyse…' : 'Envoyer ⏎'}
            </button>
            <button
              onClick={() => { setTextMode(false); setTextValue(''); }}
              style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Keyboard toggle button (secondary, left of mic) */}
      {!textMode && state === 'idle' && (
        <button
          onClick={openTextMode}
          title="Écrire au lieu de dicter"
          style={{
            position: 'fixed', bottom: 30, right: 86, zIndex: 9996,
            width: 40, height: 40, borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontSize: 16,
          }}
        >
          ⌨️
        </button>
      )}

      {/* Floating mic button */}
      <button
        onClick={handleClick}
        disabled={state === 'processing'}
        title={btnTitle}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9997,
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: btnColor,
          border: 'none',
          cursor: state === 'processing' ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: state === 'recording'
            ? `0 0 0 4px rgba(240,72,72,0.25), 0 0 0 8px rgba(240,72,72,0.1), 0 4px 20px rgba(240,72,72,0.5)`
            : '0 4px 16px rgba(0,0,0,0.25)',
          transition: 'background-color 0.2s, box-shadow 0.2s',
          animation: state === 'recording' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      >
        <style>{`
          @keyframes pulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(240,72,72,0.25), 0 0 0 8px rgba(240,72,72,0.1); }
            50%       { box-shadow: 0 0 0 8px rgba(240,72,72,0.2), 0 0 0 16px rgba(240,72,72,0.05); }
          }
        `}</style>

        {state === 'processing' ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2" strokeDasharray="28 56" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
            </circle>
          </svg>
        ) : (
          <MicIcon recording={state === 'recording'} />
        )}
      </button>
    </>
  );
}
