// Voice Router — transcribes audio and routes to the correct section of the app.
// Uses Groq Whisper for transcription and llama for intent routing.

import { getTodayPlan, createPlan, savePlan, todayKey } from './dailyPlanStore';
import { useTradesStore } from '../store/tradesStore';
import type { Trade } from '../types/trade';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

// ── Instrument alias resolution ──────────────────────────────────
// Maps spoken/written names to a canonical group so "CAC" matches "FRA40.cash".
const INSTRUMENT_ALIASES: Record<string, string> = {
  // CAC 40
  CAC: 'CAC40', CAC40: 'CAC40', FRA40: 'CAC40', FR40: 'CAC40', FCE: 'CAC40', FRANCE40: 'CAC40',
  // DAX
  DAX: 'DAX', DAX40: 'DAX', DAX30: 'DAX', GER40: 'DAX', GER30: 'DAX', DE40: 'DAX', DE30: 'DAX', GERMANY40: 'DAX', DE: 'DAX',
  // S&P 500
  SP500: 'SP500', SP: 'SP500', SPX: 'SP500', SPX500: 'SP500', US500: 'SP500', ES: 'SP500', SANDP: 'SP500', SANDP500: 'SP500', SPYSP: 'SP500',
  // Nasdaq
  NASDAQ: 'NAS', NAS: 'NAS', NAS100: 'NAS', NDX: 'NAS', US100: 'NAS', USTEC: 'NAS', NQ: 'NAS', TECH100: 'NAS', USTECH100: 'NAS',
  // Dow Jones
  DOW: 'DOW', DOWJONES: 'DOW', US30: 'DOW', DJI: 'DOW', WS30: 'DOW', DJ30: 'DOW', USA30: 'DOW',
  // Gold
  GOLD: 'GOLD', XAUUSD: 'GOLD', XAU: 'GOLD', OR: 'GOLD',
  // FTSE
  FTSE: 'FTSE', UK100: 'FTSE', FTSE100: 'FTSE', UK: 'FTSE',
  // Nikkei
  NIKKEI: 'NIKKEI', JP225: 'NIKKEI', JPN225: 'NIKKEI', JP: 'NIKKEI', JAPAN225: 'NIKKEI',
};

function instrumentGroup(raw: string): string {
  const norm = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (INSTRUMENT_ALIASES[norm]) return INSTRUMENT_ALIASES[norm];
  // Symbol may carry a suffix like "FRA40.cash" → "FRA40CASH" — match by prefix key
  for (const key of Object.keys(INSTRUMENT_ALIASES)) {
    if (key.length >= 3 && norm.includes(key)) return INSTRUMENT_ALIASES[key];
  }
  return norm;
}

export function instrumentMatches(voiceName: string, actualSymbol: string): boolean {
  if (instrumentGroup(voiceName) === instrumentGroup(actualSymbol)) return true;
  const a = voiceName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const b = actualSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
}

// ── Shared review→trades resolver ────────────────────────────────
export interface ReviewIdentifier {
  instrument?: string;
  recency?: string;
  direction?: 'LONG' | 'SHORT';
  time?: string;
  order?: 'first' | 'second' | 'third' | 'last';
  outcome?: 'win' | 'loss';
}

