import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Trade, TradeDirection, SetupType, Timeframe } from '../../types/trade';

// ── Types ────────────────────────────────────────────────────────
interface VoiceParsed {
  instrument: string | null;
  direction: 'LONG' | 'SHORT' | null;
  entryPrice: number | null;
  exitPrice: number | null;
  entryTime: string | null;
  exitTime: string | null;
  lotSize: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  notes: string | null;
  tags: string[] | null;
  setup: string | null;
  timeframe: string | null;
}

type State = 'idle' | 'recording' | 'processing' | 'error';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

const SYSTEM_PROMPT = `Tu es un assistant de trading. Extrais les informations du trade dicté et retourne UNIQUEMENT un JSON valide (pas de markdown, pas de backticks, pas de texte autour) avec les champs :
- instrument: string (ex: "EURUSD", "XAUUSD", "NAS100") ou null
- direction: "LONG" ou "SHORT" ou null
- entryPrice: number ou null
- exitPrice: number ou null
- entryTime: string ISO 8601 ou null (si heure seule mentionnée, utilise la date d'aujourd'hui)
- exitTime: string ISO 8601 ou null
- lotSize: number ou null
- stopLoss: number ou null
- takeProfit: number ou null
- setup: l'un de ["BREAKOUT","REVERSAL","SUPPORT_RESISTANCE","TREND_FOLLOWING","RANGE","NEWS","OTHER"] ou null
- timeframe: l'un de ["1M","5M","15M","30M","1H","4H","D","W"] ou null
- notes: string ou null
- tags: array parmi ["fear","greed","fomo","early_exit","late_entry","revenge","oversize","good_execution","followed_plan","news_trade"] ou []
Retourne UNIQUEMENT le JSON, sans aucun autre texte.`;

// ── Whisper transcription ────────────────────────────────────────
async function transcribeAudio(blob: Blob, lang: string): Promise<string> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY non configurée');

  const ext = blob.type.includes('ogg') ? 'ogg'
    : blob.type.includes('webm') ? 'webm'
    : blob.type.includes('mp4') ? 'mp4'
    : 'webm';

  const form = new FormData();
  form.append('file', blob, `audio.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', lang === 'fr-FR' ? 'fr' : 'en');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Whisper error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.text as string;
}

// ── LLM parsing ──────────────────────────────────────────────────
async function parseTradeFromText(transcript: string): Promise<VoiceParsed> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY non configurée');

  const today = new Date().toISOString().split('T')[0];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Date d'aujourd'hui: ${today}\n\nTrade dicté: "${transcript}"` },
      ],
      temperature: 0,
      max_tokens: 400,
    }),
  });

  if (!res.ok) throw new Error(`Groq LLM error ${res.status}`);
  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';
  const clean = content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    return JSON.parse(clean) as VoiceParsed;
  } catch {
    throw new Error(`JSON invalide reçu: ${clean.slice(0, 200)}`);
  }
}

function parsedToPrefill(p: VoiceParsed): Partial<Trade> {
  const prefill: Partial<Trade> = {};
  if (p.instrument) prefill.instrument = p.instrument.toUpperCase();
  if (p.direction === 'LONG' || p.direction === 'SHORT') prefill.direction = p.direction as TradeDirection;
  if (p.entryPrice !== null) prefill.entryPrice = p.entryPrice;
  if (p.exitPrice !== null) prefill.exitPrice = p.exitPrice;
  if (p.entryTime) { try { prefill.entryTime = new Date(p.entryTime); } catch {} }
  if (p.exitTime) { try { prefill.exitTime = new Date(p.exitTime); } catch {} }
  if (p.lotSize !== null) prefill.lotSize = p.lotSize;
  if (p.stopLoss !== null) prefill.stopLoss = p.stopLoss;
  if (p.takeProfit !== null) prefill.takeProfit = p.takeProfit;
  if (p.notes) prefill.notes = p.notes;
  if (p.tags && p.tags.length > 0) prefill.tags = p.tags;
  if (p.setup) prefill.setup = p.setup as SetupType;
  if (p.timeframe) prefill.timeframe = p.timeframe as Timeframe;
  return prefill;
}

