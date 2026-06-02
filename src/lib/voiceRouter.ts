// Voice Router — transcribes audio and routes to the correct section of the app.
// Uses Groq Whisper for transcription and llama for intent routing.

import { getTodayPlan, createPlan, savePlan, todayKey } from './dailyPlanStore';
import { useTradesStore } from '../store/tradesStore';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

// ── Route targets ─────────────────────────────────────────────────
export type RouteTarget =
  | 'daily_plan_morning'
  | 'daily_plan_evening'
  | 'trade_form'
  | 'trade_note'
  | 'unknown';

export interface RouteResult {
  target: RouteTarget;
  summary: string;
  data: Record<string, unknown>;
  transcript: string;
}

// ── Transcription ─────────────────────────────────────────────────
export async function transcribeAudio(blob: Blob): Promise<string> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY non configurée');

  const ext = blob.type.includes('ogg') ? 'ogg'
    : blob.type.includes('mp4') ? 'mp4'
    : 'webm';

  const form = new FormData();
  form.append('file', blob, `audio.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'fr');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  const json = await res.json() as { text: string };
  return json.text.trim();
}

// ── LLM Routing ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un assistant de trading journal. L'utilisateur dicte des informations.
Détermine vers quelle section diriger le message et extrais les données structurées.

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans backticks) avec exactement ces champs :
{
  "target": "daily_plan_morning" | "daily_plan_evening" | "trade_form" | "trade_note" | "unknown",
  "summary": "résumé court max 60 caractères",
  "data": { ... champs extraits selon la cible ... }
}

RÈGLES DE CLASSIFICATION:
- Bias, plan de session, niveaux clés, setup à surveiller, humeur du matin → "daily_plan_morning"
- Bilan de journée, ce qui s'est passé, décisions, leçons → "daily_plan_evening"
- Description d'un trade (paire, direction, entrée, sortie) → "trade_form"
- Note rapide sur un trade récent → "trade_note"
- Autre → "unknown"

CHAMPS PAR CIBLE:

daily_plan_morning:
  bias: "LONG"|"SHORT"|"NEUTRAL"|null
  keyLevels: string|null  (ex: "EURUSD 1.0850, NAS100 19500")
  setupsToWatch: string|null
  maxTrades: number|null
  maxRiskPct: number|null
  preNotes: string|null
  preMood: number 1-10|null
  preMoodTags: string[]|null  (parmi: focused,calm,confident,rested,tired,anxious,distracted,fomo,rushed,disciplined)

daily_plan_evening:
  followedPlan: "yes"|"partial"|"no"|null
  bestDecision: string|null
  worstDecision: string|null
  lesson: string|null
  postMood: number 1-10|null
  postMoodTags: string[]|null

trade_form:
  instrument: string|null  (ex: "EURUSD", "XAUUSD", "NAS100")
  direction: "LONG"|"SHORT"|null
  entryPrice: number|null
  exitPrice: number|null
  entryTime: string ISO8601|null
  exitTime: string ISO8601|null
  lotSize: number|null
  stopLoss: number|null
  takeProfit: number|null
  setup: "BREAKOUT"|"REVERSAL"|"SUPPORT_RESISTANCE"|"TREND_FOLLOWING"|"RANGE"|"NEWS"|"OTHER"|null
  timeframe: "1M"|"5M"|"15M"|"30M"|"1H"|"4H"|"D"|"W"|null
  notes: string|null
  tags: string[]|null

trade_note:
  note: string`;

export async function routeTranscript(transcript: string): Promise<RouteResult> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY non configurée');

  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const context = hour < 13 ? 'matin (session pré-marché probable)' : 'après-midi/soir (bilan possible)';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Date: ${today}, Heure: ${context}\n\nDicté: "${transcript}"` },
      ],
      temperature: 0,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`Groq LLM ${res.status}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? '';
  const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    const parsed = JSON.parse(clean) as { target: RouteTarget; summary: string; data: Record<string, unknown> };
    return { ...parsed, transcript };
  } catch {
    return { target: 'unknown', summary: transcript.slice(0, 60), data: {}, transcript };
  }
}

// ── Application — applies extracted data to the right store ───────
export interface ApplyResult {
  navigateTo?: string;
  navigateState?: unknown;
}

export function applyRoute(result: RouteResult): ApplyResult {
  const { target, data } = result;

  if (target === 'daily_plan_morning' || target === 'daily_plan_evening') {
    const existing = getTodayPlan() ?? createPlan(todayKey());
    const updated = { ...existing };

    if (target === 'daily_plan_morning') {
      if (data.bias)         updated.bias = data.bias as typeof updated.bias;
      if (data.keyLevels)    updated.keyLevels = data.keyLevels as string;
      if (data.setupsToWatch) updated.setupsToWatch = data.setupsToWatch as string;
      if (data.maxTrades)    updated.maxTrades = data.maxTrades as number;
      if (data.maxRiskPct)   updated.maxRiskPct = data.maxRiskPct as number;
      if (data.preNotes)     updated.preNotes = data.preNotes as string;
      if (data.preMood)      updated.preMood = data.preMood as number;
      if (data.preMoodTags)  updated.preMoodTags = data.preMoodTags as string[];
    } else {
      if (data.followedPlan)   updated.followedPlan = data.followedPlan as typeof updated.followedPlan;
      if (data.bestDecision)   updated.bestDecision = data.bestDecision as string;
      if (data.worstDecision)  updated.worstDecision = data.worstDecision as string;
      if (data.lesson)         updated.lesson = data.lesson as string;
      if (data.postMood)       updated.postMood = data.postMood as number;
      if (data.postMoodTags)   updated.postMoodTags = data.postMoodTags as string[];
      updated.reviewed = true;
    }

    updated.updatedAt = Date.now();
    savePlan(updated);
    return { navigateTo: '/daily-plan' };
  }

  if (target === 'trade_form') {
    return { navigateTo: '/journal/new', navigateState: { prefill: data } };
  }

  if (target === 'trade_note') {
    const note = data.note as string | undefined;
    if (note) {
      const trades = useTradesStore.getState().trades;
      if (trades.length > 0) {
        const last = [...trades].sort((a, b) =>
          new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
        )[0];
        const updated = { ...last, notes: last.notes ? `${last.notes}\n${note}` : note };
        void useTradesStore.getState().updateTrade(last.id, updated);
      }
    }
    return {};
  }

  return {};
}
