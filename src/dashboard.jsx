// User Dashboard — 薪資水瓶 · 個人儀表板
function Dashboard() {
  const [snapshotIdx, setSnapshotIdx] = React.useState(2);
  const [expandedScore, setExpandedScore] = React.useState(null);
  const [integrationModal, setIntegrationModal] = React.useState(null);
  const snap = SNAPSHOTS[snapshotIdx];
  const prev = SNAPSHOTS[Math.max(0, snapshotIdx - 1)];

  // Top 5 core cards from most recent selection
  const top5Cards = SAMPLE_TOP5.map(id => ALL_CARDS.find(c => c.id === id)).filter(Boolean);
  const lastPickedAt = "2026.04.12 · 20:47";

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 96px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: 3, marginBottom: 8 }}>USER DASHBOARD · 個人儀表板</div>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 500, letterSpacing: "0.02em" }}>
            早安，<span style={{ color: "var(--ink)", borderBottom: "2px solid #C99A2E" }}>沛蓉</span>
          </h1>
          <div style={{ marginTop: 10, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", fontSize: 14 }}>
            你已完成 <b style={{ color: "var(--ink)" }}>3</b> 次完整四階段引導 · 最近一次於 2026.04.12
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnGhost} onClick={() => alert("匯出 PDF · 示意觸發")}>匯出 PDF</button>
          <button style={btnDark} onClick={() => alert("開始新一輪 · 導向 Stage 1")}>開始新一輪 →</button>
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "flex-start" }} className="dash-grid">
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel title="職涯時光機" subtitle="Career Timeline · 六維指標位移">
            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
              {SNAPSHOTS.map((s, i) => (
                <button key={s.date}
                  onClick={() => setSnapshotIdx(i)}
                  style={{
                    padding: "6px 12px", borderRadius: 20,
                    border: `1px solid ${i === snapshotIdx ? "var(--ink)" : "var(--line)"}`,
                    background: i === snapshotIdx ? "var(--ink)" : "transparent",
                    color: i === snapshotIdx ? "var(--bg)" : "var(--ink-muted)",
                    fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 500, letterSpacing: "0.05em",
                  }}>{s.date}</button>
              ))}
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>
                {prev === snap ? "BASELINE" : `vs ${prev.date}`}
              </span>
            </div>

            <RadarChart current={snap.values} previous={prev === snap ? null : prev.values} onLabelClick={setExpandedScore} />

            {snapshotIdx > 0 && (
              <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {computeDeltas(prev.values, snap.values).slice(0, 3).map(d => (
                  <div key={d.name} style={{
                    padding: "12px 14px", borderRadius: 8,
                    background: d.delta > 0 ? "#E4EFE6" : "#F5D5CE",
                    border: `1px solid ${d.delta > 0 ? "#6A8268" : "#B5503D"}`,
                  }}>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{d.name}</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: d.delta > 0 ? "#3F5640" : "#8E3A2A", marginTop: 2 }}>
                      {d.delta > 0 ? "+" : ""}{d.delta}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Scoring criteria — transparent, clickable */}
          <Panel title="六維指標計分依據" subtitle="Scoring Criteria · 點開看每一項的統計邏輯">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SCORE_CRITERIA.map(c => {
                const val = snap.values[c.key];
                const open = expandedScore === c.key;
                return (
                  <button key={c.key}
                    onClick={() => setExpandedScore(open ? null : c.key)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: `1px solid ${open ? "var(--ink)" : "var(--line)"}`,
                      background: open ? "var(--bg-sunken)" : "var(--bg-elev)",
                      textAlign: "left",
                      transition: "all .2s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, fontFamily: "var(--font-serif)", color: "var(--ink)" }}>{c.key}</div>
                        {open && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", lineHeight: 1.7 }}>
                            <div style={{ marginBottom: 4 }}><b style={{ color: "var(--ink)" }}>計分來源：</b>{c.basis}</div>
                            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 1.5, marginTop: 6 }}>DATA SOURCE · {c.source}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 80, height: 4, background: "var(--line-soft)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${val}%`, height: "100%", background: "var(--ink)" }} />
                        </div>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, width: 30, textAlign: "right" }}>{val}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{open ? "▴" : "▾"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="風險雷達" subtitle="Risk Flag · 1 個關注點">
            <div style={{ display: "flex", alignItems: "stretch", gap: 14, padding: "4px 0" }}>
              <div style={{
                width: 54, flexShrink: 0,
                background: "#F5D5CE", borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#8E3A2A", fontSize: 22, fontWeight: 600,
                fontFamily: "var(--font-serif)",
              }}>險</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>安全感 ↓ 14 分</div>
                <div style={{ fontSize: 13, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", lineHeight: 1.6 }}>
                  過去 17 個月內，你對「安全感」的重視度大幅下降，同時「自主性」持續上升。這可能是一個關鍵的內在轉折點，建議與執行師深談。
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel title="最近一次選出的五張核心卡片" subtitle={`Top 5 · ${lastPickedAt}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-start", marginBottom: 18 }}>
              {top5Cards.map(c => <Card key={c.id} card={c} size="sm" />)}
            </div>
            <div style={{ paddingTop: 14, borderTop: "1px solid var(--line)", fontFamily: "var(--font-sans)", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "var(--ink-muted)" }}>
                <span>已填寫具體定義 3 / 5</span>
                <span className="mono" style={{ color: "var(--ink-soft)" }}>496 字</span>
              </div>
              <div style={{ height: 4, background: "var(--bg-sunken)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: "60%", height: "100%", background: "var(--ink)" }} />
              </div>
            </div>
          </Panel>

          <Panel title="執行師筆記" subtitle="來自 · 王芷寧 · 2026.04.14">
            <div style={{
              padding: 14, background: "var(--bg-sunken)", borderRadius: 8,
              borderLeft: "3px solid #C99A2E",
              fontFamily: "var(--font-serif)", fontSize: 14, lineHeight: 1.85, color: "var(--ink)",
              fontStyle: "italic",
            }}>
              「你在『自主性』與『創造表達』上的上升很一致，這或許不是一次轉職，而是一次更深的自我回收。下週我們聊聊『專案制工作』的可能性。」
            </div>
          </Panel>

          <Panel title="外掛整合" subtitle="Integrations · 點擊任一項以啟動">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <IntegrationTile label="Notion 同步" status="已連結 · 自動" dot="#3F8269" onClick={() => setIntegrationModal("notion")} />
              <IntegrationTile label="Google Calendar" status="匯入本週行動" dot="#3E5A8C" onClick={() => setIntegrationModal("gcal")} />
              <IntegrationTile label="LinkedIn 卡片" status="點擊生成" dot="#3E5A8C" onClick={() => setIntegrationModal("linkedin")} />
              <IntegrationTile label="一鍵抹除" status="被遺忘權 · GDPR" dot="#B5503D" onClick={() => setIntegrationModal("erase")} />
            </div>
          </Panel>
        </div>
      </div>

      {integrationModal && <IntegrationModal kind={integrationModal} onClose={() => setIntegrationModal(null)} />}

      <style>{`
        @media (max-width: 880px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "0.02em" }}>{title}</h2>
        <div className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, textTransform: "uppercase" }}>{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

function IntegrationTile({ label, status, dot, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 14px",
      border: "1px solid var(--line)",
      borderRadius: 8,
      fontFamily: "var(--font-sans)",
      background: "var(--bg-elev)",
      textAlign: "left",
      cursor: "pointer",
      transition: "transform .15s, border-color .15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--ink)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block" }} />
        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.02em" }}>{status}</div>
    </button>
  );
}

function IntegrationModal({ kind, onClose }) {
  const content = {
    notion: { title: "同步到 Notion", body: "將把「最近一次選出的五張核心卡片」、六維指標快照、與行動計畫寫入你的 Notion 工作區。", action: "立即同步" },
    gcal:   { title: "匯入 Google Calendar", body: "本週第一小步將被排入你的行事曆，並在 Stop-loss 日自動提醒複盤。", action: "建立行事曆事件" },
    linkedin:{ title: "生成 LinkedIn 卡片", body: "產出一張可分享的視覺卡片，含你的 Holland 代碼與 Top 3 目標職業。", action: "下載 1080×1080" },
    erase:  { title: "一鍵抹除資料", body: "依據 GDPR「被遺忘權」，將永久刪除此帳號所有卡片選擇、定義與筆記，動作不可逆。", action: "確認刪除", danger: true },
  }[kind];
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 900,
      background: "rgba(42,38,34,.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-elev)", borderRadius: 14, padding: 28, maxWidth: 420, width: "100%",
        boxShadow: "0 20px 60px rgba(42,38,34,.3)",
      }}>
        <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 10, fontFamily: "var(--font-serif)" }}>{content.title}</div>
        <div style={{ fontSize: 14, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", lineHeight: 1.7, marginBottom: 20 }}>
          {content.body}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button onClick={() => { alert(content.action + " · 示意觸發"); onClose(); }}
            style={{ ...btnDark, background: content.danger ? "#8E3A2A" : "var(--ink)", borderColor: content.danger ? "#8E3A2A" : "var(--ink)" }}>
            {content.action}
          </button>
        </div>
      </div>
    </div>
  );
}

