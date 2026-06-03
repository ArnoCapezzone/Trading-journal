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
  | 'trade_review'
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
- Description d'un NOUVEAU trade (paire, direction, entrée, sortie, taille) sans référence à un trade passé → "trade_form"
- Commentaire / analyse / leçon / émotion à propos d'un trade DÉJÀ FAIT (ex: "sur mon trade EURUSD de ce matin…", "le NAS d'hier…", "mon dernier trade…", "j'ai paniqué sur le XAU") → "trade_review"
- Note très courte sans contexte clair → "trade_note"
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

trade_review:
  identifier: { instrument?: string, when?: string, recency?: "last"|"today"|"yesterday"|"this_week" }
  notes: string                 (OBLIGATOIRE — résumé fidèle de TOUT ce que l'utilisateur a dit sur ce trade, à la première personne, en français. Ne JAMAIS laisser vide ou null si l'utilisateur a parlé de ce trade.)
  tags: string[]|null           (parmi fear,greed,fomo,early_exit,late_entry,revenge,oversize,good_execution,followed_plan,news_trade)
  setup: "BREAKOUT"|"REVERSAL"|"SUPPORT_RESISTANCE"|"TREND_FOLLOWING"|"RANGE"|"NEWS"|"OTHER"|null
  timeframe: "1M"|"5M"|"15M"|"30M"|"1H"|"4H"|"D"|"W"|null
  lesson: string|null           (leçon explicite SEULEMENT si l'utilisateur dit explicitement "leçon", "j'ai appris", "à retenir", etc.)

EXEMPLE trade_review:
Input: "Sur mon trade EURUSD de ce matin, j'ai paniqué et coupé trop tôt"
Output: { "target": "trade_review", "summary": "Review EURUSD ce matin", "data": {
  "identifier": { "instrument": "EURUSD", "recency": "today" },
  "notes": "J'ai paniqué et j'ai coupé trop tôt.",
  "tags": ["fear","early_exit"], "lesson": null
}}

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
  asyncWork?: Promise<void>;
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

  if (target === 'trade_review') {
    const trades = useTradesStore.getState().trades;
    if (trades.length === 0) return {};

    const id = data.identifier as { instrument?: string; when?: string; recency?: string } | undefined;
    const sortedByExit = [...trades].sort((a, b) =>
      new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
    );

    // Find the target trade
    let target_trade = sortedByExit[0]; // fallback: most recent
    if (id?.instrument) {
      const wanted = id.instrument.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matching = sortedByExit.filter((t) =>
        t.instrument.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(wanted) ||
        wanted.includes(t.instrument.toUpperCase().replace(/[^A-Z0-9]/g, ''))
      );
      if (matching.length > 0) {
        // Filter by recency if provided
        if (id.recency === 'today') {
          const today = new Date().toISOString().slice(0, 10);
          const todayMatch = matching.filter((t) =>
            new Date(t.exitTime).toISOString().slice(0, 10) === today
          );
          if (todayMatch.length > 0) target_trade = todayMatch[0];
          else target_trade = matching[0];
        } else if (id.recency === 'yesterday') {
          const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
          const yestMatch = matching.filter((t) =>
            new Date(t.exitTime).toISOString().slice(0, 10) === yest
          );
          target_trade = yestMatch[0] ?? matching[0];
        } else {
          target_trade = matching[0];
        }
      }
    }

    // Build the update patch — only fields explicitly mentioned
    const patch: Record<string, unknown> = {};
    if (data.notes) {
      const existing = target_trade.notes ?? '';
      const newNote = data.notes as string;
      patch.notes = existing ? `${existing}\n${newNote}` : newNote;
    }
    if (Array.isArray(data.tags) && data.tags.length > 0) {
      const existingTags = target_trade.tags ?? [];
      patch.tags = Array.from(new Set([...existingTags, ...(data.tags as string[])]));
    }
    if (data.setup && !target_trade.setup) patch.setup = data.setup;
    if (data.timeframe && !target_trade.timeframe) patch.timeframe = data.timeframe;
    if (data.lesson) {
      // Append lesson into notes with a marker
      const existing = patch.notes as string | undefined ?? target_trade.notes ?? '';
      const lessonLine = `📌 Leçon : ${data.lesson as string}`;
      patch.notes = existing ? `${existing}\n${lessonLine}` : lessonLine;
    }

    if (Object.keys(patch).length === 0) {
      return { navigateTo: `/journal/edit/${target_trade.id}` };
    }
    const asyncWork = useTradesStore.getState().updateTrade(target_trade.id, patch);
    return { navigateTo: `/journal/edit/${target_trade.id}`, asyncWork };
  }

  if (target === 'trade_note') {
    const note = data.note as string | undefined;
    if (note) {
      const trades = useTradesStore.getState().trades;
      if (trades.length > 0) {
        const last = [...trades].sort((a, b) =>
          new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
        )[0];
        const newNotes = last.notes ? `${last.notes}\n${note}` : note;
        const asyncWork = useTradesStore.getState().updateTrade(last.id, { notes: newNotes });
        return { navigateTo: `/journal/edit/${last.id}`, asyncWork };
      }
    }
    return {};
  }

  return {};
}
