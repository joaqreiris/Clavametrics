#!/usr/bin/env python3
"""Reconstruye db/schema.sql por introspeccion en vivo via Supabase Management API."""
import json, subprocess, urllib.request, sys

PROJECT = "xesrumijvdmqjrufgeka"
URL = f"https://api.supabase.com/v1/projects/{PROJECT}/database/query"
TOKEN = subprocess.check_output(
    ["security", "find-generic-password", "-s", "Supabase CLI", "-w"]
).decode().strip()

def q(sql):
    req = urllib.request.Request(
        URL, data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
                 "User-Agent": "curl/8.4.0"},
        method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# ---------------- columns ----------------
cols = q("""
select c.relname as tbl, a.attname as col,
  format_type(a.atttypid, a.atttypmod) as typ,
  a.attnotnull as notnull,
  pg_get_expr(ad.adbin, ad.adrelid) as dflt
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum
where c.relkind='r'
order by c.relname, a.attnum;
""")

# ---------------- constraints (p,u,c) ----------------
cons = q("""
select rel.relname as tbl, con.conname as name, con.contype as typ,
  pg_get_constraintdef(con.oid) as def
from pg_constraint con
join pg_class rel on rel.oid=con.conrelid
join pg_namespace n on n.oid=rel.relnamespace and n.nspname='public'
where con.contype in ('p','u','c')
order by rel.relname,
  (case con.contype when 'p' then 0 when 'u' then 1 else 2 end), con.oid;
""")

# ---------------- indexes (non-constraint) ----------------
idxs = q("""
select tbl.relname as tbl, pg_get_indexdef(i.indexrelid) as def
from pg_index i
join pg_class idx on idx.oid=i.indexrelid
join pg_class tbl on tbl.oid=i.indrelid
join pg_namespace n on n.oid=idx.relnamespace and n.nspname='public'
where not i.indisprimary
  and not exists (select 1 from pg_constraint c where c.conindid=i.indexrelid)
order by tbl.relname, idx.oid;
""")

# ---------------- foreign keys ----------------
fks = q("""
select rel.relname as tbl, con.conname as name, pg_get_constraintdef(con.oid) as def
from pg_constraint con
join pg_class rel on rel.oid=con.conrelid
join pg_namespace n on n.oid=rel.relnamespace and n.nspname='public'
where con.contype='f'
order by rel.relname, con.conname;
""")

# ---------------- functions ----------------
funcs = q("""
select p.proname as name, pg_get_functiondef(p.oid) as def
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
where p.prokind in ('f','p')
order by p.proname, p.oid;
""")

# ---------------- views ----------------
views = q("""
select c.relname as name, pg_get_viewdef(c.oid, true) as def
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.relkind='v'
order by c.relname;
""")

# ---------------- triggers ----------------
trigs = q("""
select c.relname as tbl, t.tgname as name, pg_get_triggerdef(t.oid) as def
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where not t.tgisinternal
order by c.relname, t.tgname;
""")

# ---------------- rls tables + policies ----------------
rls_tables = q("""
select c.relname as tbl, c.relrowsecurity as rls
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.relkind='r'
order by c.relname;
""")
pols = q("""
select rel.relname as tbl, pol.polname as name,
  pol.polcmd as cmd, pol.polpermissive as perm,
  pg_get_expr(pol.polqual, pol.polrelid) as qual,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as wcheck,
  (select array_agg(rolname order by rolname) from pg_roles where oid=any(pol.polroles)) as roles,
  (0 = any(pol.polroles)) as is_public
from pg_policy pol
join pg_class rel on rel.oid=pol.polrelid
join pg_namespace n on n.oid=rel.relnamespace and n.nspname='public'
order by rel.relname, pol.polname;
""")

# ===================== assemble =====================
out = []
def w(s=""): out.append(s)

# counts
n_tables = len({c["tbl"] for c in cols})
n_fks = len(fks)
n_views = len(views)
n_funcs = len(funcs)
n_trigs = len(trigs)
n_pols = len(pols)

