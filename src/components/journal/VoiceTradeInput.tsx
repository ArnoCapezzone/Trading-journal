import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Trade, TradeDirection, SetupType, Timeframe } from '../../types/trade';

// ── Web Speech API types ─────────────────────────────────────────
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ── Groq response type ───────────────────────────────────────────
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

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

const SYSTEM_PROMPT = `Tu es un assistant de trading. Extrais les informations du trade dicté et retourne UNIQUEMENT un JSON valide (pas de markdown, pas de backticks, pas de texte autour) avec les champs suivants :
- instrument: string (ex: "EURUSD", "XAUUSD", "NAS100") ou null
- direction: "LONG" ou "SHORT" ou null
- entryPrice: number ou null
- exitPrice: number ou null
- entryTime: string ISO 8601 (ex: "2024-01-15T09:30:00") ou null — si seule l'heure est mentionnée sans date, utilise la date d'aujourd'hui
- exitTime: string ISO 8601 ou null
- lotSize: number ou null (ex: 0.1, 1.0)
- stopLoss: number ou null
- takeProfit: number ou null
- setup: l'un de ["BREAKOUT","REVERSAL","SUPPORT_RESISTANCE","TREND_FOLLOWING","RANGE","NEWS","OTHER"] ou null
- timeframe: l'un de ["1M","5M","15M","30M","1H","4H","D","W"] ou null
- notes: string résumant les observations/contexte mentionnés ou null
- tags: array de strings parmi ["fear","greed","fomo","early_exit","late_entry","revenge","oversize","good_execution","followed_plan","news_trade"] selon ce qui est mentionné, ou []

Retourne UNIQUEMENT le JSON, sans aucun autre texte.`;

async function callGroq(transcript: string): Promise<VoiceParsed> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY is not configured');

  const today = new Date().toISOString().split('T')[0];
  const userMsg = `Date d'aujourd'hui: ${today}\n\nTrade dicté: "${transcript}"`;

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
        { role: 'user', content: userMsg },
      ],
      temperature: 0,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';

  // Strip markdown code blocks if model adds them anyway
  const clean = content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    return JSON.parse(clean) as VoiceParsed;
  } catch {
    throw new Error(`Groq returned invalid JSON: ${clean.slice(0, 200)}`);
  }
}

function parsedToPrefill(p: VoiceParsed): Partial<Trade> {
  const prefill: Partial<Trade> = {};
  if (p.instrument) prefill.instrument = p.instrument.toUpperCase();
  if (p.direction === 'LONG' || p.direction === 'SHORT') prefill.direction = p.direction as TradeDirection;
  if (p.entryPrice !== null) prefill.entryPrice = p.entryPrice;
  if (p.exitPrice !== null) prefill.exitPrice = p.exitPrice;
  if (p.entryTime) prefill.entryTime = new Date(p.entryTime);
  if (p.exitTime) prefill.exitTime = new Date(p.exitTime);
  if (p.lotSize !== null) prefill.lotSize = p.lotSize;
  if (p.stopLoss !== null) prefill.stopLoss = p.stopLoss;
  if (p.takeProfit !== null) prefill.takeProfit = p.takeProfit;
  if (p.notes) prefill.notes = p.notes;
  if (p.tags && p.tags.length > 0) prefill.tags = p.tags;
  if (p.setup) prefill.setup = p.setup as SetupType;
  if (p.timeframe) prefill.timeframe = p.timeframe as Timeframe;
  return prefill;
}

