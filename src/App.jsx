// App shell — 薪資水瓶 Salary Bottle
// No tweaks panel · locked light theme · fixed flat-with-paper aesthetic

function App() {
  const [screen, setScreen] = React.useState(() => localStorage.getItem("sb_screen") || "play");

  React.useEffect(() => {
    localStorage.setItem("sb_screen", screen);
  }, [screen]);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  return (
    <div>
      <TopNav screen={screen} setScreen={setScreen} />
      <main>
        {screen === "dashboard" && <Dashboard />}
        {screen === "play" && <PlayScreen />}
        {screen === "console" && <Console />}
      </main>
    </div>
  );
}

function TopNav({ screen, setScreen }) {
  const tabs = [
    { id: "dashboard", label: "個人儀表板", sub: "USER" },
    { id: "play",      label: "四階段引導",    sub: "4-STAGE FLOW" },
    { id: "console",   label: "執行師控制台", sub: "FACILITATOR" },
  ];
  return (
    <div className="topnav" data-screen-label={screen === "dashboard" ? "01 Dashboard" : screen === "play" ? "02 Four Stages" : "03 Facilitator Console"}>
      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        {/* Salary Bottle logo — 水瓶 + 硬幣刻度 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="34" height="34" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
            {/* Bottle outline */}
            <path d="M15 4 h10 v4 l3 5 v22 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 v-22 l3 -5 z"
              fill="none" stroke="#2A2622" strokeWidth="1.6" strokeLinejoin="round" />
            {/* Water level */}
            <path d="M13 22 q3 -2 7 0 t7 0 v13 a3 3 0 0 1 -3 3 h-8 a3 3 0 0 1 -3 -3 z"
              fill="#6B8CAE" opacity="0.85" />
            {/* Coin */}
            <circle cx="20" cy="15" r="2.5" fill="#C99A2E" stroke="#8E6A14" strokeWidth="0.8" />
            <text x="20" y="17.5" textAnchor="middle" fontSize="4" fontFamily="serif" fontWeight="700" fill="#5E4631">$</text>
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "0.04em", fontFamily: "var(--font-serif)" }}>薪資水瓶</div>
            <div className="mono desktop-only" style={{ fontSize: 9, color: "var(--ink-soft)", letterSpacing: 2, marginTop: -2 }}>SALARY BOTTLE · 敏捷職涯導引</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 4, marginLeft: "auto", background: "var(--bg-sunken)", borderRadius: 8, padding: 3 }}>
          {tabs.map(t => {
            const active = screen === t.id;
            return (
              <button key={t.id} onClick={() => setScreen(t.id)} style={{
                padding: "7px 14px", borderRadius: 6,
                background: active ? "var(--bg-elev)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-muted)",
                fontSize: 13, fontWeight: active ? 500 : 400,
                boxShadow: active ? "var(--shadow-card)" : "none",
                fontFamily: "var(--font-sans)", transition: "all .2s", cursor: "pointer",
              }}>
                <span className="desktop-only mono" style={{ fontSize: 9, letterSpacing: 2, color: "var(--ink-soft)", display: "block", marginBottom: 1 }}>{t.sub}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 14, borderLeft: "1px solid var(--line)" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "#D9E4D6", color: "#295C4E",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 600, fontFamily: "var(--font-serif)",
          }}>沛</div>
          <span style={{ fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--ink-muted)" }}>沛蓉 · 操作者</span>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
