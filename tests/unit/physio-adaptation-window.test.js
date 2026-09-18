import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

// El fisio carga el tratamiento DESPUÉS de entrenar. Si la adaptación apunta al mismo día, la
// recomendación cae en una sesión ya hecha y no la aplica nadie: por eso el default es el día
// siguiente y por eso puede cubrir un rango (migración 189).

// phShiftDay vive dentro del <script> de Physio.html; se extrae la función y se evalúa sola para
// probar el archivo real, no una copia.
function loadPhysioDateHelpers() {
  const html = fs.readFileSync(path.join(ROOT, 'Physio.html'), 'utf8');
  const m = html.match(/function phShiftDay\(ymd, n\) \{[\s\S]*?\n\}\nconst phNextDay = [^\n]+/);
  if (!m) throw new Error('phShiftDay/phNextDay no encontrados en Physio.html');
  const cmYMD = d => d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return new Function('cmYMD', `${m[0]}; return { phShiftDay, phNextDay };`)(cmYMD);
}

// El espejo en cliente del filtro de la query, tal como está en la página.
function loadCoversDay(file, fnName) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = src.match(new RegExp(`function ${fnName}\\(row, day\\) \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`${fnName} no encontrado en ${file}`);
  return new Function(`${m[0]}; return ${fnName};`)();
}

describe('la adaptación del fisio apunta a la próxima sesión', () => {
  const { phShiftDay, phNextDay } = loadPhysioDateHelpers();

  it('el día siguiente es el día siguiente', () => {
    expect(phNextDay('2026-09-18')).toBe('2026-09-19');
  });

  it('cruza fin de mes y fin de año', () => {
    expect(phNextDay('2026-09-30')).toBe('2026-10-01');
    expect(phNextDay('2026-12-31')).toBe('2027-01-01');
    expect(phNextDay('2028-02-28')).toBe('2028-02-29');   // bisiesto
  });

  it('no se va un día por la zona horaria', () => {
    // new Date('2026-09-18') se parsea como UTC: al oeste de Greenwich da el 17.
    expect(phShiftDay('2026-09-18', 0)).toBe('2026-09-18');
    expect(phShiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('una fecha vacía o rota no inventa un día', () => {
    expect(phNextDay('')).toBe('');
    expect(phNextDay(null)).toBe(null);
    expect(phNextDay('no-es-fecha')).toBe('no-es-fecha');
  });
});

describe.each([
  ['Daily Planning', 'assets/pages/daily-planning.js', 'dpTreatmentCoversDay'],
  ['Gym Planner',    'Gym Planner.html',               'gpTreatmentCoversDay'],
])('%s — qué adaptaciones tocan el día abierto', (_name, file, fnName) => {
  const covers = loadCoversDay(file, fnName);

  it('sin «hasta», vale un solo día', () => {
    const t = { date: '2026-09-18', adaptation_date: '2026-09-19', adaptation_until: null };
    expect(covers(t, '2026-09-19')).toBe(true);
    expect(covers(t, '2026-09-18')).toBe(false);   // el día del tratamiento, ya entrenado
    expect(covers(t, '2026-09-20')).toBe(false);
  });

  it('con «hasta», vale todo el rango y ni un día más', () => {
    const t = { date: '2026-09-18', adaptation_date: '2026-09-19', adaptation_until: '2026-09-21' };
    expect(covers(t, '2026-09-18')).toBe(false);
    expect(covers(t, '2026-09-19')).toBe(true);
    expect(covers(t, '2026-09-20')).toBe(true);
    expect(covers(t, '2026-09-21')).toBe(true);    // inclusivo
    expect(covers(t, '2026-09-22')).toBe(false);
  });

  it('las filas viejas sin adaptation_date siguen colgando de la fecha del tratamiento', () => {
    const t = { date: '2026-09-18', adaptation_date: null, adaptation_until: null };
    expect(covers(t, '2026-09-18')).toBe(true);
    expect(covers(t, '2026-09-19')).toBe(false);
  });

  it('un timestamp en vez de una fecha no rompe la comparación', () => {
    const t = { date: '2026-09-18', adaptation_date: '2026-09-19T00:00:00+00:00', adaptation_until: null };
    expect(covers(t, '2026-09-19')).toBe(true);
  });

  it('sin fila o sin día, no toca nada', () => {
    expect(covers(null, '2026-09-19')).toBe(false);
    expect(covers({ adaptation_date: '2026-09-19' }, null)).toBe(false);
    expect(covers({ date: null, adaptation_date: null }, '2026-09-19')).toBe(false);
  });
});
