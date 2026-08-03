/* Shared helper for exercise folders/subfolders (field + gym libraries).
 * Backed by public.exercise_folders (kind = 'field' | 'gym', parent_id = free nesting,
 * team_id NULL = shared across all categories, a team id = private to that team).
 * Exercises reference a folder via exercises.folder_id / gym_exercises.folder_id
 * (NULL = "no folder", always listed first).
 *
 * Depends on: window.sb (Supabase client), window.getClubId(). Uses window.tt() for i18n if present.
 */
(function () {
  'use strict';

  const T = (k, f) => (typeof window.tt === 'function' ? window.tt(k, f) : f);
  const NONE_LABEL = () => T('folders.none', 'No folder');

  // Load every folder of a given kind for the current club, ordered for tree building.
  async function load(kind) {
    const clubId = await window.getClubId();
    if (!clubId) return [];
    const { data, error } = await window.sb
      .from('exercise_folders')
      .select('id,club_id,team_id,parent_id,kind,name,position')
      .eq('club_id', clubId)
      .eq('kind', kind || 'field')
      .order('position', { ascending: true })
      .order('name', { ascending: true });
    if (error) { console.error('[folders] load', error); return []; }
    return data || [];
  }

  // Folders relevant to a team context: shared (team_id null) + this team's folders.
  // teamId null/undefined (or kind gym) -> everything the club has.
  function visibleFor(folders, teamId) {
    if (!teamId) return folders.slice();
    return folders.filter(f => !f.team_id || f.team_id === teamId);
  }

  // Depth-first flatten so children follow their parent; carries a `depth` for indentation.
  function flatten(folders) {
    const byParent = new Map();
    folders.forEach(f => {
      const k = f.parent_id || '__root__';
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k).push(f);
    });
    const out = [];
    const walk = (parentKey, depth) => {
      const kids = byParent.get(parentKey) || [];
      kids.forEach(f => { out.push(Object.assign({ depth }, f)); walk(f.id, depth + 1); });
    };
    walk('__root__', 0);
    // Orphans (parent filtered out by team scope) still surface at root.
    const seen = new Set(out.map(f => f.id));
    folders.forEach(f => { if (!seen.has(f.id)) out.push(Object.assign({ depth: 0 }, f)); });
    return out;
  }

  // <option> markup for a folder <select>: "No folder" first, then the indented tree.
  function optionsHtml(folders, opts) {
    opts = opts || {};
    const list = flatten(visibleFor(folders, opts.teamId));
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let html = `<option value="">${esc(NONE_LABEL())}</option>`;
    html += list.map(f => {
      const pad = f.depth ? '  '.repeat(f.depth) : '';
      const sel = String(opts.selectedId || '') === f.id ? ' selected' : '';
      return `<option value="${f.id}"${sel}>${pad}${esc(f.name)}</option>`;
    }).join('');
    return html;
  }

  // Breadcrumb path "Parent / Child" for a folder id (for chips/labels in listings).
  function path(folders, id) {
    if (!id) return '';
    const byId = new Map(folders.map(f => [f.id, f]));
    const parts = [];
    let cur = byId.get(id), guard = 0;
    while (cur && guard++ < 50) { parts.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : null; }
    return parts.join(' / ');
  }

  async function create(o) {
    const clubId = await window.getClubId();
    const row = {
      club_id: clubId,
      kind: o.kind || 'field',
      name: (o.name || '').trim(),
      parent_id: o.parentId || null,
      team_id: o.teamId || null,
      position: o.position != null ? o.position : 0
    };
    if (!row.name) return { error: new Error('empty name') };
    const { data, error } = await window.sb.from('exercise_folders').insert(row).select('id,club_id,team_id,parent_id,kind,name,position').single();
    if (error) console.error('[folders] create', error);
    return { data, error };
  }

  async function rename(id, name) {
    const { error } = await window.sb.from('exercise_folders').update({ name: (name || '').trim() }).eq('id', id);
    if (error) console.error('[folders] rename', error);
    return { error };
  }

  // Deletes a folder; DB cascades subfolders and sets member exercises' folder_id to NULL.
  async function remove(id) {
    const { error } = await window.sb.from('exercise_folders').delete().eq('id', id);
    if (error) console.error('[folders] remove', error);
    return { error };
  }

  // Prompt-based create helper shared by the create/edit forms.
  // ctx: { kind, parentId, teamId } -> returns the new folder row or null.
  async function promptCreate(ctx) {
    const name = window.prompt(T('folders.new_prompt', 'New folder name'));
    if (name == null || !name.trim()) return null;
    const { data } = await create({ kind: (ctx && ctx.kind) || 'field', name, parentId: ctx && ctx.parentId, teamId: ctx && ctx.teamId });
    return data || null;
  }

  window.CMFolders = { load, visibleFor, flatten, optionsHtml, path, create, rename, remove, promptCreate, noneLabel: NONE_LABEL };
})();