function RadarChart({ current, previous, onLabelClick }) {
  const keys = Object.keys(current);
  const n = keys.length;
  const cx = 200, cy = 200, r = 140;

  const pointAt = (idx, val) => {
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2;
    const dist = (val / 100) * r;
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist];
  };

  const polyPath = (vals) => keys.map((k, i) => {
    const [x, y] = pointAt(i, vals[k]);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ") + "Z";

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg viewBox="0 0 400 400" style={{ width: "100%", maxWidth: 400, height: "auto" }}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <circle key={f} cx={cx} cy={cy} r={r * f} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray={f < 1 ? "3 3" : ""} />
        ))}
        {keys.map((k, i) => {
          const [x, y] = pointAt(i, 100);
          return <line key={k} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
        })}
        {previous && (
          <path d={polyPath(previous)} fill="var(--ink-soft)" fillOpacity="0.12" stroke="var(--ink-soft)" strokeWidth="1.2" strokeDasharray="4 3" />
        )}
        <path d={polyPath(current)} fill="#7FA9D1" fillOpacity="0.22" stroke="#3E5A8C" strokeWidth="2" />
        {keys.map((k, i) => {
          const [x, y] = pointAt(i, current[k]);
          return <circle key={k} cx={x} cy={y} r="3.5" fill="#3E5A8C" />;
        })}
        {keys.map((k, i) => {
          const [x, y] = pointAt(i, 118);
          return (
            <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              onClick={() => onLabelClick && onLabelClick(k)}
              style={{ fontFamily: "var(--font-serif)", fontSize: 13, fill: "var(--ink)", cursor: onLabelClick ? "pointer" : "default" }}>
              {k}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function computeDeltas(prev, curr) {
  return Object.keys(curr).map(k => ({ name: k, delta: curr[k] - prev[k] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

const btnGhost = {
  padding: "10px 18px", borderRadius: 8, border: "1px solid var(--line)",
  background: "transparent", color: "var(--ink)", fontSize: 13,
  fontFamily: "var(--font-sans)", fontWeight: 500, cursor: "pointer",
};
const btnDark = {
  padding: "10px 20px", borderRadius: 8, border: "1px solid var(--ink)",
  background: "var(--ink)", color: "var(--bg)", fontSize: 13,
  fontFamily: "var(--font-sans)", fontWeight: 500, cursor: "pointer",
};

Object.assign(window, { Dashboard, Panel });
