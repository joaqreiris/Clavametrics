  function Scale({ value, onChange, lowLabel, highLabel }) {
    return (
      <>
        <div className="ph-scale">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n}
                    className={value === n ? "is-on" : ""}
                    onClick={() => onChange(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="ph-scale-ends">
          <span>{lowLabel}</span><span>{highLabel}</span>
        </div>
      </>
    );
  }

  function PhoneForm({ dark }) {
    const ctx = window.__WELLNESS_CTX;
    const firstName = ctx.playerName || 'there';
    const dateLabel = ctx.dateLabel  || new Date().toDateString();

    const [sleep,      setSleep]      = React.useState("7h 30m");
    const [sleepQ,     setSleepQ]     = React.useState(8);
    const [mood,       setMood]       = React.useState(8);
    const [fatigue,    setFatigue]    = React.useState(6);
    const [stress,     setStress]     = React.useState(3);
    const [soreness,   setSoreness]   = React.useState(4);
    const [body,       setBody]       = React.useState(new Set([]));
    const [note,       setNote]       = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [done,       setDone]       = React.useState(false);

    async function handleSubmit() {
      setSubmitting(true);
      const result = await window.submitWellness({ sleepQ, mood, fatigue, stress, soreness, body: [...body], note });
      setSubmitting(false);
      if (result.ok) setDone(true);
    }
    const toggle = (k) => {
      const n = new Set(body);
      n.has(k) ? n.delete(k) : n.add(k);
      setBody(n);
    };
    const hours = ["< 5h","5h","6h","6h 30m","7h","7h 30m","8h","8h 30m","9h+"];
    const bodyParts = [
      { k:"hamstring", l:"Hamstring" },
      { k:"quads", l:"Quads" },
      { k:"calves", l:"Calves", icon:"alert-triangle" },
      { k:"groin", l:"Groin" },
      { k:"knee", l:"Knee" },
      { k:"ankle", l:"Ankle" },
      { k:"shoulder", l:"Shoulder" },
      { k:"back", l:"Lower back" },
    ];

    return (
      <IOSDevice width={386} height={812} dark={dark}>
        <div className={`ph ${dark ? "ph-dark" : ""}`}>
          <div className="ph-header">
            <span className="date">{dateLabel}</span>
            <div className="avatar">{firstName[0]?.toUpperCase() || '?'}</div>
          </div>

          <div className="ph-hero">
            <span className="eyebrow"><span className="dot"></span>Daily check-in</span>
            <h1>Good morning, {firstName}.</h1>
            <p>Match tomorrow vs Atlético. Tell us how you slept and how you're feeling — it takes 40 seconds.</p>
          </div>

          <div className="ph-context-row">
            <div className="ph-context">
              <div className="l">Microcycle</div>
              <div className="v"><span className="accent">14</span> · Day 7</div>
            </div>
            <div className="ph-context">
              <div className="l">Next session</div>
              <div className="v">17:00 · activation</div>
            </div>
            <div className="ph-context">
              <div className="l">Streak</div>
              <div className="v"><span className="accent">{ctx.streak || 0}</span> days</div>
            </div>
          </div>

          {/* Sleep duration */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-moon"></i></span>
              <span className="title">How long did you sleep?</span>
              <span className="val">{sleep}</span>
            </div>
            <div className="ph-hours">
              {hours.map(h => (
                <button key={h} className={sleep === h ? "is-on" : ""} onClick={() => setSleep(h)}>{h}</button>
              ))}
            </div>
          </div>

          {/* Sleep quality */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-zzz"></i></span>
              <span className="title">Sleep quality</span>
              <span className="val">{sleepQ} / 10</span>
            </div>
            <Scale value={sleepQ} onChange={setSleepQ} lowLabel="Poor" highLabel="Excellent" />
          </div>

          {/* Mood */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-mood-smile"></i></span>
              <span className="title">Mood</span>
              <span className="val">{mood} / 10</span>
            </div>
            <Scale value={mood} onChange={setMood} lowLabel="Low" highLabel="Great" />
          </div>

          {/* Fatigue */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-battery-2"></i></span>
              <span className="title">Fatigue</span>
              <span className="val">{fatigue} / 10</span>
            </div>
            <Scale value={fatigue} onChange={setFatigue} lowLabel="Drained" highLabel="Fresh" />
          </div>

          {/* Stress */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-brain"></i></span>
              <span className="title">Stress</span>
              <span className="val">{stress} / 10</span>
            </div>
            <Scale value={stress} onChange={setStress} lowLabel="Calm" highLabel="High" />
          </div>

          {/* Soreness */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-bandage"></i></span>
              <span className="title">Muscle soreness</span>
              <span className="val">{soreness} / 10</span>
            </div>
            <Scale value={soreness} onChange={setSoreness} lowLabel="None" highLabel="Severe" />
          </div>

          {/* Body parts */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-pin"></i></span>
              <span className="title">Anywhere specific?</span>
              <span className="val" style={{ font:"500 12px/1 var(--cm-font-mono)" }}>{body.size > 0 ? `${body.size} selected` : "Optional"}</span>
            </div>
            <div className="ph-body-row">
              {bodyParts.map(p => (
                <button key={p.k} className={`ph-body-chip ${body.has(p.k) ? "is-on" : ""}`} onClick={() => toggle(p.k)}>
                  {body.has(p.k) && p.icon && <i className={`ti ti-${p.icon}`}></i>}
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="ph-section">
            <div className="q-label">
              <span className="ti"><i className="ti ti-message-2"></i></span>
              <span className="title">Anything else?</span>
              <span className="val" style={{ font:"500 12px/1 var(--cm-font-mono)" }}>Optional</span>
            </div>
            <textarea className="ph-note" placeholder="A small twinge during yesterday's session, nothing major…" value={note} onChange={e => setNote(e.target.value)}></textarea>
          </div>

          <div className="ph-submit-wrap">
            {done
              ? <button className="ph-submit" style={{ background:"#15803D", cursor:"default" }}>
                  <i className="ti ti-check" style={{ fontSize:16 }}></i> Submitted
                </button>
              : <button className="ph-submit" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Sending…" : <>Send check-in <i className="ti ti-arrow-right" style={{ fontSize:16 }}></i></>}
                </button>
            }
          </div>
        </div>
      </IOSDevice>
    );
  }

  function PhoneSuccess({ dark }) {
    const ctx = window.__WELLNESS_CTX;
    const firstName = ctx.playerName || 'there';
    const dateLabel = ctx.dateLabel  || new Date().toDateString();

    // Build 7-day bar data from history
    const hist = ctx.history || [];
    const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const bars  = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const entry = hist.find(h => h.submitted_at?.slice(0, 10) === key);
      return { label: i === 6 ? 'Today' : days[d.getDay()], readiness: entry?.readiness ?? null };
    });
    const maxR = Math.max(...bars.map(b => b.readiness || 0), 1);

    return (
      <IOSDevice width={386} height={812} dark={dark}>
        <div className={`ph ${dark ? "ph-dark" : ""}`}>
          <div className="ph-header">
            <span className="date">{dateLabel}</span>
            <div className="avatar">{firstName[0]?.toUpperCase() || '?'}</div>
          </div>

          <div className="ph-streak">
            <div className="icon"><i className="ti ti-flame"></i></div>
            <div>
              <div className="l">{ctx.streak > 0 ? `Day ${ctx.streak} streak — keep it going!` : 'Start your streak today!'}</div>
              <div className="sub">Next: tomorrow at 8:00 am</div>
            </div>
          </div>

          <div className="ph-success">
            <div className="checkmark"><i className="ti ti-check"></i></div>
            <h2>Check-in sent.</h2>
            <p>Thanks, {firstName}. Your coach will see this in real-time.</p>

            <div className="ph-history">
              <div className="h-head">
                <span className="t">Your last 7 days</span>
                <span className="s">Readiness</span>
              </div>
              <div className="bars">
                {bars.map((b, i) => {
                  const pct = b.readiness != null ? Math.round((b.readiness / maxR) * 100) : 20;
                  const cls = b.readiness == null ? 'bar' : b.readiness >= 7 ? (i === 6 ? 'bar today' : 'bar') : b.readiness >= 5 ? 'bar warn' : 'bar danger';
                  return <div key={i} className={cls} style={{ height: `${pct}%` }}></div>;
                })}
              </div>
              <div className="labels">
                {bars.map((b, i) => (
                  <span key={i} className={`lbl${i === 6 ? ' today' : ''}`}>{b.label}</span>
                ))}
              </div>
            </div>

            <div className="ph-meta-list">
              <div className="ph-meta-row">
                <span className="ic"><i className="ti ti-moon"></i></span>
                <span className="l">Sleep quality</span>
                <span className="v">{ctx.lastEntry?.sleep_quality != null ? `${ctx.lastEntry.sleep_quality} / 10` : '—'}</span>
              </div>
              <div className="ph-meta-row">
                <span className="ic"><i className="ti ti-mood-smile"></i></span>
                <span className="l">Mood</span>
                <span className="v">{ctx.lastEntry?.mood != null ? `${ctx.lastEntry.mood} / 10` : '—'}</span>
              </div>
              <div className="ph-meta-row">
                <span className="ic"><i className="ti ti-battery-2"></i></span>
                <span className="l">Fatigue</span>
                <span className="v">{ctx.lastEntry?.fatigue != null ? `${ctx.lastEntry.fatigue} / 10` : '—'}</span>
              </div>
              <div className="ph-meta-row">
                <span className="ic" style={{ color:"#D97706", background:"#FFFBEB" }}><i className="ti ti-bandage"></i></span>
                <span className="l">Soreness</span>
                <span className="v" style={{ color:"#D97706" }}>{ctx.lastEntry?.soreness != null ? `${ctx.lastEntry.soreness} / 10` : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </IOSDevice>
    );
  }

  function PhonesHost() {
    const [dark, setDark] = React.useState(false);
    React.useEffect(() => {
      window.toggleDark = () => {
        setDark(d => {
          const next = !d;
          document.getElementById("darkLabel").textContent = next ? "Switch to light" : "Switch to dark";
          return next;
        });
      };
    }, []);
    return (
      <>
        {ReactDOM.createPortal(<PhoneForm dark={dark} />, document.getElementById("phone1"))}
        {ReactDOM.createPortal(<PhoneSuccess dark={dark} />, document.getElementById("phone2"))}
      </>
    );
  }
  const host = document.createElement("div");
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<PhonesHost />);
