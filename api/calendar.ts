// Vercel Edge Function — proxies the ForexFactory feed.
// Solves the CORS issue by fetching server-side. Same-origin call from client.

export const config = { runtime: 'edge' };

const FEEDS: Record<string, string> = {
  thisweek: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  nextweek: 'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
  lastweek: 'https://nfs.faireconomy.media/ff_calendar_lastweek.json',
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const week = (url.searchParams.get('week') ?? 'thisweek').toLowerCase();
  const upstream = FEEDS[week];

  if (!upstream) {
    return new Response(JSON.stringify({ error: 'Invalid week parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const res = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingJournal/1.0)',
        Accept: 'application/json',
      },
      // Edge runtime caches 1h
      cf: { cacheTtl: 3600 },
    } as RequestInit);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${res.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'fetch failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
