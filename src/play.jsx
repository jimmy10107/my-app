// 4-stage Salary Bottle flow
// Stage 1: Explore vocations (like/neutral/dislike → top 3)
// Stage 2: Clarify values (important/unimportant → Top 3 ranked + definitions)
// Stage 3: Ability inventory (have/not-have → gap vs top 3 jobs)
// Stage 4: Action plan (decision matrix + prototype + weekly action)

function PlayScreen() {
  const [stage, setStage] = React.useState(1);
  // Stage 1 state
  const [vocationBuckets, setVocationBuckets] = React.useState({ like: [], neutral: [], dislike: [] });
  const [top3Jobs, setTop3Jobs] = React.useState([]);
  // Stage 2 state
  const [valueBuckets, setValueBuckets] = React.useState({ important: [], unimportant: [] });
  const [valueRank, setValueRank] = React.useState([]); // [id, id, id]
  const [valueDefs, setValueDefs] = React.useState({});
  // Stage 3 state
  const [haveAbilities, setHaveAbilities] = React.useState([]);
  // Stage 4 state
  const [matrixScores, setMatrixScores] = React.useState({});
  const [prototype, setPrototype] = React.useState("");
  const [stopLoss, setStopLoss] = React.useState("");
  const [weeklyAction, setWeeklyAction] = React.useState("");

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 80px" }}>
      <StageHeader stage={stage} setStage={setStage} state={{ top3Jobs, valueRank, haveAbilities }} />
      {stage === 1 && <Stage1 buckets={vocationBuckets} setBuckets={setVocationBuckets} top3={top3Jobs} setTop3={setTop3Jobs} onNext={() => setStage(2)} />}
      {stage === 2 && <Stage2 buckets={valueBuckets} setBuckets={setValueBuckets} rank={valueRank} setRank={setValueRank} defs={valueDefs} setDefs={setValueDefs} onBack={() => setStage(1)} onNext={() => setStage(3)} />}
      {stage === 3 && <Stage3 have={haveAbilities} setHave={setHaveAbilities} top3Jobs={top3Jobs} onBack={() => setStage(2)} onNext={() => setStage(4)} />}
      {stage === 4 && <Stage4 top3Jobs={top3Jobs} valueRank={valueRank} valueDefs={valueDefs} have={haveAbilities} scores={matrixScores} setScores={setMatrixScores} prototype={prototype} setPrototype={setPrototype} stopLoss={stopLoss} setStopLoss={setStopLoss} weeklyAction={weeklyAction} setWeeklyAction={setWeeklyAction} onBack={() => setStage(3)} />}
    </div>
  );
}

