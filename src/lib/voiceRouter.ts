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

EXEMPLES de désambiguïsation pour identifier:
- "mon premier EURUSD de ce matin" → { instrument: "EURUSD", recency: "today", order: "first" }
- "le EURUSD long de ce matin" → { instrument: "EURUSD", recency: "today", direction: "LONG" }
- "le trade EURUSD perdant" → { instrument: "EURUSD", recency: "today", outcome: "loss" }
- "celui de 9h30 sur EURUSD" → { instrument: "EURUSD", recency: "today", time: "09:30" }
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

EXEMPLE trade_review (plusieurs trades):
Input: "Mon EURUSD c'était du breakout en H1, et le NAS d'hier j'ai fait du revenge"
Output: { "target": "trade_review", "summary": "Review 2 trades", "data": {
  "reviews": [
    { "identifier": { "instrument": "EURUSD", "recency": "last" }, "notes": "Setup breakout.", "setup": "BREAKOUT", "timeframe": "1H" },
    { "identifier": { "instrument": "NAS100", "recency": "yesterday" }, "notes": "J'ai fait du revenge trading.", "tags": ["revenge"] }
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

    const sortedByExit = [...trades].sort((a, b) =>
      new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
    );
    const usedIds = new Set<string>();

    interface Identifier {
      instrument?: string;
      recency?: string;
      direction?: 'LONG' | 'SHORT';
      time?: string;          // "HH:MM"
      order?: 'first' | 'second' | 'third' | 'last';
      outcome?: 'win' | 'loss';
    }

    const findTrade = (id: Identifier | undefined) => {
      let pool = sortedByExit.filter((t) => !usedIds.has(t.id));
      if (pool.length === 0) pool = sortedByExit;

      // 1) Filter by instrument
      if (id?.instrument) {
        const wanted = id.instrument.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const byInstr = pool.filter((t) => {
          const s = t.instrument.toUpperCase().replace(/[^A-Z0-9]/g, '');
          return s.includes(wanted) || wanted.includes(s);
        });
        if (byInstr.length > 0) pool = byInstr;
      }

      // 2) Filter by recency (today/yesterday)
      if (id?.recency === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        const filtered = pool.filter((t) => new Date(t.exitTime).toISOString().slice(0, 10) === today);
        if (filtered.length > 0) pool = filtered;
      } else if (id?.recency === 'yesterday') {
        const yest = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
        const filtered = pool.filter((t) => new Date(t.exitTime).toISOString().slice(0, 10) === yest);
        if (filtered.length > 0) pool = filtered;
      } else if (id?.recency === 'this_week') {
        const weekAgo = Date.now() - 7 * 86400_000;
        const filtered = pool.filter((t) => new Date(t.exitTime).getTime() >= weekAgo);
        if (filtered.length > 0) pool = filtered;
      }

      // 3) Filter by direction
      if (id?.direction) {
        const filtered = pool.filter((t) => t.direction === id.direction);
        if (filtered.length > 0) pool = filtered;
      }

      // 4) Filter by outcome (win/loss based on mt5Profit or computed P&L sign)
      if (id?.outcome) {
        const filtered = pool.filter((t) => {
          const pnl = t.mt5Profit ?? 0;
          return id.outcome === 'win' ? pnl > 0 : pnl < 0;
        });
        if (filtered.length > 0) pool = filtered;
      }

      // 5) Filter by approximate time (HH:MM within ±30min on entryTime)
      if (id?.time) {
        const [h, m] = id.time.split(':').map(Number);
        if (!isNaN(h)) {
          const targetMin = h * 60 + (m || 0);
          const filtered = pool.filter((t) => {
            const entry = new Date(t.entryTime);
            const tradeMin = entry.getHours() * 60 + entry.getMinutes();
            return Math.abs(tradeMin - targetMin) <= 30;
          });
          if (filtered.length > 0) {
            // Sort by closeness to target time
            filtered.sort((a, b) => {
              const ea = new Date(a.entryTime); const eb = new Date(b.entryTime);
              const da = Math.abs(ea.getHours() * 60 + ea.getMinutes() - targetMin);
              const db = Math.abs(eb.getHours() * 60 + eb.getMinutes() - targetMin);
              return da - db;
            });
            pool = filtered;
          }
        }
      }

      // 6) Apply order — by entryTime ASC (chronological) so "first" = earliest
      const chrono = [...pool].sort((a, b) =>
        new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
      );
      if (id?.order === 'first') return chrono[0];
      if (id?.order === 'second') return chrono[1] ?? chrono[chrono.length - 1];
      if (id?.order === 'third') return chrono[2] ?? chrono[chrono.length - 1];
      if (id?.order === 'last') return chrono[chrono.length - 1];

      // Default: most recent by exitTime
      return pool[0];
    };

    const updatePromises: Promise<void>[] = [];
    let lastTradeId = '';

    for (const review of reviews) {
      const id = review.identifier as Identifier | undefined;
      const target_trade = findTrade(id);
      if (!target_trade) continue;
      usedIds.add(target_trade.id);
      lastTradeId = target_trade.id;

      const patch: Record<string, unknown> = {};

      if (review.notes) {
        const existing = target_trade.notes ?? '';
        const newNote = review.notes as string;
        patch.notes = existing ? `${existing}\n${newNote}` : newNote;
      }
      if (Array.isArray(review.tags) && review.tags.length > 0) {
        const existingTags = target_trade.tags ?? [];
        patch.tags = Array.from(new Set([...existingTags, ...(review.tags as string[])]));
      }
      // Always overwrite setup/timeframe when explicitly mentioned
      if (review.setup) patch.setup = review.setup;
      if (review.timeframe) patch.timeframe = review.timeframe;
      if (review.lesson) {
        const existing = (patch.notes as string | undefined) ?? target_trade.notes ?? '';
        const lessonLine = `📌 Leçon : ${review.lesson as string}`;
        patch.notes = existing ? `${existing}\n${lessonLine}` : lessonLine;
      }

      if (Object.keys(patch).length > 0) {
        updatePromises.push(useTradesStore.getState().updateTrade(target_trade.id, patch));
      }
    }

    const navigateTo = reviews.length === 1 && lastTradeId
      ? `/journal/edit/${lastTradeId}`
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
