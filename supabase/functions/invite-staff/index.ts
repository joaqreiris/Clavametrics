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

    const { email, role, redirectTo, clubId, teamIds } = await req.json();
    let targetClub = caller?.club_id;
    if (clubId && (isSuper || clubId === caller?.club_id)) targetClub = clubId;
    if (!targetClub) return json({ error: 'No target club' }, 400);

    // ── Límite de staff del plan (workspace, plan más alto). Super-admin exento. ──
    if (!isSuper) {
      const [{ data: lim }, { data: cnt }] = await Promise.all([
        admin.rpc('club_staff_limit', { p_club_id: targetClub }),
        admin.rpc('club_staff_count', { p_club_id: targetClub }),
      ]);
      if (lim != null && (cnt ?? 0) >= lim) {
        // 200 (no 409) para que el cliente pueda leer el flag en `data`
        // (supabase-js mete los 4xx en `error`, no en `data`).
        return json({ staff_limit_reached: true, limit: lim }, 200);
      }
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return json({ error: 'Invalid email' }, 400);
    const cleanRole = String(role || 'staff');
    // Validar el rol contra la whitelist (mismo set que set_member_role): evita fabricar
    // roles arbitrarios ('owner', basura) que rompan la lógica de RLS.
    const ALLOWED_ROLES = ['admin','coach','physio','analyst','nutritionist','staff','sc_coach',
      'fitness_coach','gk_coach','assistant_coach','director_football','head_performance',
      'methodology_director','team_manager','owner'];
    if (!ALLOWED_ROLES.includes(cleanRole)) return json({ error: 'Invalid role' }, 400);
    const callerIsOwner = isSuper || ['owner'].includes(caller?.role) || ['owner'].includes(caller?.club_role);
    if (cleanRole === 'owner' && !callerIsOwner) return json({ error: 'Only an owner can invite an owner' }, 403);

    // Keep only team ids that actually belong to the target club (drop anything else).
    let cleanTeamIds: string[] | null = null;
    const reqTeamIds = Array.isArray(teamIds) ? teamIds.map(String) : [];
    if (reqTeamIds.length) {
      const { data: clubTeams } = await admin.from('teams')
        .select('id').eq('club_id', targetClub).in('id', reqTeamIds);
      const valid = new Set((clubTeams || []).map(t => t.id));
      const filtered = reqTeamIds.filter(id => valid.has(id));
      cleanTeamIds = filtered.length ? filtered : null;
    }

    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { club_id: targetClub, role: cleanRole },
      redirectTo: redirectTo || undefined,
    });
    const already = invErr && /already.*regist|already exists/i.test(invErr.message);
    if (invErr && !already) return json({ error: invErr.message }, 400);

    // ── Already-registered branch: the user keeps their existing password and
    //    never goes through set-password, so accept_invitation() would never run
    //    and the invite would sit 'pending' forever. Do the join server-side. ──
    let existingId: string | null = null;
    let joinerName: string | null = null;
    let autoJoined = false;
    let existingInAnotherClub = false;
    if (already) {
      // 1. Resolve the existing user's id by email (case-insensitive), paging users.
      try {
        for (let page = 1; page <= 20 && !existingId; page++) {
          const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (listErr) break;
          const users = list?.users || [];
          const hit = users.find(u => (u.email || '').toLowerCase() === cleanEmail);
          if (hit) existingId = hit.id;
          if (users.length < 200) break; // reached the last page
        }
      } catch (_) { /* fall through → keep today's pending fallback */ }

      if (existingId) {
        const { data: prevProfile } = await admin.from('profiles')
          .select('full_name, club_id').eq('id', existingId).maybeSingle();
        joinerName = prevProfile?.full_name ?? null;

        // SEGURIDAD (audit 2026-08): NO reasignar el club de un usuario que ya pertenece a
        // OTRO club — sería secuestro de cuenta cross-tenant (lo arranca de su club sin
        // consentimiento). En ese caso no tocamos su perfil y dejamos la invitación pendiente;
        // el usuario deberá aceptarla/cambiarse él mismo. Solo auto-unimos si no tiene club
        // (o ya está en este mismo club).
        if (prevProfile?.club_id && prevProfile.club_id !== targetClub) {
          existingInAnotherClub = true;
        } else {
          // 2a. Upsert the profile onto the target club, preserving any existing full_name.
          await admin.from('profiles').upsert({
            id: existingId, club_id: targetClub, role: cleanRole,
            email: cleanEmail, full_name: joinerName,
          }, { onConflict: 'id' });

          // 2b. Assign the chosen teams (skip duplicates).
          if (cleanTeamIds?.length) {
            await admin.from('member_teams').upsert(
              cleanTeamIds.map(t => ({ profile_id: existingId, team_id: t, club_id: targetClub })),
              { onConflict: 'profile_id,team_id', ignoreDuplicates: true });
          }

          // 2c. Apply the role's permission template (normal flow does this via
          //     accept_invitation → apply_role_template; auto-join must do it too).
          //     Best-effort: default permissions are secondary to the join itself.
          try {
            await admin.rpc('apply_role_template', { p_club: targetClub, p_profile: existingId, p_role: cleanRole });
          } catch (e) { console.warn('apply_role_template failed:', e?.message || e); }

          autoJoined = true;
        }
      }
    }

    // Invitation row: 'accepted' when we auto-joined, 'pending' otherwise (normal flow
    // and the rare case where the existing user couldn't be resolved).
    const invStatus = autoJoined ? 'accepted' : 'pending';
    const { data: row, error: rowErr } = await admin.from('invitations')
      .upsert({ club_id: targetClub, email: cleanEmail, role: cleanRole,
                status: invStatus, invited_by: user.id, team_ids: cleanTeamIds }, { onConflict: 'club_id,email' })
      .select('id, email, role, status, created_at').single();
    if (rowErr) return json({ error: rowErr.message }, 400);

    // 3. Best-effort "joined" activity entry + admin notifications for the auto-join.
    //    Service role bypasses RLS, so the direct activity_log insert is allowed.
    if (autoJoined && existingId) {
      try {
        await admin.from('activity_log').insert({
          club_id: targetClub, team_id: null, actor_id: existingId,
          action: 'member.joined', entity_table: 'profiles', entity_id: existingId,
          summary: { role: cleanRole, team_ids: cleanTeamIds, email: cleanEmail, via: 'already_registered' },
        });
      } catch (_) { /* best-effort */ }
      try {
        const { data: admins } = await admin.from('profiles')
          .select('id')
          .eq('club_id', targetClub)
          .neq('id', existingId)
          .or('role.in.(admin,owner),club_role.in.(admin,owner)');
        if (admins?.length) {
          const body = (joinerName || 'A new member') + ' joined the club';
          await admin.from('notifications').insert(admins.map(a => ({
            user_id: a.id, club_id: targetClub, type: 'member_joined',
            title: 'New member joined', body, link: '/Admin.html',
          })));
        }
      } catch (_) { /* best-effort */ }
    }

    return json({ invitation: row, alreadyRegistered: !!already, autoJoined, existingInAnotherClub });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
