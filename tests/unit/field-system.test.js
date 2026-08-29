import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// field-system.js builds real SVG nodes, so we give it the smallest DOM that lets it run.
// The point is not to check pixels — it is to make sure every sport actually DRAWS. A
// basketball court shipped for months as bare grass because basketballMarkings() threw a
// ReferenceError on its first line of arc maths and nothing anywhere caught it.
const ROOT = path.resolve(__dirname, '../..');

function makeNode(tag) {
  return {
    tagName: tag,
    attrs: {},
    children: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    set innerHTML(_v) { this.children = []; },
    get innerHTML() { return ''; },
  };
}

let CMField;

beforeAll(() => {
  globalThis.window = {};
  globalThis.document = { createElementNS: (_ns, tag) => makeNode(tag) };
  (0, eval)(fs.readFileSync(path.join(ROOT, 'assets/field-system.js'), 'utf8'));
  CMField = window.CMField;
});

// Every node in the tree, flattened.
function walk(node, out = []) {
  out.push(node);
  (node.children || []).forEach(c => walk(c, out));
  return out;
}

describe('field system · every sport draws', () => {
  const sports = () => Object.keys(CMField.FIELDS);

  it('exposes the sports the packs reference', () => {
    expect(sports()).toEqual(
      expect.arrayContaining(['football', 'futsal', 'basketball', 'hockey', 'rugby', 'blank']));
  });

  it('renders markings for every sport and variant without throwing', () => {
    sports().forEach(sport => {
      CMField.FIELDS[sport].variants.forEach(variant => {
        const host = makeNode('div');
        expect(() => CMField.renderField(host, sport, variant, 'h'),
          `${sport}/${variant} threw`).not.toThrow();
      });
    });
  });

  it('a full pitch actually has lines on it', () => {
    // 'blank' is a deliberate bare surface; every real sport must draw something.
    sports().filter(s => s !== 'blank').forEach(sport => {
      const host = makeNode('div');
      CMField.renderField(host, sport, 'full', 'h');
      const shapes = walk(host).filter(n =>
        ['line', 'rect', 'circle', 'path'].includes(n.tagName));
      expect(shapes.length, `${sport} drew ${shapes.length} shapes`).toBeGreaterThan(5);
    });
  });

  it('basketball draws its key, arcs and hoops', () => {
    const host = makeNode('div');
    CMField.renderField(host, 'basketball', 'full', 'h');
    const nodes = walk(host);
    const arcs = nodes.filter(n => n.tagName === 'path');
    // Per basket: restricted-area semicircle + three-point arc → 4 in total.
    expect(arcs.length).toBe(4);
    // No arc may carry an undefined sweep flag — that was the shape of the original bug.
    arcs.forEach(a => expect(a.attrs.d).not.toMatch(/undefined|NaN/));
    // Two hoops, two free-throw circles and the centre circle.
    expect(nodes.filter(n => n.tagName === 'circle').length).toBeGreaterThanOrEqual(5);
  });

  it('no sport emits NaN or undefined coordinates', () => {
    sports().forEach(sport => {
      CMField.FIELDS[sport].variants.forEach(variant => {
        const host = makeNode('div');
        CMField.renderField(host, sport, variant, 'h');
        walk(host).forEach(n =>
          Object.entries(n.attrs).forEach(([k, v]) =>
            expect(String(v), `${sport}/${variant} ${n.tagName}.${k}`).not.toMatch(/NaN|undefined/)));
      });
    });
  });

  it('tags the host with what it drew, and falls back to football when asked for nonsense', () => {
    const host = makeNode('div');
    const r = CMField.renderField(host, 'quidditch', 'full', 'h');
    expect(r.sport).toBe('football');
    expect(host.attrs['data-sport']).toBe('football');

    const host2 = makeNode('div');
    CMField.renderField(host2, 'basketball', 'full', 'v');
    expect(host2.attrs['data-sport']).toBe('basketball');
    expect(host2.attrs['data-orient']).toBe('v');
  });
});
