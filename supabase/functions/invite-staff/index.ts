import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const URL = Deno.env.get('SUPABASE_URL');
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON = Deno.env.get('SUPABASE_ANON_KEY');

    const userClient = createClient(URL, ANON, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Not authenticated' }, 401);

    const admin = createClient(URL, SERVICE);
    const { data: caller } = await admin.from('profiles')
      .select('club_id, role, club_role').eq('id', user.id).single();
    const isAdmin = caller &&
      (['admin','owner'].includes(caller.role) || ['admin','owner'].includes(caller.club_role));
    const { data: superRow } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    const isSuper = !!superRow;
    if (!caller?.club_id && !isSuper) return json({ error: 'Not authorized' }, 403);
    if (!isAdmin && !isSuper) return json({ error: 'Not authorized' }, 403);

    const { email, role, redirectTo, clubId } = await req.json();
    let targetClub = caller?.club_id;
    if (clubId && (isSuper || clubId === caller?.club_id)) targetClub = clubId;
    if (!targetClub) return json({ error: 'No target club' }, 400);

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return json({ error: 'Invalid email' }, 400);
    const cleanRole = String(role || 'staff');

    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { club_id: targetClub, role: cleanRole },
      redirectTo: redirectTo || undefined,
    });
    const already = invErr && /already.*regist|already exists/i.test(invErr.message);
    if (invErr && !already) return json({ error: invErr.message }, 400);

    const { data: row, error: rowErr } = await admin.from('invitations')
      .upsert({ club_id: targetClub, email: cleanEmail, role: cleanRole,
                status: 'pending', invited_by: user.id }, { onConflict: 'club_id,email' })
      .select('id, email, role, status, created_at').single();
    if (rowErr) return json({ error: rowErr.message }, 400);

    return json({ invitation: row, alreadyRegistered: !!already });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