function StageHeader({ stage, setStage, state }) {
  const stages = [
    { n: 1, label: "探索職業興趣", sub: "What do you like?" },
    { n: 2, label: "釐清核心價值觀", sub: "Why do you work?" },
    { n: 3, label: "盤點優勢與缺口", sub: "How capable are you?" },
    { n: 4, label: "擬定行動計畫", sub: "Action Plan" },
  ];
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: 3, marginBottom: 6 }}>SALARY BOTTLE · 四階段引導</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: "0.02em" }}>{stages[stage-1].label}</h1>
          <div style={{ marginTop: 4, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", fontSize: 13 }}>{stages[stage-1].sub}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, borderRadius: 10, background: "var(--bg-sunken)", padding: 4 }}>
        {stages.map(s => {
          const active = stage === s.n, done = stage > s.n;
          return (
            <button key={s.n} onClick={() => (done || active) && setStage(s.n)}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 8,
                background: active ? "var(--bg-elev)" : "transparent",
                boxShadow: active ? "var(--shadow-card)" : "none",
                cursor: (done || active) ? "pointer" : "not-allowed",
                textAlign: "left",
                opacity: !done && !active ? 0.45 : 1,
              }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>STAGE {s.n}</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 1 }}>{s.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ STAGE 1: Vocation exploration ============ */
function Stage1({ buckets, setBuckets, top3, setTop3, onNext }) {
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startXRef = React.useRef(0);
  const [step, setStep] = React.useState("sort"); // sort → analyze → pick
  const used = new Set([...buckets.like, ...buckets.neutral, ...buckets.dislike]);
  const remaining = VOCATIONS.filter(c => !used.has(c.id));
  const current = remaining[0];

  const sendTo = (bucket) => {
    if (!current) return;
    setBuckets({ ...buckets, [bucket]: [...buckets[bucket], current.id] });
  };

  const onDown = (e) => { startXRef.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0; setDragging(true); };
  const onMove = (e) => { if (!dragging) return; const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0; setDragX(x - startXRef.current); };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dragX) > 110 && current) sendTo(dragX > 0 ? "like" : "dislike");
    else if (dragX < 30 && dragX > -30 && current && Math.abs(dragX) < 5) {} // click
    setDragX(0);
  };
  React.useEffect(() => {
    if (!dragging) return;
    const h = (e) => onMove(e), u = () => onUp();
    window.addEventListener("mousemove", h); window.addEventListener("mouseup", u);
    window.addEventListener("touchmove", h); window.addEventListener("touchend", u);
    return () => { window.removeEventListener("mousemove", h); window.removeEventListener("mouseup", u); window.removeEventListener("touchmove", h); window.removeEventListener("touchend", u); };
  });

  // Holland frequency
  const hFreq = {};
  buckets.like.forEach(id => {
    const v = VOCATIONS.find(x => x.id === id);
    if (!v) return;
    v.holland.split("/").forEach((h, i) => { hFreq[h] = (hFreq[h] || 0) + (i === 0 ? 2 : 1); });
  });
  const topCode = Object.entries(hFreq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]).join("");

  const toggleTop3 = (id) => {
    if (top3.includes(id)) setTop3(top3.filter(x => x !== id));
    else if (top3.length < 3) setTop3([...top3, id]);
  };

  if (step === "sort") {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }} className="buckets">
          <BucketHeader label="不喜歡" sub="Dislike · 向左滑" count={buckets.dislike.length} color="#B5503D" side="left" />
          <BucketHeader label="沒感覺" sub="Neutral · 向下" count={buckets.neutral.length} color="#9A9087" side="center" />
          <BucketHeader label="喜歡" sub="Like · 向右滑" count={buckets.like.length} color="#3F8269" side="right" />
        </div>

        <div style={{ position: "relative", height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {dragX < -30 && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 50%, rgba(181,80,61,.14) 0%, transparent 55%)" }} />}
          {dragX > 30 && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 50%, rgba(63,130,105,.14) 0%, transparent 55%)" }} />}

          {remaining.slice(1, 4).reverse().map((c, i, arr) => {
            const depth = arr.length - i;
            return (
              <div key={c.id} style={{
                position: "absolute",
                transform: `translate(${(depth - 1) * 5}px, ${(depth - 1) * 4}px) rotate(${(depth - 1) * 1.4}deg) scale(${1 - depth * 0.03})`,
                opacity: 1 - depth * 0.18, zIndex: 1,
              }}>
                <Card card={c} size="md" />
              </div>
            );
          })}

          {current ? (
            <div onMouseDown={onDown} onTouchStart={onDown} style={{
              position: "relative", zIndex: 2,
              transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
              transition: dragging ? "none" : "transform .4s cubic-bezier(.2,1.4,.3,1)",
              cursor: dragging ? "grabbing" : "grab",
              userSelect: "none", touchAction: "none",
            }}>
              <Card card={current} size="lg" lifted={dragging} />
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "var(--ink-muted)" }}>
              <div style={{ fontSize: 36 }}>✓</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 6 }}>54 張職業卡全部分類完成</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => current && sendTo("dislike")} style={{ ...btn, borderColor: "#B5503D", color: "#B5503D" }}>✕ 不喜歡</button>
          <button onClick={() => current && sendTo("neutral")} style={btn}>○ 沒感覺</button>
          <button onClick={() => current && sendTo("like")} style={{ ...btn, borderColor: "#3F8269", color: "#3F8269" }}>♡ 喜歡</button>
          <div style={{ width: 16 }} />
          <button onClick={() => setStep("analyze")} disabled={buckets.like.length < 3}
            style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)", opacity: buckets.like.length < 3 ? 0.4 : 1 }}>
            {buckets.like.length < 3 ? `「喜歡」至少 3 張 (${buckets.like.length})` : "提取 Holland 代碼 →"}
          </button>
        </div>

        <div className="mono" style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "var(--ink-soft)", letterSpacing: 2 }}>
          {54 - remaining.length} / 54 · 已分類
        </div>
      </div>
    );
  }

  if (step === "analyze") {
    const hEntries = Object.entries(hFreq).sort((a,b)=>b[1]-a[1]);
    const maxFreq = Math.max(...hEntries.map(x=>x[1]), 1);
    return (
      <div className="card" style={{ padding: 32 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, marginBottom: 8 }}>HOLLAND CODE ANALYSIS</div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 500 }}>你的興趣密碼是 <span style={{ fontFamily: "var(--font-mono)", color: HOLLAND[topCode[0]]?.deep }}>{topCode}</span></h2>
        <div style={{ marginTop: 8, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
          基於你標為「喜歡」的 {buckets.like.length} 張職業卡，主碼加權 2 分、副碼 1 分。
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 24 }}>
          {Object.entries(HOLLAND).map(([k, h]) => {
            const f = hFreq[k] || 0;
            return (
              <div key={k} style={{ textAlign: "center" }}>
                <div style={{
                  height: 80, display: "flex", alignItems: "flex-end",
                  justifyContent: "center", padding: 4,
                  background: "var(--bg-sunken)", borderRadius: 6,
                }}>
                  <div style={{
                    width: "80%", height: `${(f / maxFreq) * 100}%`,
                    background: h.solid, borderRadius: 3,
                    minHeight: f > 0 ? 4 : 0,
                  }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: h.deep }}>{k} · {h.name}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>{f}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 28, padding: 16, background: "var(--bg-sunken)", borderRadius: 8, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.7 }}>
          <b>{HOLLAND[topCode[0]]?.name} × {HOLLAND[topCode[1]]?.name} × {HOLLAND[topCode[2]]?.name}</b>：
          你的興趣傾向落在「{HOLLAND[topCode[0]]?.name}」為主。接下來請從「喜歡」堆中，挑出 <b>3 張你最可能實際去做的職業</b>。
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={() => setStep("sort")} style={btn}>← 回到分類</button>
          <button onClick={() => setStep("pick")} style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }}>挑 3 張最可能做的 →</button>
        </div>
      </div>
    );
  }

  // step === "pick"
  const likedCards = buckets.like.map(id => VOCATIONS.find(v => v.id === id)).filter(Boolean);
  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>LOCK 3 TARGETS · 鎖定標的</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>從「喜歡」堆選出 <b style={{ color: "var(--ink)" }}>3 張最可能去從事</b> 的職業</div>
        </div>
        <div className="mono" style={{ fontSize: 14, color: top3.length === 3 ? "var(--ink)" : "var(--ink-muted)" }}>{top3.length} / 3</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
        {likedCards.map(c => (
          <div key={c.id} onClick={() => toggleTop3(c.id)} style={{ cursor: "pointer" }}>
            <Card card={c} size="sm" selected={top3.includes(c.id)} picked={top3.includes(c.id)} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button onClick={() => setStep("analyze")} style={btn}>← 回上一步</button>
        <button onClick={onNext} disabled={top3.length !== 3}
          style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)", opacity: top3.length !== 3 ? 0.4 : 1 }}>
          進入 Stage 2 · 核心價值觀 →
        </button>
      </div>
    </div>
  );
}

