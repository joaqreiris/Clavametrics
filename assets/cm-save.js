/* ────────────────────────────────────────────────────────────────────────────
   cm-save.js — Guardar solo lo que cambió, y no pisar al de al lado

   El problema: los autosaves mandan la ficha completa (13 campos) cada vez que
   se toca uno solo. Si dos personas editan la misma sesión —o la misma fila
   desde pantallas distintas: Calendar mueve el horario mientras Daily Planning
   edita las notas— el que guarda último devuelve a la base los valores viejos
   de todo lo que él no tocó, y el trabajo del otro desaparece sin un error.

   Dos defensas, en este orden:

   1. Se manda SOLO lo que cambió respecto de lo último que sabemos que hay en
      la base. Dos personas en campos distintos ya no se pisan: cada update
      toca su columna y nada más.

   2. El update va condicionado a `updated_at` (el que leímos al cargar). Si la
      fila cambió mientras tanto, no afecta ninguna fila: entonces se relee, se
      le avisa a la página para que refresque lo que el usuario NO tocó, y se
      reintenta sobre la versión nueva.

   Requiere que la tabla mantenga `updated_at` por trigger. Sin eso el paso 2
   no detecta nada, pero tampoco molesta: se comporta como antes.

   Uso:
     const r = await window.cmSave.patch({
       table: 'training_sessions', id: sessionId, clubId,
       prev: _dpSaved,          // lo que creemos que hay en la base
       next: payload,           // lo que hay en pantalla
       since: _dpSince,         // updated_at leído al cargar
       onRemote: (fila, mios) => pintarLoQueNoToqué(fila, mios),
     });
     // r.status: 'ok' | 'noop' | 'merged' | 'conflict' | 'gone' | 'error'
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  if (window.cmSave) return;

  // Igualdad para valores de columna: los jsonb se comparan por contenido.
  function igual(a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (typeof a === 'object' || typeof b === 'object') {
      try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
    }
    return false;
  }

  function diff(prev, next) {
    const out = {};
    Object.keys(next || {}).forEach(k => {
      if (!prev || !igual(prev[k], next[k])) out[k] = next[k];
    });
    return out;
  }

  async function patch(o) {
    const cambios = o.patch || diff(o.prev, o.next);
    if (!Object.keys(cambios).length) return { status: 'noop', sent: {} };

    let since = o.since || null;
    for (let intento = 0; intento < 2; intento++) {
      let q = window.sb.from(o.table).update(cambios).eq('id', o.id);
      if (o.clubId) q = q.eq('club_id', o.clubId);
      // Sin `since` (fila recién creada, o tabla sin trigger de updated_at) el
      // update va sin condición: mismo comportamiento que antes.
      if (since) q = q.eq('updated_at', since);

      const { data, error } = await q.select('updated_at');
      if (error) return { status: 'error', error, sent: cambios };
      if (data && data.length) {
        return { status: intento ? 'merged' : 'ok', updatedAt: data[0].updated_at, sent: cambios };
      }

      // Cero filas: alguien la tocó desde que la leímos (o ya no existe).
      const { data: fila } = await window.sb.from(o.table).select('*').eq('id', o.id).maybeSingle();
      if (!fila) return { status: 'gone', sent: cambios };
      // La página refresca lo que el usuario NO está editando, así ve lo del
      // otro sin perder lo suyo.
      if (o.onRemote) { try { o.onRemote(fila, cambios); } catch (e) { console.warn('[cmSave] onRemote', e); } }
      since = fila.updated_at || null;
    }
    // Dos intentos y la fila sigue moviéndose: alguien está guardando encima
    // ahora mismo. Se corta acá en vez de reintentar para siempre.
    return { status: 'conflict', sent: cambios };
  }

  window.cmSave = { diff, patch, igual };
})();
