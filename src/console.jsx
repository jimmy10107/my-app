// Facilitator Console — aligned with Salary Bottle 4-stage model

function Console() {
  const [selectedStudent, setSelectedStudent] = React.useState(null);
  const [lockAll, setLockAll] = React.useState(false);
  const [showAnon, setShowAnon] = React.useState(false);

  const flagged = STUDENTS.filter(s => s.flag);
  const active = STUDENTS.filter(s => !s.idle);

  return (
    <div style={{ padding: "24px 32px 80px", display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 20, maxWidth: 1480, margin: "0 auto", alignItems: "flex-start" }} className="console-grid">
      <aside className="card" style={{ padding: 18, position: "sticky", top: 80 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>WORKSHOP · 春 04 梯</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>全班 · {STUDENTS.length} 人</div>
          </div>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3F8269", boxShadow: "0 0 0 3px #D9E4D6" }} />
        </div>

        <div style={{ fontSize: 12, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
          <span>進行中 <b style={{ color: "var(--ink)" }} className="mono">{active.length}</b></span>
          <span>預警 <b style={{ color: "#8E3A2A" }} className="mono">{flagged.length}</b></span>
          <span>閒置 <b style={{ color: "var(--ink-soft)" }} className="mono">{STUDENTS.length - active.length}</b></span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 480, overflowY: "auto", margin: "0 -6px" }}>
          {STUDENTS.map(s => (
            <button key={s.id} onClick={() => setSelectedStudent(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6,
                background: selectedStudent === s.id ? "var(--bg-sunken)" : "transparent",
                textAlign: "left", fontFamily: "var(--font-sans)", border: "none", cursor: "pointer",
              }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: s.idle ? "var(--bg-sunken)" : "var(--bg-elev)",
                border: `1.5px solid ${s.flag === "red" ? "#B5503D" : s.flag === "yellow" ? "#C99A2E" : s.idle ? "var(--line)" : "#3F8269"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 500, color: "var(--ink)", flexShrink: 0, fontFamily: "var(--font-serif)",
              }}>{showAnon ? s.id.slice(-2) : s.alias[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{showAnon ? s.id : s.alias}</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 1 }}>
                  {s.idle ? "尚未開始" : `Stage ${s.stage} · ${s.progress}% · ${s.holland}`}
                </div>
              </div>
              {s.flag && (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.flag === "red" ? "#B5503D" : "#C99A2E", animation: "pulse 1.6s ease-in-out infinite" }} />
              )}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: 14, marginTop: 12, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
          <ToggleRow label="匿名代號顯示" value={showAnon} onChange={setShowAnon} />
          <ToggleRow label="全體鎖定畫面" value={lockAll} onChange={setLockAll} tone="warn" />
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Panel title="全班四階段進度" subtitle="Stage Progress · 即時分佈">
          <StageProgressBar />
        </Panel>

        <Panel title="群體價值引力場" subtitle="Value Heatmap · Stage 2 共識 · 含流失率標記">
          <Heatmap data={VALUE_HEAT} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 18 }}>
            <StatTile label="最大公約數" value="獨立自主 · 持續進步 · 利他助人" caption="建議作為總結主軸" color="#3E5A8C" />
            <StatTile label="最高流失 (重要→Top 3)" value="安全感 -14%" caption="社會期望 vs 真實渴望" color="#B5503D" />
            <StatTile label="孤島價值" value="冒險挑戰 · 環境永續" caption="小組分享時可多關注" color="#C99A2E" />
          </div>
        </Panel>

        <Panel title="認知摩擦力監測" subtitle="Stage 2 殘酷二選一 · 停留時間 & 來回拖拽">
          <FrictionChart />
        </Panel>

        <Panel title="學員縮圖同步" subtitle="1:12 即時畫面 · 點擊個案深入">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }} className="mini-grid">
            {STUDENTS.map(s => (
              <StudentMini key={s.id} student={s} lockAll={lockAll}
                selected={selectedStudent === s.id}
                onClick={() => setSelectedStudent(s.id)} anon={showAnon} />
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 80 }}>
        <Panel title="個案預警" subtitle={`Intervention Radar · ${flagged.length} 則`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {flagged.map(s => (
              <AlertCard key={s.id} student={s} onClick={() => setSelectedStudent(s.id)} />
            ))}
          </div>
        </Panel>

        <Panel title="AI 引導副駕" subtitle={selectedStudent ? `Co-Pilot · 針對 ${STUDENTS.find(s=>s.id===selectedStudent)?.alias}` : "Co-Pilot · 選一位學員"}>
          {selectedStudent ? <AiSuggestions student={STUDENTS.find(s => s.id === selectedStudent)} /> : (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--ink-soft)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
              點擊左側名單任一位學員<br />取得三個引導問題建議
            </div>
          )}
        </Panel>

        <Panel title="流控中心" subtitle="Live Orchestration">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "var(--font-sans)" }}>
            <OrchBtn label="推播：進入下一 Stage" hint="全體學員倒數 60s" />
            <OrchBtn label="推播：Stage 2 殘酷二選一" hint="提醒「只能留三張」" />
            <OrchBtn label="推播：揭曉 Stage 4 矩陣" hint="Top 3 職業 × 價值維度" tone="primary" />
          </div>
        </Panel>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .4; transform: scale(1.3); }
        }
        @media (max-width: 1180px) {
          .console-grid { grid-template-columns: 240px 1fr !important; }
          .console-grid > :nth-child(3) { display: none !important; }
        }
        @media (max-width: 780px) {
          .console-grid { grid-template-columns: 1fr !important; }
          .console-grid > aside { position: static !important; }
          .mini-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function StageProgressBar() {
  const counts = [1,2,3,4].map(n => STUDENTS.filter(s => s.stage === n && !s.idle).length);
  const idle = STUDENTS.filter(s => s.idle).length;
  const total = STUDENTS.length;
  const labels = ["探索職業興趣", "釐清核心價值觀", "盤點優勢與缺口", "擬定行動計畫"];
  const colors = ["#8B6849", "#3E5A8C", "#6A8268", "#C99A2E"];
  return (
    <div>
      <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
        {counts.map((c, i) => (
          <div key={i} style={{ flex: c || 0.001, background: colors[i], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontFamily: "var(--font-sans)", fontWeight: 500 }}>
            {c > 0 && c}
          </div>
        ))}
        {idle > 0 && <div style={{ flex: idle, background: "var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)", fontSize: 11, fontFamily: "var(--font-sans)" }}>{idle}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 10, fontFamily: "var(--font-sans)", fontSize: 11 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i] }} />
            <span style={{ color: "var(--ink-muted)" }}>S{i+1} · {l}</span>
            <span className="mono" style={{ marginLeft: "auto", color: "var(--ink)" }}>{counts[i]}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--line)" }} />
          <span style={{ color: "var(--ink-muted)" }}>尚未開始</span>
          <span className="mono" style={{ marginLeft: "auto", color: "var(--ink)" }}>{idle}</span>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, tone }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 4px", fontFamily: "var(--font-sans)", fontSize: 12,
      color: "var(--ink-muted)", background: "none", border: "none", cursor: "pointer",
    }}>
      <span>{label}</span>
      <span style={{
        width: 30, height: 18, borderRadius: 10,
        background: value ? (tone === "warn" ? "#B5503D" : "var(--ink)") : "var(--line)",
        position: "relative",
      }}>
        <span style={{
          position: "absolute", top: 2, left: value ? 14 : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: "var(--bg-elev)", transition: "left .2s",
        }} />
      </span>
    </button>
  );
}

function Heatmap({ data }) {
  const max = Math.max(...data.map(d => d.weight));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {data.map(d => {
        const scale = 0.75 + (d.weight / max) * 0.8;
        const weight = 400 + (d.weight / max) * 500;
        const color = d.island ? "#8E6A14" : d.delta < -5 ? "#8E3A2A" : "var(--ink)";
        return (
          <div key={d.name} style={{
            padding: "8px 14px",
            background: d.weight > 60 ? "#D6DFEE" : d.island ? "#F3E6C0" : d.delta < -10 ? "#F5D5CE" : "var(--bg-sunken)",
            borderRadius: 999,
            fontFamily: "var(--font-serif)",
            fontSize: `${14 * scale}px`,
            fontWeight: Math.round(weight / 100) * 100,
            color,
            display: "inline-flex", alignItems: "center", gap: 6,
            border: d.island ? "1.5px dashed #C99A2E" : "none",
          }}>
            {d.name}
            {d.delta !== 0 && (
              <span className="mono" style={{ fontSize: 10, opacity: 0.6 }}>
                {d.delta > 0 ? "↑" : "↓"}{Math.abs(d.delta)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatTile({ label, value, caption, color }) {
  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: "var(--bg-sunken)",
      borderTop: `3px solid ${color}`,
    }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", lineHeight: 1.35 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", marginTop: 4 }}>{caption}</div>
    </div>
  );
}

function FrictionChart() {
  const items = [
    { card: "安定感", cat: "value", avgSec: 82, peeks: 14, color: "#6B8CAE" },
    { card: "經濟報酬", cat: "value", avgSec: 71, peeks: 11, color: "#6B8CAE" },
    { card: "社會影響力", cat: "value", avgSec: 54, peeks: 8, color: "#6B8CAE" },
    { card: "冒險挑戰", cat: "value", avgSec: 42, peeks: 6, color: "#6B8CAE" },
  ];
  const max = Math.max(...items.map(i => i.avgSec));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(i => (
        <div key={i.card} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--ink)", fontFamily: "var(--font-serif)" }}>{i.card}</span>
          <div style={{ height: 18, background: "var(--bg-sunken)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
            <div style={{ width: `${(i.avgSec / max) * 100}%`, height: "100%", background: i.color, opacity: 0.85 }} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)", textAlign: "right" }}>
            {i.avgSec}s · ↔ {i.peeks}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "var(--ink-soft)", fontFamily: "var(--font-sans)", marginTop: 6, lineHeight: 1.6 }}>
        「安定感」停留時間是全班平均 2.4 倍 — 可能是此梯群體共同的「內在衝突點」。
      </div>
    </div>
  );
}

function StudentMini({ student, lockAll, selected, onClick, anon }) {
  // Show up to 3 vocation cards + stage dot
  const jobColors = student.top3Jobs.map(id => {
    const v = VOCATIONS.find(x => x.id === id);
    return v ? HOLLAND[v.hKey].solid : "#D8CEB9";
  });
  const stageColors = ["#8B6849", "#3E5A8C", "#6A8268", "#C99A2E"];
  return (
    <button onClick={onClick} style={{
      position: "relative", aspectRatio: "3 / 4", borderRadius: 8,
      background: student.idle ? "var(--bg-sunken)" : "var(--bg-elev)",
      border: `1.5px solid ${selected ? "var(--ink)" : student.flag === "red" ? "#B5503D" : student.flag === "yellow" ? "#C99A2E" : "var(--line)"}`,
      padding: 0, overflow: "hidden", cursor: "pointer", transition: "transform .2s",
    }}>
      <div style={{
        padding: "6px 8px", fontSize: 10, fontFamily: "var(--font-sans)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: student.idle ? "transparent" : "var(--bg-sunken)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>{anon ? student.id : student.alias}</span>
        <span className="mono" style={{ color: "var(--ink-soft)" }}>S{student.stage}</span>
      </div>
      <div style={{ position: "relative", height: "calc(100% - 46px)", padding: 6 }}>
        {!student.idle && (
          <div style={{ display: "flex", gap: 3, justifyContent: "center", alignItems: "flex-end", height: "100%", paddingBottom: 6 }}>
            {jobColors.filter(c => c !== "#D8CEB9").slice(0, 3).map((c, i) => (
              <div key={i} style={{
                width: 12, height: 22 + i * 4,
                borderRadius: 2, background: c,
                boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                transform: `rotate(${(i - 1) * 5}deg)`,
              }} />
            ))}
          </div>
        )}
        {student.idle && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--ink-soft)", fontFamily: "var(--font-sans)" }}>尚未開始</div>
        )}
        {lockAll && !student.idle && (
          <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 6px, rgba(255,255,255,.25) 6px 12px)` }} />
        )}
        {student.flag && (
          <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: student.flag === "red" ? "#B5503D" : "#C99A2E", animation: "pulse 1.6s ease-in-out infinite" }} />
        )}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "var(--line-soft)" }}>
        <div style={{ width: `${student.progress}%`, height: "100%", background: student.flag ? "#B5503D" : stageColors[student.stage - 1] || "var(--ink)" }} />
      </div>
    </button>
  );
}