function BucketHeader({ label, sub, count, color, side }) {
  return (
    <div style={{ padding: 14, border: `1.5px dashed ${color}`, borderRadius: 10, textAlign: "center", background: "var(--bg-elev)" }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>{sub}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color, marginTop: 2, fontFamily: "var(--font-serif)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{count}</div>
    </div>
  );
}

/* ============ STAGE 2: Values ============ */
function Stage2({ buckets, setBuckets, rank, setRank, defs, setDefs, onBack, onNext }) {
  const [step, setStep] = React.useState("split"); // split → rank → define
  const used = new Set([...buckets.important, ...buckets.unimportant]);
  const remaining = VALUES.filter(v => !used.has(v.id));

  const sendTo = (bucket, id) => setBuckets({ ...buckets, [bucket]: [...buckets[bucket], id] });
  const undoFrom = (bucket, id) => setBuckets({ ...buckets, [bucket]: buckets[bucket].filter(x => x !== id) });

  const [dragOver, setDragOver] = React.useState(null);

  const onDragStart = (e, id) => { e.dataTransfer.setData("text/plain", id); };
  const onDrop = (e, bucket) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id && !used.has(id)) sendTo(bucket, id); setDragOver(null); };

  if (step === "split") {
    return (
      <div>
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>STEP 2.1 · 二分法篩選</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>15 張價值卡 · 拖曳到「重要」或「不重要」兩堆</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <BucketZone label="重要" sub="Important · 保留進入下一階段" color="#3F8269" bg="rgba(63,130,105,.08)"
            cards={buckets.important.map(id => VALUES.find(v => v.id === id))}
            onDragOver={(e) => { e.preventDefault(); setDragOver("important"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, "important")}
            hover={dragOver === "important"}
            onRemove={(id) => undoFrom("important", id)}
          />
          <BucketZone label="不重要" sub="Unimportant · 從此不再出現" color="#B5503D" bg="rgba(181,80,61,.08)"
            cards={buckets.unimportant.map(id => VALUES.find(v => v.id === id))}
            onDragOver={(e) => { e.preventDefault(); setDragOver("unimportant"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, "unimportant")}
            hover={dragOver === "unimportant"}
            onRemove={(id) => undoFrom("unimportant", id)}
          />
        </div>

        <div style={{ padding: 20, background: "var(--bg-sunken)", borderRadius: 10 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, marginBottom: 10 }}>待分類 · {remaining.length}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {remaining.map(v => (
              <div key={v.id} draggable onDragStart={(e) => onDragStart(e, v.id)} style={{ cursor: "grab" }}>
                <Card card={v} size="sm" />
              </div>
            ))}
            {remaining.length === 0 && <div style={{ color: "var(--ink-muted)", fontFamily: "var(--font-sans)", fontSize: 13, padding: 8 }}>所有價值卡都已分類</div>}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={onBack} style={btn}>← 回到 Stage 1</button>
          <button onClick={() => setStep("rank")} disabled={buckets.important.length < 3}
            style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)", opacity: buckets.important.length < 3 ? 0.4 : 1 }}>
            {buckets.important.length < 3 ? `「重要」至少 3 張 (${buckets.important.length})` : "殘酷二選一 · 排序 →"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "rank") {
    const impCards = buckets.important.map(id => VALUES.find(v => v.id === id));
    const available = impCards.filter(v => !rank.includes(v.id));

    const pick = (id) => { if (rank.length < 3) setRank([...rank, id]); };
    const unpick = (idx) => setRank(rank.filter((_, i) => i !== idx));

    return (
      <div>
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>STEP 2.2 · 殘酷二選一 · 排出 Top 3</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>點選的順序 = 排名。這是「只能留三張」的取捨。</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[0,1,2].map(idx => {
            const id = rank[idx];
            const card = id ? VALUES.find(v => v.id === id) : null;
            return (
              <div key={idx} onClick={() => card && unpick(idx)}
                style={{
                  aspectRatio: "120 / 168",
                  borderRadius: 10,
                  border: card ? "none" : "1.5px dashed var(--rule)",
                  background: "var(--bg-sunken)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                  cursor: card ? "pointer" : "default",
                }}>
                {card ? (
                  <div style={{ position: "relative" }}>
                    <Card card={card} size="sm" />
                    <div style={{
                      position: "absolute", top: -10, left: -10,
                      width: 32, height: 32, borderRadius: "50%",
                      background: "var(--ink)", color: "var(--bg)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)",
                    }}>#{idx + 1}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 40, color: "var(--ink-soft)", fontFamily: "var(--font-serif)" }}>#{idx + 1}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, marginBottom: 10 }}>重要堆 · 點一下即送入下一個排名格</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {available.map(v => (
              <div key={v.id} onClick={() => pick(v.id)} style={{ cursor: rank.length < 3 ? "pointer" : "not-allowed", opacity: rank.length >= 3 ? 0.4 : 1 }}>
                <Card card={v} size="sm" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={() => setStep("split")} style={btn}>← 重新篩選</button>
          <button onClick={() => setStep("define")} disabled={rank.length !== 3}
            style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)", opacity: rank.length !== 3 ? 0.4 : 1 }}>
            具體化定義 →
          </button>
        </div>
      </div>
    );
  }

  // step === "define"
  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>STEP 2.3 · 具體化定義</div>
        <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>為每張價值卡寫下「對你而言的具體標準」— 這將成為 Stage 4 決策矩陣的評估維度。</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rank.map((id, idx) => {
          const v = VALUES.find(x => x.id === id);
          return (
            <div key={id} className="card" style={{ padding: 20, display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flexShrink: 0, position: "relative" }}>
                <Card card={v} size="sm" />
                <div style={{ position: "absolute", top: -10, left: -10, width: 28, height: 28, borderRadius: "50%", background: "var(--ink)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>#{idx + 1}</div>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>引導提問</div>
                <div style={{ fontSize: 15, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink)", marginTop: 4, marginBottom: 12 }}>— {v.hint}</div>
                <textarea value={defs[id] || ""} onChange={(e) => setDefs({ ...defs, [id]: e.target.value })}
                  placeholder={`例：「${v.title}」= 月薪 ____ / 每週加班 ____ 小時內 / ____`}
                  style={{
                    width: "100%", minHeight: 70, padding: 12,
                    borderRadius: 8, border: "1px solid var(--line)",
                    background: "var(--bg-sunken)", fontFamily: "var(--font-serif)",
                    fontSize: 14, lineHeight: 1.7, color: "var(--ink)", resize: "vertical",
                  }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button onClick={() => setStep("rank")} style={btn}>← 重新排序</button>
        <button onClick={onNext} style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }}>進入 Stage 3 · 能力盤點 →</button>
      </div>
    </div>
  );
}

function BucketZone({ label, sub, color, bg, cards, onDragOver, onDragLeave, onDrop, hover, onRemove }) {
  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{
        border: `1.5px dashed ${color}`, borderRadius: 10,
        minHeight: 200, padding: 16,
        background: hover ? bg : "var(--bg-elev)",
        transition: "background .2s",
      }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color }}>{label}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>{sub}</div>
        </div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>{cards.length}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {cards.filter(Boolean).map(c => (
          <div key={c.id} onClick={() => onRemove(c.id)} style={{ cursor: "pointer" }} title="點擊撤回">
            <Card card={c} size="xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ STAGE 3: Ability inventory ============ */
function Stage3({ have, setHave, top3Jobs, onBack, onNext }) {
  const toggle = (id) => setHave(have.includes(id) ? have.filter(x => x !== id) : [...have, id]);
  const jobCards = top3Jobs.map(id => VOCATIONS.find(v => v.id === id));

  return (
    <div>
      {/* Target jobs strip */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, marginBottom: 8 }}>TARGET JOBS · Stage 1 選出</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {jobCards.map(j => {
            const reqs = getJobReqs(j.id);
            const hasCount = reqs.filter(r => have.includes(r)).length;
            const pct = Math.round((hasCount / reqs.length) * 100);
            return (
              <div key={j.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: "1 1 280px" }}>
                <Card card={j} size="sm" />
                <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>{j.title}</div>
                  <div style={{ height: 6, background: "var(--bg-sunken)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? "#3F8269" : pct >= 40 ? "#C99A2E" : "#B5503D" }} />
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>具備 {hasCount} / {reqs.length} · {pct}%</div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {reqs.map(rid => {
                      const a = ABILITIES.find(x => x.id === rid);
                      const owned = have.includes(rid);
                      return (
                        <span key={rid} style={{
                          fontSize: 11, padding: "2px 7px", borderRadius: 10,
                          background: owned ? "#D9E4D6" : "#F5D5CE",
                          color: owned ? "#295C4E" : "#8E3A2A",
                          fontFamily: "var(--font-sans)",
                          border: owned ? "none" : "1px dashed #B5503D",
                        }}>{owned ? "✓" : "✕"} {a?.title}</span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Abilities pool */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>31 ABILITY CARDS · 挑出「已具備」的</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>專業能力（深灰）vs 可轉移能力（苔綠）</div>
          </div>
          <div className="mono" style={{ fontSize: 13 }}>已選 <b>{have.length}</b> / 31</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, marginBottom: 6 }}>HARD · 專業能力</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {ABILITIES.filter(a => a.kind === "hard").map(a => (
              <div key={a.id} onClick={() => toggle(a.id)} style={{ cursor: "pointer" }}>
                <Card card={a} size="sm" selected={have.includes(a.id)} picked={have.includes(a.id)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2, marginBottom: 6 }}>SOFT · 可轉移能力</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {ABILITIES.filter(a => a.kind === "soft").map(a => (
              <div key={a.id} onClick={() => toggle(a.id)} style={{ cursor: "pointer" }}>
                <Card card={a} size="sm" selected={have.includes(a.id)} picked={have.includes(a.id)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button onClick={onBack} style={btn}>← 回 Stage 2</button>
        <button onClick={onNext} style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }}>進入 Stage 4 · 行動計畫 →</button>
      </div>
    </div>
  );
}

/* ============ STAGE 4: Action plan ============ */
function Stage4({ top3Jobs, valueRank, valueDefs, have, scores, setScores, prototype, setPrototype, stopLoss, setStopLoss, weeklyAction, setWeeklyAction, onBack }) {
  const jobs = top3Jobs.map(id => VOCATIONS.find(v => v.id === id));
  const values = valueRank.map(id => VALUES.find(v => v.id === id));

  const getScore = (jobId, dim) => scores[`${jobId}_${dim}`] ?? 3;
  const setScore = (jobId, dim, val) => setScores({ ...scores, [`${jobId}_${dim}`]: val });

  const rows = [
    ...values.map(v => ({ key: v.id, label: v.title, sub: valueDefs[v.id] || v.hint, kind: "value" })),
    { key: "_like", label: "喜歡程度", sub: "你由衷想做的強度", kind: "meta" },
    { key: "_fit", label: "適合程度", sub: "能力與性格的匹配", kind: "meta" },
  ];

  const totals = {};
  jobs.forEach(j => {
    const t = rows.reduce((sum, r) => sum + getScore(j.id, r.key), 0);
    totals[j.id] = t;
  });
  const maxTotal = Math.max(...Object.values(totals), 1);
  const winnerId = Object.entries(totals).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const winner = jobs.find(j => j.id === winnerId);

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>STEP 4.1 · 決策矩陣</div>
        <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>為每個職業 × 每個維度給 1–5 分。矩陣會累計出勝出選項。</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-sans)", fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr style={{ background: "var(--bg-sunken)" }}>
              <th style={th}>評估維度</th>
              {jobs.map(j => (
                <th key={j.id} style={th}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: HOLLAND[j.hKey].deep, fontFamily: "var(--font-serif)" }}>{j.title}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 1, marginTop: 2 }}>{j.holland}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...td, maxWidth: 260 }}>
                  <div style={{ fontWeight: 500, color: "var(--ink)" }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2, lineHeight: 1.5 }}>{r.sub}</div>
                </td>
                {jobs.map(j => (
                  <td key={j.id} style={td}>
                    <StarRow value={getScore(j.id, r.key)} onChange={(v) => setScore(j.id, r.key, v)} />
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--ink)", background: "var(--bg-sunken)" }}>
              <td style={{ ...td, fontWeight: 600 }}>總分</td>
              {jobs.map(j => (
                <td key={j.id} style={{ ...td }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--line-soft)", borderRadius: 3 }}>
                      <div style={{ width: `${(totals[j.id] / maxTotal) * 100}%`, height: "100%", background: j.id === winnerId ? "#3F8269" : HOLLAND[j.hKey].solid, borderRadius: 3 }} />
                    </div>
                    <span className="mono" style={{ fontWeight: 600, color: j.id === winnerId ? "#3F8269" : "var(--ink)" }}>{totals[j.id]}</span>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {winner && (
        <div className="card" style={{ padding: 24, marginTop: 20, background: "var(--bg-sunken)" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>CURRENT WINNER · 目前勝出</div>
          <div style={{ fontSize: 24, fontWeight: 500, marginTop: 4, color: HOLLAND[winner.hKey].deep }}>{winner.title}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20 }}>
        <PlanBox label="最低成本測試 · Prototype" hint="本月就能開始的小實驗（如：約訪 2 位從業者、開一個副業小專案）" value={prototype} onChange={setPrototype} />
        <PlanBox label="停損時機 · Stop-loss" hint="滿足什麼條件我就該停下來重新評估？（如：3 個月內沒有收入起色）" value={stopLoss} onChange={setStopLoss} />
      </div>
      <div style={{ marginTop: 14 }}>
        <PlanBox label="本週的第一小步 · Weekly Action" hint="具體、微小、今天就能開始（如：列出 3–5 項探索清單、約一位我欣賞的人）" value={weeklyAction} onChange={setWeeklyAction} />
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>完成！一鍵匯出到……</div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", marginTop: 2 }}>系統將自動填入矩陣、定義、缺口與本週任務</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => alert("已匯出至 Notion · 示意觸發")} style={btn}>📔 匯出 Notion</button>
          <button onClick={() => alert("已加入 Google Calendar · 示意觸發")} style={btn}>📅 加入 Google Calendar</button>
          <button onClick={() => alert("已下載 PDF 報告 · 示意觸發")} style={{ ...btn, background: "var(--ink)", borderColor: "var(--ink)", color: "var(--bg)" }}>⬇ 下載 PDF</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button onClick={onBack} style={btn}>← 回 Stage 3</button>
      </div>
    </div>
  );
}

function StarRow({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          width: 22, height: 22, borderRadius: 4,
          background: n <= value ? "var(--ink)" : "var(--line-soft)",
          color: n <= value ? "var(--bg)" : "var(--ink-soft)",
          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
          border: "none",
        }}>{n}</button>
      ))}
    </div>
  );
}

function PlanBox({ label, hint, value, onChange }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", letterSpacing: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", marginTop: 4, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{
        width: "100%", minHeight: 60, padding: 10,
        borderRadius: 6, border: "1px solid var(--line)",
        background: "var(--bg-sunken)", fontFamily: "var(--font-serif)",
        fontSize: 14, lineHeight: 1.7, color: "var(--ink)", resize: "vertical",
      }} />
    </div>
  );
}

const btn = {
  padding: "10px 18px", borderRadius: 8,
  border: "1px solid var(--line)", background: "var(--bg-elev)",
  color: "var(--ink)", fontSize: 13, fontFamily: "var(--font-sans)",
  fontWeight: 500, letterSpacing: "0.03em", cursor: "pointer",
};
const th = { padding: "12px 14px", textAlign: "left", fontWeight: 500, fontSize: 12, color: "var(--ink-muted)", letterSpacing: "0.04em" };
const td = { padding: "12px 14px", verticalAlign: "top" };

Object.assign(window, { PlayScreen });