// Resolves which trades a single review's identifier targets.
// Returns [] (and never a random fallback) when an instrument is named but absent.
function selectTradesForId(
  id: ReviewIdentifier | undefined,
  available: Trade[],
): Trade[] {
  let pool = [...available];
  const instrumentNamed = !!id?.instrument;

  if (instrumentNamed) {
    pool = pool.filter((t) => instrumentMatches(id!.instrument!, t.instrument));
    if (pool.length === 0) return []; // no match → skip, never grab a wrong trade
  }

  // Recency
  if (id?.recency === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    const f = pool.filter((t) => new Date(t.exitTime).toISOString().slice(0, 10) === today);
    if (f.length > 0) pool = f;
  } else if (id?.recency === 'yesterday') {
    const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const f = pool.filter((t) => new Date(t.exitTime).toISOString().slice(0, 10) === yest);
    if (f.length > 0) pool = f;
  } else if (id?.recency === 'this_week') {
    const weekAgo = Date.now() - 7 * 86400_000;
    const f = pool.filter((t) => new Date(t.exitTime).getTime() >= weekAgo);
    if (f.length > 0) pool = f;
  }

  // Direction
  if (id?.direction) {
    const f = pool.filter((t) => t.direction === id.direction);
    if (f.length > 0) pool = f;
  }

  // Outcome
  if (id?.outcome) {
    const f = pool.filter((t) => {
      const pnl = t.mt5Profit ?? 0;
      return id.outcome === 'win' ? pnl > 0 : pnl < 0;
    });
    if (f.length > 0) pool = f;
  }

  // Approximate time (±30 min on entryTime)
  if (id?.time) {
    const [h, m] = id.time.split(':').map(Number);
    if (!isNaN(h)) {
      const target = h * 60 + (m || 0);
      const f = pool.filter((t) => {
        const e = new Date(t.entryTime);
        return Math.abs(e.getHours() * 60 + e.getMinutes() - target) <= 30;
      });
      if (f.length > 0) {
        f.sort((a, b) => {
          const ea = new Date(a.entryTime), eb = new Date(b.entryTime);
          return Math.abs(ea.getHours() * 60 + ea.getMinutes() - target)
               - Math.abs(eb.getHours() * 60 + eb.getMinutes() - target);
        });
        pool = f;
      }
    }
  }

  // Explicit order → single trade (chronological by entryTime)
  if (id?.order) {
    const chrono = [...pool].sort((a, b) =>
      new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    );
    if (id.order === 'first')  return chrono[0] ? [chrono[0]] : [];
    if (id.order === 'second') return chrono[1] ? [chrono[1]] : chrono.slice(-1);
    if (id.order === 'third')  return chrono[2] ? [chrono[2]] : chrono.slice(-1);
    if (id.order === 'last')   return chrono.slice(-1);
  }

  // Plural intent: instrument named with no singular selector → apply to ALL matches
  if (instrumentNamed && !id?.direction && !id?.time && !id?.outcome) {
    return pool;
  }
  // Otherwise the single most relevant (most recent by exitTime)
  const byExit = [...pool].sort((a, b) =>
    new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
  );
  return byExit[0] ? [byExit[0]] : [];
}

export interface ResolvedReview {
  review: Record<string, unknown>;
  trades: Trade[];
  notFoundInstrument?: string;
}

