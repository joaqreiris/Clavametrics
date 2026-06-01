#!/usr/bin/env python3
"""
ClavaMetrics — Generador de temporada completa (seed) para un club.
Autocontenido: incluye plantilla, calendario con lógica Match Day, modelo GPS por
posición, lesiones con fases de rehab (incl. return-to-running con GPS 'rehab'),
RPE, wellness (95% adherencia), tratamientos de fisio, evaluaciones, eventos de
microciclo y availability coherente.

USO:
    export SUPABASE_URL="https://<proyecto>.supabase.co"
    export SUPABASE_SERVICE_KEY="<service_role key>"     # NO la anon key
    export CLAVA_CLUB_ID="c3740000-0000-0000-0000-000000000001"
    export CLAVA_PROFILE_ID="<tu profile_id>"            # autor de las filas (opcional)

    python3 seed_season.py --dry-run    # cuenta todo, NO escribe (recomendado primero)
    python3 seed_season.py              # borra datos del club y genera la temporada

Requisitos:  pip install supabase  (o: pip install supabase --break-system-packages)
La service_role key saltea RLS. Trátala como secreto; no la subas al repo.
"""
import os, sys, random
from datetime import date, timedelta
from collections import Counter, defaultdict

# ============================ CONFIG ============================
SEED = 4231
random.seed(SEED)
DRY_RUN = "--dry-run" in sys.argv
BATCH = 500

CLUB_ID    = os.environ.get("CLAVA_CLUB_ID", "c3740000-0000-0000-0000-000000000001")
PROFILE_ID = os.environ.get("CLAVA_PROFILE_ID")  # None → campos de autoría quedan null

SEASON_START = date(2025, 7, 7)
SEASON_END   = date(2026, 5, 24)
WELLNESS_ADHERENCE = 0.95

# Una métrica custom de ejemplo (debe existir en gps_metric_definitions del club;
# el bloque 7 siembra core. Esta es opcional: si no existe la definición, igual
# se insertan los valores en gps_report_metrics con esta key).
CUSTOM_METRIC_KEY = "pct_vmax"   # % de la velocidad máxima personal alcanzada

# ============================ PLANTILLA ============================
POSITIONS = ([('GK','Goalkeeper')]*3 + [('DEF','Defender')]*8 +
             [('MID','Midfielder')]*8 + [('ATT','Forward')]*5)
FIRST_NAMES = ["Mateo","Lucas","Bruno","Iker","Adrián","Diego","Hugo","Pablo","Álvaro",
               "Marcos","Nico","Gael","Leo","Saúl","Pol","Unai","Aitor","Jorge","Rubén",
               "Sergio","David","Iván","Dani","Mario"]
LAST_NAMES  = ["Vázquez","Castro","Nogueira","Méndez","Figueroa","Outeiro","Soutullo",
               "Carballo","Lago","Refojo","Bermúdez","Pena","Ferreiro","Quintela","Vilas",
               "Rial","Doval","Seoane","Currás","Lema","Barreiro","Otero","Cores","Brea"]
NATIONALITIES = ["ESP"]*18 + ["POR","ARG","URY","BRA","FRA"]
JERSEY = {'GK':[1,13,25],'DEF':[2,3,4,5,15,18,22,24],'MID':[6,8,10,14,16,17,20,21],'ATT':[7,9,11,19,23]}

def build_squad():
    random.seed(SEED)
    fns, lns = FIRST_NAMES[:], LAST_NAMES[:]
    random.shuffle(fns); random.shuffle(lns)
    pools = {k:v[:] for k,v in JERSEY.items()}
    squad = []
    for i,(pos,_) in enumerate(POSITIONS):
        age = random.randint(18,34)
        dob = date(2025-age, random.randint(1,12), random.randint(1,28))
        squad.append(dict(club_id=CLUB_ID, first_name=fns[i], last_name=lns[i], position=pos,
            number=pools[pos].pop(0), date_of_birth=dob.isoformat(),
            nationality=random.choice(NATIONALITIES),
            height=round(random.uniform(1.85,1.98),2) if pos=='GK' else round(random.uniform(1.68,1.96),2),
            weight=round(random.uniform(64,88),1),
            dominant_foot=random.choice(['left','right','right','right']),
            status="available", notes=None))
    return squad

