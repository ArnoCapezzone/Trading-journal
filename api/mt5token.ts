// GET /api/mt5token
// Requires a valid Supabase JWT (Authorization: Bearer <jwt>).
// Generates a random webhook token, stores it in user metadata,
// and returns it. Safe to call multiple times — only regenerates if missing.

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Missing Authorization header' }, 401);

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500);

  // Verify JWT and get user
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: serviceKey },
  });
  if (!userRes.ok) return json({ error: 'Invalid or expired token' }, 401);

  const user = await userRes.json() as { id: string; user_metadata?: { mt5_token?: string } };
  const userId = user.id;

  // Return existing token or generate a new one
  let token = user.user_metadata?.mt5_token;
  if (!token) {
    token = crypto.randomUUID();
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_metadata: { mt5_token: token } }),
    });
  }

  return json({ userId, token });
}