// ── Component ────────────────────────────────────────────────────
export default function VoiceTradeInput() {
  const navigate = useNavigate();
  const [uiState, setUiState] = useState<State>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState<'fr-FR' | 'en-US'>('fr-FR');
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    setError('');
    setTranscript('');
    setElapsed(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access denied. Please allow microphone in your browser settings.');
      setUiState('error');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(200);
    mediaRecorderRef.current = recorder;
    setUiState('recording');

    timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
  }

  async function stopAndProcess() {
    if (timerRef.current) clearInterval(timerRef.current);
    setUiState('processing');
    setStatusMsg('Transcribing with Whisper…');

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

    try {
      const text = await transcribeAudio(audioBlob, lang);
      setTranscript(text);
      setStatusMsg('Extracting trade data…');
      const parsed = await parseTradeFromText(text);
      const prefill = parsedToPrefill(parsed);
      navigate('/journal/new', { state: { prefill } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUiState('error');
    }
  }

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setUiState('idle');
    setTranscript('');
    setError('');
    setElapsed(0);
    setStatusMsg('');
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div>
      {/* ── Idle button ── */}
      {uiState === 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setLang((l) => (l === 'fr-FR' ? 'en-US' : 'fr-FR'))}
            title="Switch language"
            style={{ padding: '6px 10px', backgroundColor: 'transparent', border: '1px solid #2d3148', borderRadius: 5, color: '#8892a4', fontSize: 11, cursor: 'pointer' }}
          >
            {lang === 'fr-FR' ? '🇫🇷' : '🇬🇧'}
          </button>
          <button
            onClick={startRecording}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', backgroundColor: 'rgba(77,158,255,0.1)', border: '1px solid rgba(77,158,255,0.4)', borderRadius: 6, color: '#4d9eff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <MicIcon /> Dictate trade
          </button>
        </div>
      )}

      {/* ── Modal overlay ── */}
      {(uiState === 'recording' || uiState === 'processing') && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,17,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: '36px 40px', maxWidth: 500, width: '90vw', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>

            {/* Animated icon */}
            <div style={{ position: 'relative' }}>
              {uiState === 'recording' && (
                <>
                  <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '2px solid rgba(255,77,77,0.3)', animation: 'vPulse 1.5s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', border: '2px solid rgba(255,77,77,0.12)', animation: 'vPulse 1.5s ease-out 0.35s infinite' }} />
                </>
              )}
              <div style={{ width: 68, height: 68, borderRadius: '50%', backgroundColor: uiState === 'processing' ? 'rgba(77,158,255,0.12)' : 'rgba(255,77,77,0.12)', border: `2px solid ${uiState === 'processing' ? '#4d9eff' : '#ff4d4d'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {uiState === 'processing'
                  ? <div style={{ width: 26, height: 26, border: '3px solid #4d9eff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  : <MicIcon size={28} color="#ff4d4d" />
                }
              </div>
            </div>

            {/* Status */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>
                {uiState === 'recording' ? `Recording… ${fmtTime(elapsed)}` : statusMsg}
              </div>
              <div style={{ fontSize: 11, color: '#8892a4' }}>
                {uiState === 'recording'
                  ? `Speaking in ${lang === 'fr-FR' ? 'French' : 'English'} — click Stop when done`
                  : 'Please wait'}
              </div>
            </div>

            {/* Transcript preview after processing */}
            {transcript && uiState === 'processing' && (
              <div style={{ width: '100%', backgroundColor: '#0f1117', border: '1px solid #2d3148', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: '#8892a4', fontStyle: 'italic', lineHeight: 1.6, maxHeight: 100, overflowY: 'auto' }}>
                "{transcript}"
              </div>
            )}

            {uiState === 'recording' && (
              <button
                onClick={stopAndProcess}
                style={{ padding: '10px 32px', backgroundColor: '#ff4d4d', border: 'none', borderRadius: 6, color: '#0f1117', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Stop & Analyze
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Error overlay ── */}
      {uiState === 'error' && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,17,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ backgroundColor: '#1a1d27', border: '1px solid #ff4d4d', borderRadius: 12, padding: '28px 32px', maxWidth: 440, width: '90vw', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff4d4d', marginBottom: 8 }}>Error</div>
            <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 20, lineHeight: 1.6 }}>{error}</div>
            <button onClick={reset} style={{ padding: '8px 20px', backgroundColor: 'transparent', border: '1px solid #2d3148', borderRadius: 5, color: '#e8eaf0', fontSize: 12, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vPulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.8); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function MicIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}