# ============================ CALENDARIO ============================
RIVALS = ["Sporting Arosa","CD Miño","Rácing Ferrol B","Atlético Lalín","UD Ourense",
          "SD Compostela B","Pontevedra CF B","CCD Cerceda","Bergantiños FC","Polvorín FC",
          "Estradense","Villalbés","Alondras CF","Choco Marín","Céltiga FC","As Pontes",
          "Silva SD","Boiro FC","Ribadumia","Gran Peña"]
MD_LOAD = {'MD-5':0.55,'MD-4':0.95,'MD-3':1.00,'MD-2':0.70,'MD-1':0.45,'MD':1.00,'MD+1':0.30,'MD+2':0.60}
MD_STYPE = {'MD-5':'recovery','MD-4':'training','MD-3':'training','MD-2':'tactical',
            'MD-1':'tactical','MD':'match','MD+1':'recovery','MD+2':'training'}
MD_COLOR = {'MD':'#ef4444'}

def season_weeks(start,end):
    d = start - timedelta(days=start.weekday()); out=[]
    while d<=end: out.append(d); d+=timedelta(days=7)
    return out

def build_calendar():
    random.seed(SEED)
    weeks = season_weeks(SEASON_START, SEASON_END)
    micros=[]; pre=4; rivals=RIVALS[:]; random.shuffle(rivals); ri=0
    for wi,mon in enumerate(weeks):
        is_pre = wi<pre
        mc_match = mon+timedelta(days=5)
        if mc_match>SEASON_END: mc_match=None
        rival=ha=comp=None
        if mc_match:
            rival=rivals[ri%len(rivals)]; ri+=1
            ha=random.choice(['home','away'])
            comp='friendly' if is_pre else 'league'
        micros.append(dict(
            id=f"MC{wi+1:02d}-{mon.isoformat()}", name=f"MC {wi+1:02d}", club_id=CLUB_ID,
            start_date=mon.isoformat(), end_date=(mon+timedelta(days=6)).isoformat(),
            match_date=mc_match.isoformat() if mc_match else None,
            type="preseason" if is_pre else "competitive",
            rival=rival, home_away=ha, color='#ef4444' if mc_match else '#94a3b8',
            match_time="18:00:00" if mc_match else None,
            _pre=is_pre, _comp=comp))
    return micros

def md_code(d, m):
    if not m: return None
    diff=(m-d).days
    if diff==0: return 'MD'
    return f'MD-{diff}' if diff>0 else f'MD+{abs(diff)}'

def sessions_for(mc):
    start=date.fromisoformat(mc["start_date"])
    m=date.fromisoformat(mc["match_date"]) if mc["match_date"] else None
    out=[]
    for off in range(7):
        d=start+timedelta(days=off)
        if m and d==m:
            out.append(dict(date=d, md_code='MD', type='match', load=1.0, is_match=True)); continue
        mdc=md_code(d,m)
        if mdc in MD_LOAD:
            out.append(dict(date=d, md_code=mdc, type=MD_STYPE[mdc], load=MD_LOAD[mdc], is_match=False))
        else:
            if d.weekday()==6: continue   # domingo libre
            out.append(dict(date=d, md_code=mdc, type='training', load=0.5, is_match=False))
    return out

def events_for(mc, ss):
    evs=[]
    for s in ss:
        d=s["date"].isoformat()
        if s["is_match"]:
            evs+=[dict(type="medical_check",title="Chequeo médico pre-partido",date=d,start_time="15:00:00"),
                  dict(type="walkthrough",title="Charla táctica",date=d,start_time="16:00:00"),
                  dict(type="lunch",title="Comida pre-partido",date=d,start_time="13:30:00")]
        else:
            evs.append(dict(type="breakfast",title="Desayuno",date=d,start_time="09:00:00"))
            if s["md_code"] in ('MD-4','MD-3'): evs.append(dict(type="gym",title="Gimnasio",date=d,start_time="11:30:00"))
            if s["md_code"] in ('MD-2','MD-1'): evs.append(dict(type="video_session",title="Análisis de vídeo",date=d,start_time="10:00:00"))
            if s["md_code"]=='MD-3': evs.append(dict(type="meeting",title="Reunión cuerpo técnico",date=d,start_time="08:30:00"))
    return evs

