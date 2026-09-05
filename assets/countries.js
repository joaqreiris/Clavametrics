/* =============================================================================
   countries.js — catálogo de países compartido (Squad ↔ Lineup)
   -----------------------------------------------------------------------------
   `players.nationality` es texto libre y venía escrito a mano ("Brasil", "Brazil",
   "brasil "), así que la bandera del póster acertaba de casualidad. Este módulo da
   una sola lista canónica para el desplegable de Squad y un resolvedor de texto →
   ISO-3166 alpha-2 para pintar la bandera en cualquier pantalla.

   Guardamos el NOMBRE del país (no el código) para no romper las pantallas que ya
   muestran `nationality` como texto (Player, Dossier, Evaluations, GPS). El
   resolvedor indexa los nombres en en/es/pt, así que una ficha cargada en español
   sigue mostrando su bandera con la app en inglés.

   API global: window.cmCountries
     .list(lang)   → [{ code, name }] ordenado alfabéticamente
     .iso2(text)   → 'AR' | 'GB-ENG' | null
     .name(code, lang) → 'Argentina' | ''
     .flag(code)   → '🇦🇷' (emoji; en Windows sin glifo caen las dos letras)
   ========================================================================== */
(function () {
  'use strict';

  // ISO 3166-1 alpha-2. Los nombres los pone Intl.DisplayNames en el idioma de la
  // app, así que acá solo viven los códigos.
  const ISO2 = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ '
    + 'BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ '
    + 'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY '
    + 'HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB '
    + 'LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY '
    + 'MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO '
    + 'RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM '
    + 'TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');

  // El fútbol federa por separado a las cuatro británicas, así que van como países
  // propios con su bandera (secuencia de etiquetas, no par de indicadores).
  const SUBDIVISIONS = {
    'GB-ENG': { sub: 'gbeng', en: 'England',          es: 'Inglaterra',      pt: 'Inglaterra' },
    'GB-SCT': { sub: 'gbsct', en: 'Scotland',         es: 'Escocia',         pt: 'Escócia' },
    'GB-WLS': { sub: 'gbwls', en: 'Wales',            es: 'Gales',           pt: 'País de Gales' },
    'GB-NIR': { sub: null,    en: 'Northern Ireland', es: 'Irlanda del Norte', pt: 'Irlanda do Norte' },
  };

  const norm = s => String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Nombres informales que Intl no conoce.
  const ALIASES = {
    usa: 'US', eeuu: 'US', 'estados unidos': 'US', 'united states': 'US',
    uk: 'GB', 'reino unido': 'GB', 'gran bretana': 'GB',
    holanda: 'NL', holland: 'NL', 'paises bajos': 'NL',
    'corea del sur': 'KR', 'south korea': 'KR', 'corea del norte': 'KP',
    'costa de marfil': 'CI', 'ivory coast': 'CI', 'cabo verde': 'CV',
    'republica checa': 'CZ', 'czech republic': 'CZ', chequia: 'CZ',
    rusia: 'RU', turquia: 'TR', 'turkiye': 'TR', birmania: 'MM',
    inglaterra: 'GB-ENG', england: 'GB-ENG', escocia: 'GB-SCT', scotland: 'GB-SCT',
    gales: 'GB-WLS', wales: 'GB-WLS', 'pais de gales': 'GB-WLS',
    'irlanda del norte': 'GB-NIR', 'northern ireland': 'GB-NIR',
  };

  function lang () {
    const l = (window.CM_I18N && window.CM_I18N.current) || document.documentElement.lang || 'en';
    return String(l).slice(0, 2).toLowerCase();
  }

  const _dn = {};
  function displayNames (l) {
    if (!(l in _dn)) {
      try { _dn[l] = new Intl.DisplayNames([l], { type: 'region' }); }
      catch (_) { _dn[l] = null; }
    }
    return _dn[l];
  }

  function name (code, l) {
    if (!code) return '';
    l = l || lang();
    const sd = SUBDIVISIONS[code];
    if (sd) return sd[l] || sd.en;
    const d = displayNames(l);
    let n; try { n = d && d.of(code); } catch (_) { n = null; }
    return (n && n !== code) ? n : code;
  }

  const _lists = {};
  function list (l) {
    l = l || lang();
    if (_lists[l]) return _lists[l];
    const rows = ISO2.map(code => ({ code, name: name(code, l) }))
      .concat(Object.keys(SUBDIVISIONS).map(code => ({ code, name: name(code, l) })));
    rows.sort((a, b) => a.name.localeCompare(b.name, l));
    _lists[l] = rows;
    return rows;
  }

  // Índice nombre→código construido sobre en/es/pt: un jugador cargado en español
  // tiene que resolver su bandera aunque la app esté en inglés.
  let _index = null;
  function index () {
    if (_index) return _index;
    _index = new Map();
    ['en', 'es', 'pt'].forEach(l => {
      ISO2.forEach(code => {
        const k = norm(name(code, l));
        if (k && !_index.has(k)) _index.set(k, code);
      });
    });
    Object.entries(SUBDIVISIONS).forEach(([code, sd]) => {
      ['en', 'es', 'pt'].forEach(l => { const k = norm(sd[l]); if (k) _index.set(k, code); });
    });
    return _index;
  }

  function iso2 (raw) {
    const key = norm(raw);
    if (!key) return null;
    if (ALIASES[key]) return ALIASES[key];
    const up = String(raw || '').trim().toUpperCase();
    if (SUBDIVISIONS[up]) return up;
    if (/^[a-z]{2}$/.test(key) && ISO2.indexOf(key.toUpperCase()) >= 0) return key.toUpperCase();
    return index().get(key) || null;
  }

  const TAG = c => String.fromCodePoint(0xE0000 + c.charCodeAt(0));
  function flag (code) {
    if (!code) return '';
    const sd = SUBDIVISIONS[code];
    if (sd) {
      if (!sd.sub) return flag('GB');
      return '\u{1F3F4}' + [...sd.sub].map(TAG).join('') + '\u{E007F}';
    }
    if (code.length !== 2) return '';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }

  window.cmCountries = { list, iso2, name, flag };
})();
