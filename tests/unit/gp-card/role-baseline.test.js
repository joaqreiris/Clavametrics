import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { _roleGroupFor, roleNormAgg } from '../../../lib/gp-card/resolver.js';

// Roll-up real de positions.js: detailed → basic 6 → grupo.
const BASIC = { CB:'CB', LB:'FB', RB:'FB', FB:'FB', LW:'WG', RW:'WG', CM:'MF', CDM:'MF', ST:'ST', GK:'GK' };
const GROUP = { CB:'Defenders', LB:'Defenders', RB:'Defenders', FB:'Defenders',
                LW:'Wingers', RW:'Wingers', CM:'Midfielders', CDM:'Midfielders',
                ST:'Forwards', GK:'Goalkeepers' };

beforeAll(() => {
  globalThis.window = globalThis.window || {};
  window.cmPositionAt = (code, gran) => {
    if (code == null || code === '') return null;
    if (gran === 'basic') return BASIC[code] || null;
    if (gran === 'group') return GROUP[code] || null;
    return code;
  };
});
afterAll(() => { delete window.cmPositionAt; });

const row = (player_id, position) => ({ player_id, players: { position } });

describe('fetchRoleBaseline · grupo de referencia', () => {
  it('excluye al propio jugador de su referencia', () => {
    const rows = [row('me', 'CB'), row('a', 'CB'), row('b', 'CB'), row('c', 'CB')];
    const g = _roleGroupFor(rows, 'me', 'CB');
    expect(g.rows.every(r => r.player_id !== 'me')).toBe(true);
    expect(g.peers).toBe(3);
    expect(g.level).toBe('detailed');
  });

  it('sube a la línea (basic 6) cuando el puesto exacto no llega al mínimo', () => {
    // Un solo FB además del jugador → con LB y RB se llega a 3 compañeros.
    const rows = [row('me', 'FB'), row('a', 'FB'), row('b', 'LB'), row('c', 'RB'), row('d', 'ST')];
    const g = _roleGroupFor(rows, 'me', 'FB');
    expect(g.level).toBe('basic');
    expect(g.peers).toBe(3);
    expect(g.rows.map(r => r.player_id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('jugador único en su puesto: no se compara contra sí mismo', () => {
    // Antes el grupo quedaba en él solo → 100% siempre. Ahora sube de nivel y toma compañeros.
    const rows = [row('me', 'RW'), row('a', 'LW'), row('b', 'LW')];
    const g = _roleGroupFor(rows, 'me', 'RW');
    expect(g.rows.every(r => r.player_id !== 'me')).toBe(true);
    expect(g.peers).toBe(2);
  });

  it('sin compañeros en ningún nivel → grupo vacío (no hay referencia falsa)', () => {
    const g = _roleGroupFor([row('me', 'GK')], 'me', 'GK');
    expect(g.rows).toEqual([]);
    expect(g.peers).toBe(0);
  });

  it('posición desconocida → grupo vacío, NO el plantel entero', () => {
    const rows = [row('me', null), row('a', 'CB'), row('b', 'ST'), row('c', 'GK')];
    const g = _roleGroupFor(rows, 'me', null);
    expect(g.rows).toEqual([]);
  });
});

describe('roleNormAgg · normalización por exposición', () => {
  it('los volúmenes acumulados pasan a media por sesión', () => {
    expect(roleNormAgg('total')).toBe('avg');
  });
  it('el resto de agregaciones queda intacto', () => {
    ['avg', 'max', 'min', 'median', 'wavg'].forEach(a => expect(roleNormAgg(a)).toBe(a));
  });
});
