// Economic Calendar — ForexFactory JSON feed
// Endpoint is CORS-enabled and free (no API key required).

export type Impact = 'High' | 'Medium' | 'Low' | 'Holiday';

export interface EconomicEvent {
  id: string;            // synthesized
  title: string;
  country: string;       // currency code: USD, EUR, GBP...
  date: string;          // ISO datetime
  impact: Impact;
  forecast: string;
  previous: string;
  actual: string;        // empty until released
  url?: string;
}

const FF_THIS_WEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_NEXT_WEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

const CACHE_KEY = 'tj_economic_cal_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  fetchedAt: number;
  thisWeek: EconomicEvent[];
  nextWeek: EconomicEvent[];
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    console.error('Failed to cache calendar', e);
  }
}

function normalizeImpact(raw: string): Impact {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('high') || s.includes('red')) return 'High';
  if (s.includes('medium') || s.includes('orange') || s.includes('amber')) return 'Medium';
  if (s.includes('holiday')) return 'Holiday';
  return 'Low';
}

function parseEvents(raw: unknown): EconomicEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e, idx): EconomicEvent | null => {
      if (!e || typeof e !== 'object') return null;
      const obj = e as Record<string, unknown>;
      const title = String(obj.title ?? '');
      const country = String(obj.country ?? '');
      const date = String(obj.date ?? '');
      if (!title || !date) return null;
      return {
        id: `${date}-${country}-${idx}`,
        title,
        country,
        date,
        impact: normalizeImpact(String(obj.impact ?? '')),
        forecast: String(obj.forecast ?? ''),
        previous: String(obj.previous ?? ''),
        actual: String(obj.actual ?? ''),
        url: obj.url ? String(obj.url) : undefined,
      };
    })
    .filter((e): e is EconomicEvent => e !== null);
}

async function fetchFeed(url: string): Promise<EconomicEvent[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Calendar fetch ${res.status}`);
  const json = await res.json();
  return parseEvents(json);
}

export interface CalendarLoadResult {
  thisWeek: EconomicEvent[];
  nextWeek: EconomicEvent[];
  fromCache: boolean;
  fetchedAt: number;
  error?: string;
}

export async function loadCalendar(forceRefresh = false): Promise<CalendarLoadResult> {
  const cached = readCache();
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (cached && fresh && !forceRefresh) {
    return {
      thisWeek: cached.thisWeek,
      nextWeek: cached.nextWeek,
      fromCache: true,
      fetchedAt: cached.fetchedAt,
    };
  }

  try {
    const [thisWeek, nextWeek] = await Promise.all([
      fetchFeed(FF_THIS_WEEK),
      fetchFeed(FF_NEXT_WEEK).catch(() => [] as EconomicEvent[]),
    ]);
    const entry: CacheEntry = { fetchedAt: Date.now(), thisWeek, nextWeek };
    writeCache(entry);
    return { thisWeek, nextWeek, fromCache: false, fetchedAt: entry.fetchedAt };
  } catch (e) {
    // Fallback to stale cache if available
    if (cached) {
      return {
        thisWeek: cached.thisWeek,
        nextWeek: cached.nextWeek,
        fromCache: true,
        fetchedAt: cached.fetchedAt,
        error: `Refresh failed: ${(e as Error).message}. Showing cached data.`,
      };
    }
    throw e;
  }
}

// ── Helpers ──────────────────────────────────────────────────────
export function groupByDay(events: EconomicEvent[]): { date: string; events: EconomicEvent[] }[] {
  const map = new Map<string, EconomicEvent[]>();
  for (const e of events) {
    const day = e.date.slice(0, 10); // YYYY-MM-DD
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return Array.from(map.entries())
    .map(([date, events]) => ({
      date,
      events: events.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function impactColor(impact: Impact): string {
  switch (impact) {
    case 'High':    return '#F04848';
    case 'Medium':  return '#F0A030';
    case 'Holiday': return '#8B6CF0';
    case 'Low':     return '#3D8EF0';
  }
}

export function impactWeight(impact: Impact): number {
  switch (impact) {
    case 'High':    return 3;
    case 'Medium':  return 2;
    case 'Holiday': return 1;
    case 'Low':     return 0;
  }
}

// Get next high-impact events from now
export function getUpcomingHighImpact(
  events: EconomicEvent[],
  limit = 5
): EconomicEvent[] {
  const now = Date.now();
  return events
    .filter((e) => e.impact === 'High' && new Date(e.date).getTime() >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

// Get list of unique currencies in the events
export function getCurrencies(events: EconomicEvent[]): string[] {
  return [...new Set(events.map((e) => e.country))].filter((c) => c).sort();
}
