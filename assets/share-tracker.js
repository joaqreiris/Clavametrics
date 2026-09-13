/* ============================================================
   ClavaMetrics — control de visionado de los cortes enviados a un jugador.

   Vive en video-share.html (la página pública del link personal) y su trabajo es
   contestar una pregunta que el "marcar como visto" no contesta: de los cinco
   cortes que le mandé, ¿cuáles miró, y los miró enteros?

   La precisión depende del reproductor, y eso NO se puede disimular:

     'player'    Dropbox y cualquier archivo directo (<video> nuestro), YouTube
                 (IFrame API) y Vimeo (Player SDK) → tiempo de reproducción real.
     'viewport'  Google Drive (su /preview no expone nada) y cualquier fallback →
                 sólo cuánto tiempo estuvo el corte en pantalla con la pestaña
                 activa. NO prueba que se haya reproducido.

   Este archivo es sólo la contabilidad: ni toca el DOM ni habla con la red. El
   cableado de cada reproductor y el envío del heartbeat están en video-share.html,
   y así la parte con reglas (qué suma, qué no, cuándo está completo) se puede
   probar sin navegador.

   Dos decisiones que explican casi todo el código:

   1) Arrastrar la barra hasta el final no cuenta como haber visto el video. Sólo
      suman los avances continuos del reloj del reproductor; un salto (hacia
      adelante o hacia atrás) mueve la posición pero no el tiempo visto.

   2) El heartbeat manda el ACUMULADO de la apertura en curso, no incrementos. Un
      beat perdido o repetido no descuadra nada, y el servidor sabe descontar lo
      que esa misma sesión ya había aportado (ver record_video_share_view).
   ============================================================ */
(function () {
  'use strict';

  // Salto máximo del reloj que todavía se considera reproducción continua. Los
  // reproductores avisan 3-4 veces por segundo; con la pestaña en segundo plano el
  // navegador espacia los timers, y 2.5 s deja pasar eso sin regalar un seek.
  var MAX_STEP = 2.5;
  // A partir de acá se da por visto: los últimos segundos son títulos, el jugador
  // que llegó al 92% de un corte táctico ya vio lo que había que ver.
  var COMPLETE_RATIO = 0.9;

  function num(v) { var n = Number(v); return isFinite(n) && n >= 0 ? n : 0; }

  /**
   * Contabilidad de UN corte dentro de UNA apertura del link.
   * @param {{duration?:number}} [opts]
   */
  function createClip(opts) {
    var o = opts || {};
    var duration = num(o.duration);
    var watched = 0;        // segundos de reproducción efectiva
    var position = 0;       // hasta dónde llegó
    var visible = 0;        // segundos en pantalla (fallback)
    var plays = 0;
    var completed = false;
    var playing = false;
    var lastT = null;       // último tiempo del reloj, para medir el avance
    var sawPlayer = false;  // ¿hubo alguna señal de un reproductor de verdad?
    var dirty = false;

    function setDuration(d) {
      d = num(d);
      if (d > 0 && d !== duration) { duration = d; sawPlayer = true; dirty = true; checkComplete(); }
    }
    function checkComplete() {
      if (!completed && duration > 0 && position >= duration * COMPLETE_RATIO) { completed = true; dirty = true; }
    }
    function play() {
      sawPlayer = true;
      if (!playing) { playing = true; plays += 1; dirty = true; }
      lastT = null;   // el primer tick después del play sólo fija el punto de partida
    }
    function pause() { playing = false; lastT = null; }
    function ended() {
      sawPlayer = true;
      playing = false; lastT = null;
      if (!completed) { completed = true; dirty = true; }
      if (duration > 0 && position < duration) { position = duration; dirty = true; }
    }
    /** Reloj del reproductor, en segundos. */
    function time(t) {
      t = num(t);
      sawPlayer = true;
      if (t > position) { position = t; dirty = true; }
      if (lastT != null) {
        var dt = t - lastT;
        // Avance continuo: suma. Salto (adelante o atrás): sólo reubica.
        if (dt > 0 && dt <= MAX_STEP) { watched += dt; dirty = true; }
      }
      lastT = t;
      checkComplete();
    }
    /** Segundos que el corte estuvo a la vista con la pestaña activa. */
    function addVisible(sec) {
      sec = num(sec);
      if (sec > 0) { visible += sec; dirty = true; }
    }

    return {
      setDuration: setDuration, play: play, pause: pause, ended: ended,
      time: time, addVisible: addVisible,
      isDirty: function () { return dirty; },
      /** Lo que viaja al servidor. Enteros: el medio segundo no le importa a nadie. */
      snapshot: function () {
        return {
          watched:   Math.round(watched),
          position:  Math.round(position),
          duration:  Math.round(duration),
          visible:   Math.round(visible),
          plays:     plays,
          completed: completed,
          tracking:  sawPlayer ? 'player' : 'viewport',
        };
      },
      markSent: function () { dirty = false; },
    };
  }

  /**
   * El conjunto de cortes de un envío, más el id de esta apertura.
   * @param {number} count cuántos cortes tiene el envío
   */
  function createSet(count) {
    var clips = [];
    for (var i = 0; i < count; i++) clips.push(createClip());
    var session = (function () {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      } catch (e) { /* navegadores viejos */ }
      return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    })();

    return {
      session: session,
      clip: function (i) { return clips[i] || null; },
      count: function () { return clips.length; },
      /**
       * Los cortes con algo nuevo que contar, listos para el beat.
       * @param {{all?:boolean}} [opts] all: manda todos, hayan cambiado o no (el
       *   último envío al cerrar la página, donde perder un beat es definitivo).
       */
      pending: function (opts) {
        var all = !!(opts && opts.all);
        var out = [];
        clips.forEach(function (c, i) {
          if (!all && !c.isDirty()) return;
          var s = c.snapshot();
          // Un corte que nunca se abrió ni se reprodujo no genera fila.
          if (!all && !s.plays && !s.visible && !s.position) return;
          if (all && !s.plays && !s.visible && !s.position) return;
          s.index = i;
          out.push(s);
        });
        return out;
      },
      markSent: function (items) {
        (items || []).forEach(function (it) {
          var c = clips[it.index];
          if (c) c.markSent();
        });
      },
    };
  }

  window.cmShareTracking = {
    createClip: createClip,
    createSet: createSet,
    MAX_STEP: MAX_STEP,
    COMPLETE_RATIO: COMPLETE_RATIO,
  };
})();
