/* Documentos legales: dónde vive cada uno y cómo se deja constancia de que se aceptó.
 *
 * Hasta la 174 la casilla obligatoria del registro no dejaba rastro en la base — la
 * opcional (marketing) sí. Todo lo que escribe pasa por record_legal_acceptance(), que
 * es security definer: el club sale del perfil y la IP de la cabecera, así que desde acá
 * no se puede falsear ni quién aceptó ni cuándo.
 *
 * Al subir una versión de un documento: cambiar VERSIONS y actualizar el .html. Una
 * versión nueva NO borra la anterior, se apila — que es lo que permite demostrar qué
 * texto estaba vigente en cada fecha.
 */
(function () {
  'use strict';

  var VERSIONS = { terms: '1.0', privacy: '1.0', dpa: '1.0' };

  // El castellano es el documento sin sufijo; los otros dos llevan el suyo.
  var PAGES = {
    terms:   { es: 'Terms.html',   en: 'Terms-en.html',   pt: 'Terms-pt.html'   },
    privacy: { es: 'Privacy.html', en: 'Privacy-en.html', pt: 'Privacy-pt.html' },
  };

  function lang() {
    var l = (window.CM_I18N && window.CM_I18N.current) || 'en';
    return PAGES.terms[l] ? l : 'en';
  }

  // URL del documento en el idioma activo. El DPA todavía no tiene página propia: se
  // devuelve null para que quien lo pinte sepa que no hay nada que enlazar, en vez de
  // dejar un href="#" — que es exactamente el bug que tenía Register.html.
  function url(doc) {
    var p = PAGES[doc];
    return p ? p[lang()] : null;
  }

  function sb() { return window.sb || null; }

  // Registra una aceptación. Devuelve { ok, id } | { ok:false, error }.
  // Nunca lanza: que falle el registro no puede tumbar el alta de un club — se avisa por
  // consola y queda para reintentar, porque el mal menor es tener el club sin la prueba,
  // no perder el club.
  async function record(doc, opts) {
    opts = opts || {};
    var client = sb();
    if (!client) return { ok: false, error: new Error('sin cliente supabase') };
    try {
      var res = await client.rpc('record_legal_acceptance', {
        p_document:    doc,
        p_version:     VERSIONS[doc],
        p_signer_name: opts.signerName || null,
        p_signer_role: opts.signerRole || null,
      });
      if (res.error) throw res.error;
      return { ok: true, id: res.data };
    } catch (err) {
      console.error('[legal] no se pudo registrar la aceptación de ' + doc + ':', err);
      return { ok: false, error: err };
    }
  }

  // Términos y Privacidad se aceptan con la misma casilla: se registran los dos, y no en
  // paralelo — dos RPC simultáneas sobre el mismo perfil recién creado se pisaban.
  async function recordSignup() {
    var t = await record('terms');
    var p = await record('privacy');
    return { ok: t.ok && p.ok, terms: t, privacy: p };
  }

  async function status(clubId) {
    var client = sb();
    if (!client) return null;
    var res = await client.rpc('club_legal_status', { p_club_id: clubId || null });
    if (res.error) { console.error('[legal] club_legal_status:', res.error); return null; }
    var out = {};
    (res.data || []).forEach(function (r) { out[r.document] = r.version ? r : null; });
    return out;
  }

  // ¿Le falta el DPA a este club y le aplica el gate? Ante la duda devuelve false: es la
  // base la que bloquea de verdad (trigger players_require_dpa), así que un fallo de red
  // acá no debe inventar un muro que no existe ni dejar pasar lo que la base frena.
  async function needsDpa(clubId) {
    var client = sb();
    if (!client || !clubId) return false;
    var res = await client.rpc('club_needs_dpa', { p_club_id: clubId });
    if (res.error) { console.error('[legal] club_needs_dpa:', res.error); return false; }
    return res.data === true;
  }

  window.CM_LEGAL = {
    VERSIONS: VERSIONS,
    url: url,
    record: record,
    recordSignup: recordSignup,
    status: status,
    needsDpa: needsDpa,
  };
})();