# ============================ MODELO GPS ============================
POS_PROFILE = {
    'GK':  dict(td=5200, hsr=120, vhsr=20, spr=10, sc=2, acc=14, dec=12, vmax=27.5, pl=380, hmld=90),
    'DEF': dict(td=10200,hsr=720, vhsr=240,spr=150,sc=20,acc=42, dec=40, vmax=32.0, pl=820, hmld=520),
    'MID': dict(td=11400,hsr=820, vhsr=210,spr=120,sc=17,acc=48, dec=46, vmax=31.0, pl=910, hmld=560),
    'ATT': dict(td=10600,hsr=940, vhsr=360,spr=240,sc=28,acc=46, dec=44, vmax=33.5, pl=850, hmld=600),
}
def jit(v,p=0.10): return v*random.uniform(1-p,1+p)

def baseline_for(pos):
    base=POS_PROFILE[pos]; f=random.uniform(0.88,1.12)
    return {k: base[k]*(f if k!='vmax' else random.uniform(0.96,1.04)) for k in base}

def gps_row(bl, load_mult, is_match, minutes=None, reduced=False):
    if is_match:
        minutes = minutes if minutes is not None else 90
        eff = minutes/90.0
    else:
        eff = load_mult*(0.6 if reduced else 1.0)
        minutes = int(round(60+40*load_mult))
    td=max(0,jit(bl['td']*eff)); hsr=max(0,jit(bl['hsr']*eff*random.uniform(0.9,1.15)))
    vhsr=max(0,jit(bl['vhsr']*eff*random.uniform(0.85,1.2))); spr=max(0,jit(bl['spr']*eff*random.uniform(0.8,1.25)))
    sc=max(0,round(jit(bl['sc']*eff))); acc=max(0,round(jit(bl['acc']*eff))); dec=max(0,round(jit(bl['dec']*eff)))
    vmax=bl['vmax']*(random.uniform(0.97,1.0) if eff>0.8 else random.uniform(0.82,0.94))
    pl=max(0,jit(bl['pl']*eff)); hmld=max(0,jit(bl['hmld']*eff)); dpm=(td/minutes) if minutes else 0
    pct_vmax = round(100*vmax/bl['vmax'],1)
    return dict(total_distance=round(td,1), high_speed_distance=round(hsr,1),
        very_high_speed_distance=round(vhsr,1), sprint_distance=round(spr,1),
        sprint_count=int(sc), accelerations=round(acc), decelerations=round(dec),
        max_speed=round(vmax,1), player_load=round(pl,1), hmld=round(hmld,1),
        time_played=int(minutes), distance_per_minute=round(dpm,1)), pct_vmax

# ============================ LESIONES ============================
INJURY_LIB = [
    dict(cat='muscular',area='Hamstring (isquiotibial)',sev='moderate',mech='non_contact',days=28),
    dict(cat='muscular',area='Cuádriceps',sev='minor',mech='overuse',days=14),
    dict(cat='ligament',area='Tobillo (LLE)',sev='moderate',mech='contact',days=35),
    dict(cat='muscular',area='Gemelo (sóleo)',sev='minor',mech='non_contact',days=16),
    dict(cat='tendon',area='Tendón rotuliano',sev='moderate',mech='overuse',days=30),
    dict(cat='acl',area='LCA rodilla',sev='severe',mech='non_contact',days=180),
    dict(cat='muscular',area='Aductor',sev='minor',mech='non_contact',days=12),
    dict(cat='bone',area='Metatarsiano (fisura)',sev='severe',mech='contact',days=70),
    dict(cat='ligament',area='Rodilla (LCM)',sev='moderate',mech='contact',days=40),
]
def build_phases(start, days):
    end=start+timedelta(days=days)
    sp=[0.45,0.30,0.25] if days<=16 else ([0.40,0.30,0.30] if days<=45 else [0.35,0.30,0.35])
    p1=start+timedelta(days=int(days*sp[0])); p2=p1+timedelta(days=int(days*sp[1]))
    phases=[dict(n=1,name="Fase aguda / fisioterapia",ptype="rest",s=start,e=p1),
            dict(n=2,name="Return to running",ptype="running",s=p1,e=p2),
            dict(n=3,name="Return to training",ptype="rtt",s=p2,e=end)]
    return phases,p1,p2,end