w("-- =====================================================================")
w("-- ClavaMetrics — ESQUEMA COMPLETO de la DB (fuente de verdad unica)")
w("-- Reconstruido por introspeccion en vivo via Supabase Management API")
w("-- (proyecto xesrumijvdmqjrufgeka / Kime-app, PostgreSQL 17.6).")
w("-- Generado: 2026-07-05.  NO editar a mano: regenerar desde la DB.")
w("--")
w(f"-- {n_tables} tablas | {n_fks} FKs | {n_views} vistas | {n_funcs} funciones")
w(f"-- | {n_trigs} triggers | {n_pols} politicas RLS")
w("-- Incluye: tablas, tipos, PK/UNIQUE/CHECK, FK (con ON DELETE), indices,")
w("--          vistas, funciones (cuerpos reales), triggers, RLS + politicas.")
w("-- No incluye: GRANTs por rol, datos/seeds, objetos de schemas auth/storage.")
w("-- =====================================================================")
w("")
w("-- ============================ TABLAS ============================")
w("")

# group helpers
from collections import defaultdict, OrderedDict
cols_by = OrderedDict()
for c in cols:
    cols_by.setdefault(c["tbl"], []).append(c)
cons_by = defaultdict(list)
for c in cons: cons_by[c["tbl"]].append(c)
idx_by = defaultdict(list)
for i in idxs: idx_by[i["tbl"]].append(i)

for tbl, tcols in cols_by.items():
    lines = [f"create table if not exists public.{tbl} ("]
    body = []
    for c in tcols:
        seg = f"  {c['col']} {c['typ']}"
        if c["dflt"] is not None:
            seg += f" default {c['dflt']}"
        if c["notnull"]:
            seg += " not null"
        body.append(seg)
    for cn in cons_by.get(tbl, []):
        d = cn["def"]
        if cn["typ"] == "p":
            d = d.replace("PRIMARY KEY", "primary key", 1)
        body.append(f"  constraint {cn['name']} {d}")
    lines.append(",\n".join(body))
    lines.append(");")
    w("\n".join(lines))
    for i in idx_by.get(tbl, []):
        w(i["def"] + ";")
    w("")

w("-- ======================= FOREIGN KEYS =======================")
w("")
for f in fks:
    w(f"alter table public.{f['tbl']} add constraint {f['name']} {f['def']};")
w("")

w("-- ========================= FUNCIONES =========================")
w("")
for f in funcs:
    w(f["def"] + ";")
    w("")

w("-- =========================== VISTAS ===========================")
w("")
for v in views:
    w(f"create or replace view public.{v['name']} as")
    d = v["def"].rstrip()
    if not d.endswith(";"): d += ";"
    w(d)
    w("")

w("-- ========================== TRIGGERS ==========================")
w("")
for t in trigs:
    w(t["def"] + ";")
w("")

w("-- ===================== RLS Y POLITICAS =====================")
w("")
pols_by = defaultdict(list)
for p in pols: pols_by[p["tbl"]].append(p)
rls_on = {r["tbl"]: r["rls"] for r in rls_tables}
CMD = {"r": "select", "a": "insert", "w": "update", "d": "delete", "*": "all"}
for tbl in sorted(rls_on):
    if not rls_on[tbl] and tbl not in pols_by:
        continue
    if rls_on[tbl]:
        w(f"alter table public.{tbl} enable row level security;")
    for p in pols_by.get(tbl, []):
        perm = "permissive" if p["perm"] else "restrictive"
        cmd = CMD[p["cmd"]]
        if p["is_public"]:
            roles = "public"
        else:
            raw = (p["roles"] or "").strip("{}")
            roles = ", ".join(x for x in raw.split(",") if x)
        head = f'create policy "{p["name"]}" on public.{tbl} as {perm} for {cmd} to {roles}'
        seg = [head]
        if p["qual"] is not None:
            seg.append(f"  using ({p['qual']})")
        if p["wcheck"] is not None:
            seg.append(f"  with check ({p['wcheck']})")
        w("\n".join(seg) + ";")
    if rls_on[tbl] or tbl in pols_by:
        w("")

text = "\n".join(out).rstrip() + "\n"
with open(sys.argv[1], "w") as fh:
    fh.write(text)
print(f"wrote {sys.argv[1]}: {len(text.splitlines())} lines, {n_tables} tables")