function AlertCard({ student, onClick }) {
  const isRed = student.flag === "red";
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: 14, borderRadius: 8,
      background: isRed ? "#F5D5CE" : "#F3E6C0",
      border: `1px solid ${isRed ? "#B5503D" : "#C99A2E"}`,
      fontFamily: "var(--font-sans)", display: "block", width: "100%", cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: isRed ? "#8E3A2A" : "#8E6A14", animation: "pulse 1.6s ease-in-out infinite" }} />
        <span className="mono" style={{ fontSize: 10, color: isRed ? "#8E3A2A" : "#8E6A14", letterSpacing: 2, fontWeight: 600 }}>
          {isRed ? "紅燈・高優先" : "黃燈・動力缺口"}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", fontFamily: "var(--font-serif)" }}>
        {student.alias} · Stage {student.stage}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4, lineHeight: 1.5 }}>
        {student.note}
      </div>
    </button>
  );
}

function AiSuggestions({ student }) {
  const jobTitles = student.top3Jobs.map(id => VOCATIONS.find(v => v.id === id)?.title).filter(Boolean);
  const q = [
    student.stage === 1
      ? `${student.alias} 的 Holland 主碼為 ${student.holland.split("/")[0]}，可問：「這三張『喜歡』的職業裡，你最想請誰做你一週的影子？」`
      : `${student.alias} 目標職業為「${jobTitles.join("、")}」，可問：「這三個選項裡，誰能讓你 10 年後不後悔？」`,
    `Top 3 價值為 ${student.topValues.join("、")}，可深問：「這三項之間，哪兩項最常彼此衝突？」`,
    `具體詮釋字數 ${student.words} 字${student.words < 60 ? "（偏少）" : ""}，引導他用「具體場景」描述一個瞬間。`,
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {q.map((text, i) => (
        <div key={i} style={{
          padding: 12, background: "var(--bg-sunken)", borderRadius: 8,
          borderLeft: "3px solid #3E5A8C", fontSize: 13, lineHeight: 1.65, fontFamily: "var(--font-sans)",
        }}>
          <span className="mono" style={{ fontSize: 10, color: "#3E5A8C", letterSpacing: 2, display: "block", marginBottom: 4 }}>Q{i+1}</span>
          {text}
        </div>
      ))}
    </div>
  );
}

function OrchBtn({ label, hint, tone }) {
  return (
    <button onClick={() => alert(label + " · 示意觸發")} style={{
      padding: "10px 14px", borderRadius: 8,
      border: `1px solid ${tone === "primary" ? "var(--ink)" : "var(--line)"}`,
      background: tone === "primary" ? "var(--ink)" : "transparent",
      color: tone === "primary" ? "var(--bg)" : "var(--ink)",
      textAlign: "left", cursor: "pointer",
    }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{hint}</div>
    </button>
  );
}

Object.assign(window, { Console });
