#!/usr/bin/env python3
"""Convierte un PNG RGBA de 8 bits a PNG indexado (paleta de <=256 colores).

Sin dependencias: sólo zlib y struct. Pensado para dibujos planos —las
siluetas del módulo médico tienen ~1.000 colores, de los cuales 3 cubren el
90% y el resto son grises de suavizado de bordes.

Al final compara el resultado contra el original píxel a píxel y reporta el
error, para poder afirmar que la imagen no cambió de forma visible en vez de
suponerlo.
"""
import zlib, struct, collections, sys


def decode_rgba(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'no es PNG'
    pos, idat, meta = 8, b'', None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos + 4])[0]
        t = d[pos + 4:pos + 8]
        data = d[pos + 8:pos + 8 + ln]
        if t == b'IHDR':
            w, h, bd, ct, cm, fl, il = struct.unpack('>IIBBBBB', data)
            meta = (w, h, bd, ct, il)
        elif t == b'IDAT':
            idat += data
        pos += 12 + ln
    w, h, bd, ct, il = meta
    assert bd == 8 and ct == 6 and il == 0, f'esperaba RGBA 8-bit no entrelazado, hay {meta}'
    raw = zlib.decompress(idat)
    ch, stride = 4, w * 4
    out, prev, i = bytearray(), bytearray(stride), 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        if f:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                b = prev[x]
                c = prev[x - ch] if x >= ch else 0
                if f == 1:   line[x] = (line[x] + a) & 255
                elif f == 2: line[x] = (line[x] + b) & 255
                elif f == 3: line[x] = (line[x] + ((a + b) >> 1)) & 255
                else:
                    p = a + b - c
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                    line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
        out += line; prev = line
    return w, h, bytes(out)


def quantize(px, maxcol=256):
    """Paleta = los N colores más usados. El resto se mapea al más cercano.

    La distancia se mide en espacio PREMULTIPLICADO (r*a, g*a, b*a, a): en un
    píxel casi transparente el color apenas se ve, así que forzar que coincida
    desperdicia entradas de paleta; lo que sí importa siempre es el alfa.
    """
    counts = collections.Counter(px[i:i + 4] for i in range(0, len(px), 4))
    pal = [c for c, _ in counts.most_common(maxcol)]
    palset = {c: i for i, c in enumerate(pal)}
    if b'\x00\x00\x00\x00' in palset and palset[b'\x00\x00\x00\x00'] != 0:
        j = palset[b'\x00\x00\x00\x00']
        pal[0], pal[j] = pal[j], pal[0]
        palset = {c: i for i, c in enumerate(pal)}

    def pre(c):
        a = c[3] / 255.0
        return (c[0] * a, c[1] * a, c[2] * a, c[3])
    palpre = [pre(p) for p in pal]

    cache = dict(palset)
    for c in counts:
        if c in cache:
            continue
        cr, cg, cb, ca = pre(c)
        best, bd = 0, float('inf')
        for i, (pr, pg, pb, pa) in enumerate(palpre):
            d = (cr - pr) ** 2 + (cg - pg) ** 2 + (cb - pb) ** 2 + 2 * (ca - pa) ** 2
            if d < bd:
                bd, best = d, i
        cache[c] = best
    idx = bytes(cache[px[i:i + 4]] for i in range(0, len(px), 4))
    return pal, idx


def encode_indexed(w, h, pal, idx):
    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 3, 0, 0, 0)
    plte = b''.join(bytes(c[:3]) for c in pal)
    alphas = bytes(c[3] for c in pal)
    trns = alphas.rstrip(b'\xff')        # sólo hasta el último no-opaco

    # Filtrado por fila: se prueban los 5 y se elige el de menor suma absoluta,
    # que es la heurística que usa libpng.
    raw = bytearray()
    prev = bytearray(w)
    for y in range(h):
        line = idx[y * w:(y + 1) * w]
        cands = []
        f0 = bytes(line)
        cands.append((sum(min(b, 256 - b) for b in f0), 0, f0))
        f1 = bytes((line[x] - (line[x - 1] if x else 0)) & 255 for x in range(w))
        cands.append((sum(min(b, 256 - b) for b in f1), 1, f1))
        f2 = bytes((line[x] - prev[x]) & 255 for x in range(w))
        cands.append((sum(min(b, 256 - b) for b in f2), 2, f2))
        _, ftype, fdata = min(cands)
        raw += bytes([ftype]) + fdata
        prev = bytearray(line)

    out = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'PLTE', plte)
    if trns:
        out += chunk(b'tRNS', trns)
    out += chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    return out


def verify(orig_px, pal, idx):
    """Error entre el original y el resultado, canal por canal."""
    worst, total, n = 0, 0, len(idx)
    for i in range(n):
        o = orig_px[i * 4:i * 4 + 4]
        p = pal[idx[i]]
        d = max(abs(o[k] - p[k]) for k in range(4))
        worst = max(worst, d)
        total += d
    return worst, total / n


if __name__ == '__main__':
    for path in sys.argv[1:]:
        w, h, px = decode_rgba(path)
        pal, idx = quantize(px)
        data = encode_indexed(w, h, pal, idx)
        worst, mean = verify(px, pal, idx)
        import os
        before = os.path.getsize(path)
        out = path.replace('.png', '.opt.png')
        open(out, 'wb').write(data)
        print(f"{os.path.basename(path):<24} {before//1024:>4} KB → {len(data)//1024:>4} KB "
              f"({100 - len(data)*100//before:>2}% menos) | paleta {len(pal)} | "
              f"error máx {worst}/255, medio {mean:.2f}")
