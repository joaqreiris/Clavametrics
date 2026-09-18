import { describe, it, expect } from 'vitest';
import { sdOf, MIN_SD } from '../../../lib/gp-card/resolver.js';

// El z-score es lo que convierte un "+12%" en un "¿es raro esto?". Un mismo +12% puede ser
// rutina en un grupo que se mueve mucho y una señal en uno que no se mueve nunca; la σ es la
// que distingue los dos casos, así que lo que hay que blindar es cuándo NO hay σ fiable.
describe('sdOf · la dispersión del conjunto de referencia', () => {
  it('calcula la desviación muestral (n−1), no la poblacional', () => {
    // [2,4,4,4,5,5,7,9]: σ poblacional = 2, muestral = 2,138…
    expect(sdOf([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.1381, 3);
  });

  it('devuelve null con menos de tres valores: con dos, la σ es ruido', () => {
    expect(sdOf([300, 400])).toBeNull();
    expect(sdOf([300])).toBeNull();
    expect(sdOf([])).toBeNull();
    expect(MIN_SD).toBe(3);
  });

  it('devuelve null cuando el grupo no tiene dispersión (σ=0)', () => {
    // Sin esto el z sería infinito y la celda diría cualquier cosa.
    expect(sdOf([420, 420, 420, 420])).toBeNull();
  });

  it('ignora nulos y NaN en vez de contarlos como ceros', () => {
    // Contarlos hundiría la media y inflaría la σ: el z saldría chico para todos.
    const conHuecos = sdOf([10, 20, 30, null, undefined, NaN]);
    expect(conHuecos).toBeCloseTo(sdOf([10, 20, 30]), 10);
  });

  it('un hueco de más deja el conjunto por debajo del mínimo y no inventa σ', () => {
    expect(sdOf([10, 20, null, null])).toBeNull();
  });
});

describe('el z que sale de μ y σ', () => {
  const z = (v, mu, sd) => (v - mu) / sd;

  it('un jugador en la media da 0, no "sin datos"', () => {
    expect(z(500, 500, 80)).toBe(0);
  });

  it('el signo distingue por encima de por debajo', () => {
    expect(z(660, 500, 80)).toBe(2);
    expect(z(340, 500, 80)).toBe(-2);
  });

  it('el mismo porcentaje pesa distinto según lo apretado que esté el grupo', () => {
    // +12% sobre 500 = 560. En un grupo apretado (σ=20) es una señal; en uno disperso
    // (σ=120) es rutina. Es exactamente la diferencia que el porcentaje solo no muestra.
    expect(z(560, 500, 20)).toBe(3);
    expect(z(560, 500, 120)).toBeCloseTo(0.5, 10);
  });
});