// Resolves all reviews against the trade list, ensuring no trade is targeted twice.
export function resolveTradeReviews(reviews: Record<string, unknown>[]): ResolvedReview[] {
  const allTrades = useTradesStore.getState().trades;
  const usedIds = new Set<string>();
  const out: ResolvedReview[] = [];

  for (const review of reviews) {
    const id = review.identifier as ReviewIdentifier | undefined;
    const available = allTrades.filter((t) => !usedIds.has(t.id));
    const matched = selectTradesForId(id, available);

    if (matched.length === 0) {
      out.push({ review, trades: [], notFoundInstrument: id?.instrument });
      continue;
    }
    matched.forEach((t) => usedIds.add(t.id));
    out.push({ review, trades: matched });
  }
  return out;
}

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
  identifier: {
    instrument?: string,
    recency?: "last"|"today"|"yesterday"|"this_week",
    direction?: "LONG"|"SHORT",          (si l'utilisateur dit "le long", "celui en achat", "le short", "celui à la vente")
    time?: string,                        (heure approximative HH:MM si mentionnée, ex: "09:30", "14:00")
    order?: "first"|"second"|"third"|"last",  (si "le premier", "le deuxième", "le dernier" du jour/de la période)
    outcome?: "win"|"loss"                (si "gagnant", "perdant", "celui que j'ai gagné", "celui que j'ai perdu")
  }
  notes: string                 (OBLIGATOIRE — résumé fidèle de TOUT ce que l'utilisateur a dit sur ce trade, à la première personne, en français. Ne JAMAIS laisser vide ou null si l'utilisateur a parlé de ce trade.)
  tags: string[]|null           (parmi fear,greed,fomo,early_exit,late_entry,revenge,oversize,good_execution,followed_plan,news_trade)
  setup: "BREAKOUT"|"REVERSAL"|"SUPPORT_RESISTANCE"|"TREND_FOLLOWING"|"RANGE"|"NEWS"|"OTHER"|null
  timeframe: "1M"|"5M"|"15M"|"30M"|"1H"|"4H"|"D"|"W"|null
  lesson: string|null           (leçon explicite SEULEMENT si l'utilisateur dit explicitement "leçon", "j'ai appris", "à retenir", etc.)

RÈGLE INSTRUMENT: garde le nom de l'instrument TEL QUE PRONONCÉ par l'utilisateur
(ex: "CAC", "DAX", "SP500", "Nasdaq", "Dow", "or"). N'invente PAS de suffixe broker
(pas de ".cash", pas de "FRA40"). Le système fait la correspondance ensuite.

RÈGLE PLURIEL: si l'utilisateur parle de PLUSIEURS trades sur le même instrument
au pluriel ("ceux sur le DAX", "mes trades DAX", "les DAX") SANS distinguer lequel,
crée UNE SEULE review pour cet instrument (le système l'appliquera à tous les trades
de cet instrument). Ne mets PAS order/direction/time dans ce cas.

EXEMPLES de désambiguïsation pour identifier:
- "mon premier CAC de ce matin" → { instrument: "CAC", recency: "today", order: "first" }
- "le CAC long de ce matin" → { instrument: "CAC", recency: "today", direction: "LONG" }
- "le trade SP500 perdant" → { instrument: "SP500", recency: "today", outcome: "loss" }
- "celui de 9h30 sur le DAX" → { instrument: "DAX", recency: "today", time: "09:30" }
- "mes trades sur le DAX" (pluriel) → { instrument: "DAX", recency: "today" }
- "mon dernier EURUSD" → { instrument: "EURUSD", recency: "last" }

EXEMPLE trade_review (un seul trade):
Input: "Sur mon trade EURUSD de ce matin, j'ai paniqué et coupé trop tôt, c'était en M15"
Output: { "target": "trade_review", "summary": "Review EURUSD ce matin", "data": {
  "reviews": [
    {
      "identifier": { "instrument": "EURUSD", "recency": "today" },
      "notes": "J'ai paniqué et j'ai coupé trop tôt.",
      "tags": ["fear","early_exit"],
      "timeframe": "15M",
      "lesson": null
    }
  ]
}}

EXEMPLE trade_review (plusieurs instruments différents):
Input: "Le CAC ça respectait le plan, le SP500 j'ai mis BE rapidement, et mes DAX j'ai pris trop de risque en renforçant"
Output: { "target": "trade_review", "summary": "Review CAC, SP500, DAX", "data": {
  "reviews": [
    { "identifier": { "instrument": "CAC", "recency": "today" }, "notes": "Ça respectait le plan, j'ai mis break-even puis c'est reparti dans le bon sens.", "tags": ["followed_plan"] },
    { "identifier": { "instrument": "SP500", "recency": "today" }, "notes": "J'ai tenté un buy sur le plus bas d'hier, mis break-even rapidement car flux incertain, puis c'est parti dans l'autre sens.", "tags": ["early_exit"] },
    { "identifier": { "instrument": "DAX", "recency": "today" }, "notes": "J'ai acheté la zone, pas voulu mettre break-even alors que j'aurais pu, risque trop grand vs invalidation, et j'ai renforcé mes positions ce qui a conduit à une grosse perte.", "tags": ["oversize","revenge"] }
  ]
}}

IMPORTANT pour trade_review: TOUJOURS retourner { "reviews": [...] } même pour un seul trade.

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

    // Support both new format { reviews: [...] } and legacy single-object format
    const reviews = Array.isArray(data.reviews)
      ? (data.reviews as Record<string, unknown>[])
      : [data];

    const resolved = resolveTradeReviews(reviews);
    const updatePromises: Promise<void>[] = [];
    const touchedIds: string[] = [];

    const buildPatch = (review: Record<string, unknown>, t: Trade): Record<string, unknown> => {
      const patch: Record<string, unknown> = {};
      if (review.notes) {
        const existing = t.notes ?? '';
        patch.notes = existing ? `${existing}\n${review.notes as string}` : (review.notes as string);
      }
      if (Array.isArray(review.tags) && review.tags.length > 0) {
        const existingTags = t.tags ?? [];
        patch.tags = Array.from(new Set([...existingTags, ...(review.tags as string[])]));
      }
      if (review.setup) patch.setup = review.setup;
      if (review.timeframe) patch.timeframe = review.timeframe;
      if (review.lesson) {
        const existing = (patch.notes as string | undefined) ?? t.notes ?? '';
        const lessonLine = `📌 Leçon : ${review.lesson as string}`;
        patch.notes = existing ? `${existing}\n${lessonLine}` : lessonLine;
      }
      return patch;
    };

    for (const { review, trades: targets } of resolved) {
      for (const t of targets) {
        const patch = buildPatch(review, t);
        if (Object.keys(patch).length > 0) {
          updatePromises.push(useTradesStore.getState().updateTrade(t.id, patch));
          touchedIds.push(t.id);
        }
      }
    }

    const navigateTo = touchedIds.length === 1
      ? `/journal/edit/${touchedIds[0]}`
      : '/journal';

    if (updatePromises.length === 0) return { navigateTo };
    return { navigateTo, asyncWork: Promise.all(updatePromises).then(() => {}) };
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
