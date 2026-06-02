// POST /api/mt5sync
// Called by the MT5 EA via WebRequest.
// Body: JSON with userId, token, and trades array.
// Verifies the token against user metadata, then upserts trades into mt5_sync table.

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

interface SyncPayload {
  userId: string;
  token: string;
  trades: unknown[];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500);

  let payload: SyncPayload;
  try {
    payload = await req.json() as SyncPayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { userId, token, trades } = payload;
  if (!userId || !token || !Array.isArray(trades)) {
    return json({ error: 'Missing userId, token, or trades' }, 400);
  }

  // Verify token against user metadata
  const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!userRes.ok) return json({ error: 'User not found' }, 404);

  const user = await userRes.json() as { user_metadata?: { mt5_token?: string } };
  if (user.user_metadata?.mt5_token !== token) {
    return json({ error: 'Invalid token' }, 401);
  }

  // Upsert trades into mt5_sync table
  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/mt5_sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      trades,
      synced_at: new Date().toISOString(),
    }),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    return json({ error: `DB error: ${err}` }, 502);
  }

  return json({ ok: true, count: trades.length });
}
