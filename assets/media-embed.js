/* ============================================================
   ClavaMetrics — media embebida, un solo criterio para toda la app.

   Había cuatro copias de esta función (Exercises Library, Daily Planning,
   Gym Planner, Club Overview) y cada una decidía distinto qué hacer con un
   enlace de video. Tres de ellas metían los ARCHIVOS (.mp4, .mov, el enlace
   directo de Dropbox) dentro de un <iframe>.

   Eso se ve bien en Chrome y ROTO en Safari: cuando el iframe apunta a un
   archivo de video, WebKit genera su propio documento-reproductor y lo pinta
   al tamaño intrínseco del video en vez de escalarlo al marco. El resultado
   es el video corrido y cortado por el borde, con una franja negra al lado.
   Chrome sí lo escala, y por eso el fallo nunca aparecía en desarrollo.

   De ahí la regla: los proveedores (YouTube, Vimeo, Drive) van en <iframe>
   porque lo que se embebe es su reproductor; los archivos van en <video>,
   que es el elemento que sabe encajarse en su caja en todos los motores.
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Un javascript: en el src sería XSS. Las rutas relativas son legítimas, así
  // que la regla es al revés: si trae esquema explícito, sólo se acepta http(s).
  function safeUrl(u) {
    const s = String(u == null ? '' : u).trim();
    if (!s) return '';
    const scheme = s.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme && !/^https?$/i.test(scheme[1])) return '';
    return s;
  }

  /**
   * Clasifica un enlace de video pegado por el usuario.
   * @returns {{kind:'frame'|'file', src:string, provider:string, id?:string}|null}
   *   kind 'frame' → reproductor de un tercero, va en <iframe>.
   *   kind 'file'  → archivo de video, va en <video>.
   *   null         → no se puede embeber; ofrecer "abrir en pestaña nueva".
   */
  function cmVideoEmbed(url) {
    const u = String(url == null ? '' : url).trim();
    if (!u) return null;

    let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return { kind: 'frame', provider: 'youtube', id: m[1], src: 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&mute=1&rel=0&playsinline=1' };

    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { kind: 'frame', provider: 'vimeo', id: m[1], src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1&muted=1' };

    m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/);
    if (m) return { kind: 'frame', provider: 'drive', id: m[1], src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };

    // Dropbox sirve el archivo en crudo: es un archivo, no un reproductor.
    if (/dropbox\.com/.test(u)) return { kind: 'file', provider: 'dropbox', src: u.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '') };

    if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(u)) return { kind: 'file', provider: 'file', src: u };

    return null;
  }

  /**
   * Markup del reproductor, ya envuelto en su marco de proporción fija.
   * @param {string} url
   * @param {{className?:string, autoplay?:boolean}} [opts] className: el marco
   *   a usar (por defecto `cm-media`); pasá el de la página para no duplicar CSS.
   * @returns {string} '' si el enlace no se puede embeber.
   */
  function cmVideoHtml(url, opts) {
    const v = cmVideoEmbed(url);
    if (!v) return '';
    const o = opts || {};
    const cls = o.className || 'cm-media';
    const src = safeUrl(v.src);
    if (!src) return '';
    // autoplay exige muted en todos los navegadores; sin él, Safari no arranca.
    if (v.kind === 'file') {
      return '<div class="' + esc(cls) + '"><video src="' + esc(src) + '" controls playsinline preload="metadata"'
        + (o.autoplay === false ? '' : ' autoplay muted') + '></video></div>';
    }
    return '<div class="' + esc(cls) + '"><iframe src="' + esc(src) + '"'
      + ' allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen'
      + ' referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  }

  window.cmVideoEmbed = cmVideoEmbed;
  window.cmVideoHtml = cmVideoHtml;
})();
