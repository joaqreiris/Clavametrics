/* Categorías tácticas — motor compartido (Tactical Planning + Daily Planning)
 *
 * Antes las seis categorías estaban escritas a mano en cada página y no se
 * podían renombrar ni ampliar. Ahora viven en `tactical_categories`, por club
 * y equipo: mientras el equipo no toque nada NO hay filas en la tabla y se
 * usan las seis de fábrica (mismo nombre, mismo color que siempre); al primer
 * cambio se materializan las seis y a partir de ahí manda la tabla.
 *
 * El color NO se guarda como hex sino como el nombre de un tono de la paleta
 * (`green`, `blue`, …): así cada tono tiene su valor propio en claro y en
 * oscuro, que es lo que un hex fijo no puede dar.
 *
 * La paleta está validada para daltonismo (skill dataviz, `validate_palette.js`)
 * en claro y oscuro **en este orden**: los pares vecinos son los que hay que
 * poder distinguir en una barra apilada. Por eso una categoría nueva toma por
 * defecto el siguiente tono de la lista, y por eso el orden importa. Si se
 * agregan tonos, revalidar la secuencia completa antes de tocar nada.
 */
(function(){
  'use strict';

  const PALETTE = [
    { slug:'green',   light:'#16A34A', dark:'#16A34A' },
    { slug:'blue',    light:'#2563EB', dark:'#3B82F6' },
    { slug:'amber',   light:'#D97706', dark:'#D97706' },
    { slug:'pink',    light:'#DB2777', dark:'#EC4899' },
    { slug:'violet',  light:'#7C3AED', dark:'#8B5CF6' },
    { slug:'teal',    light:'#0D9488', dark:'#0D9488' },
    { slug:'red',     light:'#DC2626', dark:'#EF4444' },
    { slug:'cyan',    light:'#0891B2', dark:'#0891B2' },
    { slug:'lime',    light:'#65A30D', dark:'#65A30D' },
    { slug:'indigo',  light:'#4F46E5', dark:'#6366F1' },
    { slug:'orange',  light:'#EA580C', dark:'#EA580C' },
    { slug:'fuchsia', light:'#C026D3', dark:'#D946EF' },
  ];

  // Las seis de siempre: mismas keys (los datos ya guardados las usan), mismos
  // colores. `en` es el respaldo cuando no hay traducción cargada.
  const DEFAULTS = [
    { key:'offensive',      en:'Offensive',            color:'green'  },
    { key:'defensive',      en:'Defensive',            color:'blue'   },
    { key:'transition_off', en:'Offensive transition', color:'amber'  },
    { key:'transition_def', en:'Defensive transition', color:'pink'   },
    { key:'set_pieces',     en:'Set pieces',           color:'violet' },
    { key:'other',          en:'Other',                color:'teal'   },
  ];

  // Un único <style> para las dos páginas: --tpc-<tono>, con su valor de cada tema.
  function injectPalette(){
    if (document.getElementById('cm-tac-palette')) return;
    const light = PALETTE.map(p => `--tpc-${p.slug}:${p.light}`).join(';');
    const dark  = PALETTE.map(p => `--tpc-${p.slug}:${p.dark}`).join(';');
    const st = document.createElement('style');
    st.id = 'cm-tac-palette';
    st.textContent = `:root{${light}}[data-theme="dark"]{${dark}}`;
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.head) injectPalette();
  else document.addEventListener('DOMContentLoaded', injectPalette);

  function defLabel(key){
    const d = DEFAULTS.find(x => x.key === key);
    const t = (window.CM_I18N && window.CM_I18N.t) ? window.CM_I18N.t('tactical.cat_' + key) : null;
    if (t && t !== 'tactical.cat_' + key) return t;
    return d ? d.en : key;
  }

  // Fila cruda de la tabla (o de fábrica) → lo que consume la UI.
  function normalize(row, i){
    const def = DEFAULTS.find(d => d.key === row.key);
    return {
      id: row.id || null,
      key: row.key,
      name: row.name || defLabel(row.key),
      custom_name: !!row.name,
      color: row.color || (def ? def.color : PALETTE[i % PALETTE.length].slug),
      position: row.position != null ? row.position : i,
      is_default: !!def,
    };
  }

  const api = {
    palette: PALETTE,
    defaults: DEFAULTS,

    // Las seis de fábrica, ya normalizadas — lo que ve un equipo que no tocó nada.
    factory(){ return DEFAULTS.map((d, i) => normalize({ key:d.key, color:d.color, position:i }, i)); },

    colorVar(cat){
      const slug = typeof cat === 'string' ? cat : (cat && cat.color);
      return PALETTE.some(p => p.slug === slug) ? `var(--tpc-${slug})` : 'var(--cm-fg-faint)';
    },

    // Objetivos viejos con una categoría que ya se borró: no se pierden, se
    // muestran con su etiqueta de fábrica (o la key cruda) y en gris.
    orphan(key){ return { id:null, key, name:defLabel(key), color:null, position:999, is_default:!!DEFAULTS.find(d=>d.key===key), orphan:true }; },

    // Devuelve {rows, cats}: `rows` son las filas reales de la tabla (vacío =
    // el equipo todavía usa las de fábrica), `cats` es lo que hay que pintar.
    async load(clubId, teamId){
      try {
        const { data, error } = await window.sb.from('tactical_categories')
          .select('id,key,name,color,position')
          .eq('club_id', clubId).eq('team_id', teamId)
          .order('position');
        if (error) throw error;
        const rows = data || [];
        if (!rows.length) return { rows: [], cats: api.factory() };
        return { rows, cats: rows.map(normalize) };
      } catch (e) {
        if (window.console) console.warn('[tactical-cats]', e && e.message);
        return { rows: [], cats: api.factory(), error: e };
      }
    },

    // Materializa las seis de fábrica la primera vez que el equipo cambia algo.
    // ignoreDuplicates para que dos entrenadores a la vez no choquen contra el unique.
    async materialize(clubId, teamId, userId){
      const rows = DEFAULTS.map((d, i) => ({
        club_id: clubId, team_id: teamId, key: d.key,
        name: null, color: d.color, position: i, created_by: userId || null,
      }));
      const { error } = await window.sb.from('tactical_categories')
        .upsert(rows, { onConflict: 'club_id,team_id,key', ignoreDuplicates: true });
      if (error) throw error;
    },

    // Key estable para una categoría nueva: no se traduce, no cambia al renombrar.
    newKey(){
      let s = '';
      for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 16).toString(16);
      return 'c_' + s;
    },

    // Siguiente tono libre de la secuencia (el orden ES la garantía CVD).
    nextColor(used){
      const taken = new Set(used || []);
      const free = PALETTE.find(p => !taken.has(p.slug));
      return (free || PALETTE[taken.size % PALETTE.length]).slug;
    },
  };

  window.cmTacticalCats = api;
})();