def assign_injuries(players):
    random.seed(SEED+1)
    field=[p for p in players if p['position']!='GK']
    chosen=random.sample(field,9)
    lib=INJURY_LIB[:]; random.shuffle(lib)
    injs=[]
    for i,pl in enumerate(chosen):
        spec=lib[i%len(lib)]
        start=SEASON_START+timedelta(days=random.randint(21,250))
        phases,p1,p2,end=build_phases(start,spec['days'])
        injs.append(dict(player=pl, spec=spec, start=start, end=end,
                         running_from=p1, rtt_from=p2, phases=phases))
    return injs

def state_on(d, player, injs):
    for inj in injs:
        if inj["player"] is player and inj["start"]<=d<=inj["end"]:
            if d<inj["running_from"]: return 'out', inj
            if d<inj["rtt_from"]:     return 'rehab', inj
            return 'modified', inj
    return 'ok', None

# ============================ INSERTOR ============================
class Writer:
    def __init__(self, sb):
        self.sb=sb; self.counts=Counter()
    def insert(self, table, rows):
        self.counts[table]+=len(rows)
        if DRY_RUN or not rows: return []
        out=[]
        for i in range(0,len(rows),BATCH):
            chunk=rows[i:i+BATCH]
            res=self.sb.table(table).insert(chunk).execute()
            out+=res.data or []
        return out

def author(d):
    """Agrega campos de autoría si hay PROFILE_ID."""
    if PROFILE_ID:
        d=dict(d)
    return d

# ============================ ORQUESTADOR ============================
def cleanup(sb):
    """Borra datos del club. players cascadea casi todo; el resto va explícito.
       availability.player_id es TEXT sin FK → se limpia aparte."""
    print("Limpieza del club…", "(dry-run, no borra)" if DRY_RUN else "")
    if DRY_RUN: return
    # tablas que cuelgan de clubs y NO cascadean desde players:
    for t in ["lineups","match_reports","calendar_events","microcycles",
              "training_sessions","evaluations","injuries","players"]:
        try:
            sb.table(t).delete().eq("club_id", CLUB_ID).execute()
        except Exception as e:
            print(f"  aviso al borrar {t}: {e}")
    # availability: player_id es text; borramos por club_id
    try: sb.table("availability").delete().eq("club_id", CLUB_ID).execute()
    except Exception as e: print(f"  aviso availability: {e}")