export default function VoiceTradeInput() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState<'fr-FR' | 'en-US'>('fr-FR');
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  const getSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return null;
    return SR;
  }, []);

  function startRecording() {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError('Web Speech API not supported in this browser. Use Chrome or Safari.');
      setState('error');
      return;
    }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimText('');
    setError('');

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscriptRef.current);
      setInterimText(interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted') return;
      setError(`Microphone error: ${e.error}`);
      setState('error');
    };

    rec.onend = () => {
      // Only auto-process if we stopped intentionally (state is still 'recording')
      // The stop button sets state to 'processing' before calling rec.stop()
    };

    rec.start();
    recognitionRef.current = rec;
    setState('recording');
  }

  async function stopAndProcess() {
    setState('processing');
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const text = (finalTranscriptRef.current + interimText).trim();
    if (!text) {
      setError('No speech detected. Please try again.');
      setState('error');
      return;
    }

    setTranscript(text);
    setInterimText('');

    try {
      const parsed = await callGroq(text);
      const prefill = parsedToPrefill(parsed);
      navigate('/journal/new', { state: { prefill } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }

  function reset() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setState('idle');
    setTranscript('');
    setInterimText('');
    setError('');
    finalTranscriptRef.current = '';
  }

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isError = state === 'error';

  return (
    <div style={{ position: 'relative' }}>
      {/* Main mic button */}
      {state === 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Lang toggle */}
          <button
            onClick={() => setLang((l) => (l === 'fr-FR' ? 'en-US' : 'fr-FR'))}
            title="Switch language"
            style={{
              padding: '6px 10px',
              backgroundColor: 'transparent',
              border: '1px solid #2d3148',
              borderRadius: 5,
              color: '#8892a4',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {lang === 'fr-FR' ? '🇫🇷' : '🇬🇧'}
          </button>

          <button
            onClick={startRecording}
            title="Dictate a trade"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 14px',
              backgroundColor: 'rgba(77,158,255,0.1)',
              border: '1px solid rgba(77,158,255,0.4)',
              borderRadius: 6,
              color: '#4d9eff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <MicIcon />
            Dictate trade
          </button>
        </div>
      )}

      {/* Recording state */}
      {(isRecording || isProcessing) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,17,23,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => e.target === e.currentTarget && !isProcessing && reset()}
        >
          <div
            style={{
              backgroundColor: '#1a1d27',
              border: '1px solid #2d3148',
              borderRadius: 12,
              padding: '32px 36px',
              maxWidth: 520,
              width: '90vw',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            {/* Animated mic */}
            <div style={{ position: 'relative' }}>
              {isRecording && (
                <>
                  <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: '2px solid rgba(255,77,77,0.3)', animation: 'voicePulse 1.5s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: '2px solid rgba(255,77,77,0.15)', animation: 'voicePulse 1.5s ease-out 0.3s infinite' }} />
                </>
              )}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: isProcessing ? 'rgba(77,158,255,0.15)' : 'rgba(255,77,77,0.15)',
                  border: `2px solid ${isProcessing ? '#4d9eff' : '#ff4d4d'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isProcessing ? (
                  <div style={{ width: 24, height: 24, border: '3px solid #4d9eff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <MicIcon size={28} color="#ff4d4d" />
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8eaf0', marginBottom: 4 }}>
                {isProcessing ? 'Analyzing with Groq AI…' : 'Listening…'}
              </div>
              <div style={{ fontSize: 11, color: '#8892a4' }}>
                {isProcessing
                  ? 'Extracting trade data from your dictation'
                  : `Speak your trade in ${lang === 'fr-FR' ? 'French' : 'English'}`}
              </div>
            </div>

            {/* Transcript */}
            {(transcript || interimText) && (
              <div
                style={{
                  width: '100%',
                  backgroundColor: '#0f1117',
                  border: '1px solid #2d3148',
                  borderRadius: 7,
                  padding: '12px 14px',
                  fontSize: 13,
                  color: '#e8eaf0',
                  lineHeight: 1.6,
                  maxHeight: 120,
                  overflowY: 'auto',
                  fontStyle: 'italic',
                }}
              >
                {transcript}
                {interimText && (
                  <span style={{ color: '#8892a4' }}>{interimText}</span>
                )}
              </div>
            )}

            {isRecording && (
              <button
                onClick={stopAndProcess}
                style={{
                  padding: '10px 28px',
                  backgroundColor: '#ff4d4d',
                  border: 'none',
                  borderRadius: 6,
                  color: '#0f1117',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Stop & Analyze
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,17,23,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            style={{
              backgroundColor: '#1a1d27',
              border: '1px solid #ff4d4d',
              borderRadius: 12,
              padding: '28px 32px',
              maxWidth: 440,
              width: '90vw',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ff4d4d', marginBottom: 8 }}>
              Voice Input Error
            </div>
            <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 20, lineHeight: 1.6 }}>
              {error}
            </div>
            <button
              onClick={reset}
              style={{
                padding: '8px 20px',
                backgroundColor: 'transparent',
                border: '1px solid #2d3148',
                borderRadius: 5,
                color: '#e8eaf0',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes voicePulse {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
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
