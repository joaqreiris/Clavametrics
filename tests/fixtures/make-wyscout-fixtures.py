# -*- coding: utf-8 -*-
"""Genera los .xlsx de Wyscout que usan los e2e, sin depender de una librería.

Un .xlsx es un zip con XML adentro, y las celdas se pueden escribir con el texto
embebido (`inlineStr`) en vez de la tabla de cadenas compartidas: menos partes que
mantener y SheetJS lo lee igual.

    python3 tests/fixtures/make-wyscout-fixtures.py

Escribe `wyscout-team-stats-multi.xlsx`: el mismo export de Team Stats, pero pedido
por rango de jornadas — dos partidos, cuatro filas — que es como Wyscout lo entrega
cuando no se elige un partido puntual.
"""
import os, zipfile

def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))

def col(i):
    s = ''
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s

def sheet_xml(rows):
    out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
           '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
    for r, row in enumerate(rows, start=1):
        cells = []
        for c, v in enumerate(row):
            if v is None or v == '':
                continue
            ref = '%s%d' % (col(c), r)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                cells.append('<c r="%s"><v>%s</v></c>' % (ref, v))
            else:
                cells.append('<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, esc(v)))
        out.append('<row r="%d">%s</row>' % (r, ''.join(cells)))
    out.append('</sheetData></worksheet>')
    return ''.join(out)

PARTS = {
    '[Content_Types].xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '</Types>',
    '_rels/.rels':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>',
    'xl/workbook.xml':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Team Stats" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '</Relationships>',
}

def write(path, rows):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, body in PARTS.items():
            z.writestr(name, body)
        z.writestr('xl/worksheets/sheet1.xml', sheet_xml(rows))
    print('escrito', path)

# ── El export acumulado ─────────────────────────────────────────────────────────
# Los encabezados van sólo en la primera columna de cada grupo, y un grupo no siempre
# tiene tantos nombres como celdas: es la rareza que hay que conservar.
HEADER = ['Date', 'Match', 'Competition', 'Duration', 'Team', 'Scheme',
          'Goals', 'xG', 'Shots / on target', '', '', 'Possession, %',
          'Losses / Low / Medium / High', '', '', '',
          'Recoveries / Low / Medium / High', '', '', '',
          'Progressive passes / accurate', '', '',
          'Penalty area entries (runs / crosses)', '', '', 'PPDA']

def row(date, label, team, scheme, goals, xg, poss, ppda):
    return [date, label, 'Cambodian Premier League', 93, team, scheme,
            goals, xg, 12.0, 6.0, 50.0, poss,
            107.0, 21.0, 34.0, 52.0,
            65.0, 36.0, 21.0, 8.0,
            70.0, 49.0, 70.0,
            21.0, 9.0, 4.0, ppda]

def tag(text):
    r = [''] * len(HEADER)
    r[0] = text
    return r

MULTI = [
    HEADER,
    tag('Kompong Dewa'),
    tag('Opponents'),
    row('2026-09-05', 'Angkor Tiger - Kompong Dewa 0:0', 'Kompong Dewa', '4-3-3 (100.0%)', 0, 0.54, 62.14, 5.88),
    row('2026-09-12', 'Kompong Dewa - Visakha 2:1', 'Kompong Dewa', '4-4-2 (100.0%)', 2, 1.40, 55.30, 7.10),
    row('2026-09-05', 'Angkor Tiger - Kompong Dewa 0:0', 'Angkor Tiger', '5-3-2 (100.0%)', 0, 0.81, 37.86, 10.07),
    row('2026-09-12', 'Kompong Dewa - Visakha 2:1', 'Visakha', '4-2-3-1 (100.0%)', 1, 0.90, 44.70, 9.20),
]

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    write(os.path.join(here, 'wyscout-team-stats-multi.xlsx'), MULTI)