def run():
    sb = None if DRY_RUN else get_client()
    w = Writer(sb)
    if not DRY_RUN: cleanup(sb)

    # 1) PLAYERS
    squad = build_squad()
    player_rows = w.insert("players", squad)
    # mapear índice → id real (en dry-run usamos placeholder)
    for i,p in enumerate(squad):
        p["_id"] = player_rows[i]["id"] if player_rows else f"<player_{i}>"
        p["_baseline"] = baseline_for(p["position"])

    # 2) MICROCYCLES
    micros = build_calendar()
    mc_rows = [dict(id=m["id"], name=m["name"], club_id=CLUB_ID, start_date=m["start_date"],
                    end_date=m["end_date"], match_date=m["match_date"], type=m["type"],
                    rival=m["rival"], home_away=m["home_away"], color=m["color"],
                    match_time=m["match_time"]) for m in micros]
    w.insert("microcycles", mc_rows)

    # 3) INJURIES (precalcular para saber estados por fecha)
    injs = assign_injuries(squad)

    # 4) SESSIONS + EVENTS + GPS + RPE + WELLNESS
    sess_rows=[]; sess_index=[]   # paralelos para mapear ids
    event_rows=[]
    for m in micros:
        ss = sessions_for(m)
        for s in ss:
            title = (f"{m['name']} vs {m['rival']}" if s["is_match"]
                     else f"{m['name']} · {s['md_code'] or 'Training'}")
            row = dict(club_id=CLUB_ID, title=title, session_date=s["date"].isoformat(),
                       session_type=s["type"], microcycle_id=m["id"],
                       match_day_offset=s["md_code"], duration=int(round(60+40*s["load"])),
                       is_historical=False, session_attributes={
                           "microcycle": m["name"],
                           **({"md_code": s["md_code"]} if s["md_code"] else {}),
                           **({"rival": m["rival"]} if s["is_match"] and m["rival"] else {}),
                       })
            if PROFILE_ID: row["coach_id"]=PROFILE_ID
            sess_rows.append(row); sess_index.append((m,s))
        for e in events_for(m, ss):
            er = dict(club_id=CLUB_ID, title=e["title"], type=e["type"], date=e["date"],
                      start_time=e.get("start_time"))
            if PROFILE_ID: er["created_by"]=PROFILE_ID
            event_rows.append(er)

    sess_inserted = w.insert("training_sessions", sess_rows)
    w.insert("calendar_events", event_rows)

    # asignar ids de sesión
    for i,(m,s) in enumerate(sess_index):
        s["_id"] = sess_inserted[i]["id"] if sess_inserted else f"<sess_{i}>"

    # 5) GPS + métricas custom + RPE + wellness, respetando lesiones
    gps_rows=[]; metric_rows=[]; rpe_rows=[]; wellness_rows=[]
    avail_rows=[]
    # rehab "sessions" individuales: para los días en fase running, generamos GPS
    # en la sesión existente pero como tipo rehab si el jugador está en esa fase.
    # (la sesión de grupo sigue existiendo para los sanos)
    rehab_sessions=[]   # (player, date, mc) → sesión rehab individual a crear
    for (m,s) in sess_index:
        d=s["date"]
        for p in squad:
            st, inj = state_on(d, p, injs)
            if st=='out':
                continue  # sin GPS; availability se marca abajo
            if st=='rehab':
                # GPS en sesión rehab individual (no la de grupo)
                rehab_sessions.append((p, d, m, s))
                continue
            # ok / modified → GPS en la sesión de grupo
            reduced = (st=='modified')
            # GK no juega todos los amistosos completos; simplificación: GK juega match
            row, pct = gps_row(p["_baseline"], s["load"], s["is_match"],
                               minutes=(random.choice([90,90,90,75,60]) if s["is_match"] else None),
                               reduced=reduced)
            gps_rows.append(dict(player_id=p["_id"], session_id=s["_id"], club_id=CLUB_ID, **row,
                                 _pct=pct))
    # crear sesiones rehab individuales (una por jugador-fecha en fase running)
    rehab_sess_rows=[]
    for (p,d,m,s) in rehab_sessions:
        rehab_sess_rows.append(dict(club_id=CLUB_ID,
            title=f"Rehab · {p['first_name']} {p['last_name']}",
            session_date=d.isoformat(), session_type='rehab', microcycle_id=m["id"],
            match_day_offset=None, duration=40, is_historical=False,
            session_attributes={"microcycle": m["name"], "rehab": True},
            **({"coach_id":PROFILE_ID} if PROFILE_ID else {})))
    rehab_inserted = w.insert("training_sessions", rehab_sess_rows)
    for i,(p,d,m,s) in enumerate(rehab_sessions):
        sid = rehab_inserted[i]["id"] if rehab_inserted else f"<rehab_{i}>"
        row, pct = gps_row(p["_baseline"], 0.35, False, reduced=True)  # carga baja
        gps_rows.append(dict(player_id=p["_id"], session_id=sid, club_id=CLUB_ID, **row, _pct=pct))

    gps_inserted = w.insert("gps_reports", [{k:v for k,v in r.items() if k!='_pct'} for r in gps_rows])

    # métricas custom + RPE + wellness usan el id del report → sólo si insertamos de verdad
    for i,r in enumerate(gps_rows):
        rid = gps_inserted[i]["id"] if gps_inserted else f"<rep_{i}>"
        metric_rows.append(dict(report_id=rid, club_id=CLUB_ID, metric_key=CUSTOM_METRIC_KEY, value=r["_pct"]))
        # RPE/wellness 95%
        if random.random()<WELLNESS_ADHERENCE:
            dur=r["time_played"]; rpe_v=round(min(10,max(1, r["player_load"]/110)),0)
            rpe_rows.append(dict(player_id=r["player_id"], session_id=r["session_id"], club_id=CLUB_ID,
                                 rpe=rpe_v, duration=dur, load=round(rpe_v*dur,1)))
        if random.random()<WELLNESS_ADHERENCE:
            wellness_rows.append(dict(player_id=r["player_id"], club_id=CLUB_ID,
                sleep_quality=random.randint(5,9), fatigue=random.randint(3,8),
                soreness=random.randint(2,8), stress=random.randint(2,7),
                mood=random.randint(5,9), readiness=random.randint(4,9)))
    w.insert("gps_report_metrics", metric_rows)
    w.insert("rpe", rpe_rows)
    w.insert("wellness", wellness_rows)

    # 6) INJURIES + PHASES + TREATMENTS + AVAILABILITY
    inj_rows=[]
    for inj in injs:
        sp=inj["spec"]
        ir=dict(player_id=inj["player"]["_id"], club_id=CLUB_ID, injury_type=sp['area'],
                body_area=sp['area'], severity=sp['sev'], status='cleared',
                start_date=inj["start"].isoformat(), expected_return=inj["end"].isoformat(),
                returned_date=inj["end"].isoformat(), injury_category=sp['cat'],
                injury_mechanism=sp['mech'], treatment="Protocolo de readaptación por fases")
        if PROFILE_ID: ir["created_by"]=PROFILE_ID
        inj_rows.append(ir)
    inj_inserted = w.insert("injuries", inj_rows)

    phase_rows=[]; treat_rows=[]
    for k,inj in enumerate(injs):
        iid = inj_inserted[k]["id"] if inj_inserted else f"<inj_{k}>"
        for ph in inj["phases"]:
            phase_rows.append(dict(injury_id=iid, phase_number=ph["n"], phase_name=ph["name"],
                phase_type=ph["ptype"], start_date=ph["s"].isoformat(), end_date=ph["e"].isoformat(),
                status='done', criteria_met=True))
        # treatments de fisio durante la fase aguda (2-3 por semana)
        d=inj["start"]
        while d<inj["rtt_from"]:
            if d.weekday() in (0,2,4):
                tr=dict(club_id=CLUB_ID, player_id=inj["player"]["_id"], injury_id=iid,
                        date=d.isoformat(), treatment_type='rehab', type='fisioterapia',
                        pain_pre=random.randint(2,6), pain_post=random.randint(0,3),
                        player_status=random.choice(['improving','improving','stable']),
                        notes="Sesión de fisioterapia / readaptación")
                if PROFILE_ID: tr["physio_id"]=PROFILE_ID; tr["performed_by"]=PROFILE_ID
                treat_rows.append(tr)
            d+=timedelta(days=1)
    w.insert("injury_phases", phase_rows)
    w.insert("treatments", treat_rows)

    # availability: una fila por día de lesión con el estado correspondiente
    for inj in injs:
        d=inj["start"]
        while d<=inj["end"]:
            st,_=state_on(d, inj["player"], injs)
            status = {'out':'injured','rehab':'injured','modified':'modified'}.get(st,'available')
            avail_rows.append(dict(player_id=str(inj["player"]["_id"]), club_id=CLUB_ID,
                date=d.isoformat(), status=status, minutes=0))
            d+=timedelta(days=1)
    w.insert("availability", avail_rows)

    # 7) EVALUACIONES (tests físicos cada ~2 meses)
    eval_rows=[]
    test_dates=[SEASON_START+timedelta(days=x) for x in (5,70,140,210,280)]
    for p in squad:
        for td_ in test_dates:
            if td_>SEASON_END: continue
            eval_rows.append(dict(player_id=p["_id"], club_id=CLUB_ID, evaluation_type="physical",
                test_name="CMJ", test_type="jump", title="Counter Movement Jump",
                test_date=td_.isoformat(), value=round(random.uniform(32,46),1), unit="cm"))
    w.insert("evaluations", eval_rows)

    # ============================ RESUMEN ============================
    print("\n" + ("="*48))
    print("DRY-RUN — conteo de filas (no se escribió nada):" if DRY_RUN else "SEED COMPLETO — filas insertadas:")
    for t,c in sorted(w.counts.items(), key=lambda x:-x[1]):
        print(f"  {t:24} {c:>7,}")
    print(f"  {'TOTAL':24} {sum(w.counts.values()):>7,}")
    print("="*48)
    if DRY_RUN:
        print("\nTodo OK en simulación. Quitá --dry-run para escribir en la BD.")

def get_client():
    url=os.environ.get("SUPABASE_URL"); key=os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key: sys.exit("ERROR: faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY.")
    from supabase import create_client
    return create_client(url, key)

if __name__ == "__main__":
    if not DRY_RUN:
        print(f"⚠️  Esto BORRARÁ todos los datos del club {CLUB_ID} y generará una temporada nueva.")
        if input("Escribí 'BORRAR Y GENERAR' para continuar: ").strip() != "BORRAR Y GENERAR":
            sys.exit("Cancelado.")
    run()
