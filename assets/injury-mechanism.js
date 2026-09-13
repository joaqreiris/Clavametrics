/* ── injury-mechanism.js — cómo se lesionó, en un solo lugar ───────────────────
 *
 * injuries.mechanism es texto libre. Lo escribe el <select> de Injuries.html con
 * 'contact', 'non-contact' (CON GUION), 'overuse', 'training' y 'other', pero en
 * la base conviven además valores viejos y escritos a mano, en tres idiomas.
 * Agrupar por el texto crudo dibuja dos barras para lo mismo — el mismo problema
 * que ya tenía body_area.
 *
 * Hubo una segunda columna, `injury_mechanism`, un enum con CHECK que venía de la
 * migración 014. Nunca la escribió ninguna pantalla: sólo la traía la data
 * sembrada, y leer una mientras el formulario llenaba la otra hacía que un club
 * entero viera "Sin registrar" en todas sus lesiones. La migración 149 volcó sus
 * 9 filas a `mechanism` y la eliminó. Si aparece en un dump viejo, se ignora.
 *
 * Devuelve SIEMPRE una de estas claves, y cada pantalla la traduce con su propio
 * diccionario (clinical_record.mech_* / co_dir.mech_*):
 *
 *   contact · non_contact · overuse · training_load · other · unknown
 *
 * 'other' y 'unknown' no son lo mismo y no hay que fusionarlos: 'other' es "se
 * cargó algo que no supe clasificar" y 'unknown' es "no se cargó nada". Para
 * quien lee un informe de lesiones, la diferencia es si falta el dato o falta el
 * criterio.
 */
(function () {
  if (window.cmInjuryMechanism) return;

  function deaccent(s) {
    const t = String(s == null ? '' : s);
    return t.normalize ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : t;
  }

  // Coincidencia exacta primero: es la que resuelve los valores del formulario.
  const EXACT = {
    contact: 'contact', contacto: 'contact', contato: 'contact',
    non_contact: 'non_contact', noncontact: 'non_contact',
    sin_contacto: 'non_contact', no_contacto: 'non_contact', sem_contato: 'non_contact',
    overuse: 'overuse', sobrecarga: 'overuse', sobreuso: 'overuse', sobreesfuerzo: 'overuse',
    training: 'training_load', training_load: 'training_load', carga: 'training_load',
    carga_de_entrenamiento: 'training_load', entrenamiento: 'training_load', treino: 'training_load',
    other: 'other', otro: 'other', otra: 'other', outro: 'other',
    unknown: 'unknown', desconocido: 'unknown', desconhecido: 'unknown', sin_dato: 'unknown'
  };

  /**
   * @param {object|string|null} inj  La lesión (usa .mechanism) o el texto suelto.
   * @returns {string} una de: contact | non_contact | overuse | training_load | other | unknown
   */
  window.cmInjuryMechanism = function (inj) {
    const raw = (inj && typeof inj === 'object')
      ? (inj.mechanism != null ? inj.mechanism : inj.injury_mechanism)   // dumps viejos
      : inj;
    const s = deaccent(raw).toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '');
    if (!s) return 'unknown';
    if (EXACT[s]) return EXACT[s];
    // Por subcadena, para el texto escrito a mano. El orden importa: "non_contact"
    // contiene "contact", así que lo negado tiene que ir primero.
    if (s.indexOf('non_contact') !== -1 || s.indexOf('sin_contact') !== -1 || s.indexOf('sem_contat') !== -1) return 'non_contact';
    if (s.indexOf('contact') !== -1 || s.indexOf('contat') !== -1 || s.indexOf('trauma') !== -1 || s.indexOf('golpe') !== -1 || s.indexOf('choque') !== -1) return 'contact';
    if (s.indexOf('overuse') !== -1 || s.indexOf('sobrecarga') !== -1 || s.indexOf('repetit') !== -1) return 'overuse';
    if (s.indexOf('train') !== -1 || s.indexOf('carga') !== -1 || s.indexOf('treino') !== -1) return 'training_load';
    return 'other';
  };

  // Las claves tal cual las guarda el <select> de Injuries.html, por si otra
  // pantalla necesita ofrecer las mismas opciones sin volver a escribirlas.
  window.cmInjuryMechanismValues = ['contact', 'non-contact', 'overuse', 'training', 'other'];
})();
