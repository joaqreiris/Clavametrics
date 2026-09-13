// Quién puede operar la integración GPS.
//
// El permiso se decide en TRES lugares que tienen que decir lo mismo, y con dos vocabularios
// distintos: cmCanImportGps() acá (buckets), can_configure_gps() en la base (buckets, vía
// role_bucket()) y _SYNC_ROLES en supabase/functions/gps-sync/index.ts (slugs de rol). Si no
// coinciden, el rol ve el botón "Sincronizar" y el servidor le devuelve 403 — que es
// justamente lo que le pasaba a head_performance.
//
// head_performance entra por SLUG y no por bucket: su bucket es 'direction' y de ahí cuelga
// su acceso al módulo de dirección deportiva. Moverlo a 'sc' para arreglarle el GPS se lo
// sacaría. Por eso este test vigila las dos mitades: que pueda sincronizar Y que siga siendo
// dirección.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

let canImport, bucket, buckets;

beforeAll(async () => {
  // El módulo es de navegador: arranca creando el cliente contra el SDK que viene por CDN y
  // toca document/localStorage. Con los mínimos stubs se carga en node y se prueban las
  // funciones puras de permisos, que es lo único que mira este test.
  global.window = {};
  global.supabase = { createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => ({}), rpc: async () => ({ data: null }) }) };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const nodo = () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {} });
  global.document = { addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: nodo(), head: nodo(), body: nodo(), readyState: 'complete', createElement: nodo };
  await import('../../assets/supabase-init.js');
  canImport = global.window.cmCanImportGps;
  bucket = global.window.cmRoleBucket;
  buckets = global.window.cmRoleBuckets;
});

const perfil = (role, club_role = null) => ({ role, club_role });

describe('cmCanImportGps', () => {
  it('habilita a admin, owner y preparación física', () => {
    for (const r of ['admin', 'owner', 'sc_coach', 'fitness_coach']) {
      expect(canImport(perfil(r)), r).toBe(true);
    }
  });

  it('habilita al responsable de rendimiento', () => {
    expect(canImport(perfil('head_performance'))).toBe(true);
    // También como rol SECUNDARIO: el acceso efectivo es la unión de los dos.
    expect(canImport(perfil('coach', 'head_performance'))).toBe(true);
  });

  it('no se lo da al resto de la dirección ni al cuerpo médico', () => {
    for (const r of ['director_football', 'methodology_director', 'team_manager', 'coach', 'assistant_coach', 'physio', 'medical', 'analyst', 'staff']) {
      expect(canImport(perfil(r)), r).toBe(false);
    }
  });

  it('aguanta un perfil vacío sin romperse', () => {
    expect(canImport(null)).toBe(false);
    expect(canImport({})).toBe(false);
    expect(canImport(perfil(null, null))).toBe(false);
  });

  it('head_performance sigue en el bucket de dirección', () => {
    // Si esto se vuelve 'sc', el rol gana GPS pero pierde el módulo de dirección deportiva.
    expect(bucket('head_performance')).toBe('direction');
    expect(buckets(perfil('head_performance')).has('direction')).toBe(true);
  });
});

describe('_SYNC_ROLES en gps-sync (el gate del servidor)', () => {
  const src = readFileSync(new URL('../../supabase/functions/gps-sync/index.ts', import.meta.url), 'utf8');
  const listas = [...src.matchAll(/_SYNC_ROLES = new Set\(\[([^\]]+)\]\)/g)]
    .map(m => m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')));

  it('declara el mismo conjunto en cada punto de entrada', () => {
    expect(listas.length).toBeGreaterThan(1);
    for (const l of listas) expect(new Set(l)).toEqual(new Set(listas[0]));
  });

  it('coincide con lo que habilita la UI', () => {
    // Los slugs del servidor, pasados por la función de la UI: si la UI dice que sí, el
    // servidor tiene que dejarlo entrar, y al revés.
    for (const slug of listas[0]) expect(canImport(perfil(slug)), slug).toBe(true);
    expect(listas[0]).toContain('head_performance');
  });
});
