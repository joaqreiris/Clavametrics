import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// Es un script de navegador: se evalúa como lo haría un <script>.
beforeAll(() => {
  globalThis.window = globalThis;
  (0, eval)(fs.readFileSync(path.join(ROOT, 'assets/media-embed.js'), 'utf8'));
});

describe('cmVideoEmbed · qué va en iframe y qué en video', () => {
  it('los proveedores se embeben como reproductor (iframe)', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://vimeo.com/123456789',
      'https://drive.google.com/file/d/1AbCdEf/view',
    ]) {
      expect(window.cmVideoEmbed(url), url).toMatchObject({ kind: 'frame' });
    }
  });

  // El fallo que se veía en Safari: un archivo dentro de un <iframe> no se
  // escala al marco, se pinta a tamaño intrínseco y sale cortado.
  it('los ARCHIVOS de video nunca son iframe', () => {
    for (const url of [
      'https://cdn.example.com/sesion.mp4',
      'https://cdn.example.com/sesion.MOV',
      'https://cdn.example.com/a.webm?token=abc',
      'https://x.supabase.co/storage/v1/object/public/v/drill.m4v',
      'https://www.dropbox.com/s/abc/clip.mp4?dl=0',
    ]) {
      expect(window.cmVideoEmbed(url), url).toMatchObject({ kind: 'file' });
    }
  });

  it('un enlace que no se puede embeber devuelve null', () => {
    expect(window.cmVideoEmbed('https://ejemplo.com/pagina')).toBeNull();
    expect(window.cmVideoEmbed('')).toBeNull();
    expect(window.cmVideoEmbed(null)).toBeNull();
  });

  it('dropbox se convierte en enlace directo al archivo', () => {
    const v = window.cmVideoEmbed('https://www.dropbox.com/s/abc/clip.mp4?dl=0');
    expect(v.src).toContain('dl.dropboxusercontent.com');
    expect(v.src).not.toContain('dl=0');
  });
});

describe('cmVideoHtml · el markup que se pinta', () => {
  it('archivo → <video>, proveedor → <iframe>', () => {
    expect(window.cmVideoHtml('https://cdn.example.com/s.mp4')).toContain('<video');
    expect(window.cmVideoHtml('https://cdn.example.com/s.mp4')).not.toContain('<iframe');
    expect(window.cmVideoHtml('https://youtu.be/dQw4w9WgXcQ')).toContain('<iframe');
  });

  it('usa el marco que se le pide, y cm-media por defecto', () => {
    expect(window.cmVideoHtml('https://cdn.example.com/s.mp4')).toContain('class="cm-media"');
    expect(window.cmVideoHtml('https://cdn.example.com/s.mp4', { className: 'sl-lb-video' })).toContain('class="sl-lb-video"');
  });

  it('autoplay siempre va con muted: sin eso Safari no arranca', () => {
    expect(window.cmVideoHtml('https://cdn.example.com/s.mp4')).toContain('autoplay muted');
  });

  it('no embebe un enlace que no sea http(s): eso sería XSS', () => {
    expect(window.cmVideoHtml('javascript:alert(1)')).toBe('');
    // Aunque pase el filtro de extensión, el esquema manda.
    expect(window.cmVideoHtml('javascript:alert(1)//x.mp4')).toBe('');
  });

  it('escapa las comillas del enlace para no romper el atributo', () => {
    const html = window.cmVideoHtml('https://cdn.example.com/a".mp4');
    expect(html).not.toContain('a".mp4');
    expect(html).toContain('&quot;');
  });
});
