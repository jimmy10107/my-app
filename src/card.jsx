// Card visuals — flat-first, soul question on every card

const CARD_BG = "var(--bg-elev)";

// Skin colors by category
function getSkin(card) {
  if (card.cat === "vocation") {
    const h = HOLLAND[card.hKey];
    return { solid: h.solid, deep: h.deep, wash: h.wash, letter: h.letter, sub: h.name };
  }
  if (card.cat === "value") {
    return { solid: "#6B8CAE", deep: "#3D5B7D", wash: "#DCE5EF", letter: "值", sub: "價值卡" };
  }
  if (card.cat === "ability") {
    // hard = 深灰, soft = 苔綠
    if (card.kind === "hard") return { solid: "#4A4640", deep: "#2A2622", wash: "#DDD8D0", letter: "專", sub: "專業能力 · Hard" };
    return { solid: "#6A8268", deep: "#3F5640", wash: "#D9E4D6", letter: "軟", sub: "可轉移能力 · Soft" };
  }
  return { solid: "#A88F5F", deep: "#6F5A33", wash: "#EADFC3", letter: "引", sub: "輔助卡" };
}

const SOUL_QUESTION = {
  vocation: "這份職業，你的感覺是？",
  value:    "這件事對你有多重要？",
  ability:  "這項能力，我具備了嗎？",
  aid:      "停下來想一下……",
};

const PAPER_BG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.16  0 0 0 0 0.14  0 0 0 0 0.12  0 0 0 0 0.04 0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>")`;

function Card({ card, size = "md", faceDown = false, locked = false, selected = false, picked = false, onClick, rotate = 0, lifted = false, style }) {
  const skin = getSkin(card);
  const q = SOUL_QUESTION[card.cat];

  const sizes = {
    xs: { w: 68,  h: 96,  pad: 7,  title: 13, q: 7,  stamp: 14 },
    sm: { w: 120, h: 168, pad: 11, title: 17, q: 9,  stamp: 20 },
    md: { w: 180, h: 252, pad: 14, title: 24, q: 11, stamp: 26 },
    lg: { w: 230, h: 322, pad: 18, title: 30, q: 13, stamp: 32 },
    xl: { w: 320, h: 448, pad: 26, title: 42, q: 16, stamp: 42 },
  };
  const S = sizes[size];

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: S.w, height: S.h,
        borderRadius: 10,
        background: CARD_BG,
        border: `1.5px solid ${selected ? skin.deep : "var(--line)"}`,
        boxShadow: lifted
          ? "0 2px 0 rgba(42,38,34,.04), 0 14px 28px rgba(42,38,34,.14), 0 32px 56px rgba(42,38,34,.12)"
          : "0 1px 2px rgba(42,38,34,.04), 0 3px 6px rgba(42,38,34,.04)",
        transform: `rotate(${rotate}deg)${lifted ? " translateY(-6px) scale(1.02)" : ""}`,
        transition: "transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease, border-color .2s ease",
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        opacity: locked ? 0.7 : 1,
        fontFamily: "var(--font-serif)",
        ...style,
      }}
    >
      {/* Subtle paper texture */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: PAPER_BG,
        opacity: 0.4, mixBlendMode: "multiply",
        pointerEvents: "none",
      }} />

      {faceDown ? (
        <CardBack skin={skin} size={size} S={S} />
      ) : (
        <CardFront card={card} skin={skin} q={q} size={size} S={S} picked={picked} />
      )}

      {locked && (
        <div style={{
          position: "absolute", inset: 0,
          background: `repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 7px, rgba(255,255,255,.35) 7px 14px)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(1px)",
        }}>
          <div style={{
            fontSize: 11, color: "var(--ink)",
            background: "var(--bg-elev)", padding: "4px 10px",
            border: "1px solid var(--line)", borderRadius: 20,
            fontFamily: "var(--font-sans)", fontWeight: 500,
          }}>🔒 已鎖定</div>
        </div>
      )}
    </div>
  );
}

function CardFront({ card, skin, q, size, S, picked }) {
  const showSubtext = size !== "xs";
  const showQuestion = size !== "xs" && size !== "sm" || size === "sm";
  return (
    <div style={{
      position: "absolute", inset: 0,
      padding: S.pad,
      display: "flex", flexDirection: "column",
    }}>
      {/* Top row: subtype tag + Holland stamp */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{
          fontSize: size === "xs" ? 8 : size === "sm" ? 10 : 11,
          color: skin.deep,
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          letterSpacing: "0.04em",
          background: skin.wash,
          padding: size === "xs" ? "2px 5px" : "3px 7px",
          borderRadius: 3,
        }}>{skin.sub}</div>

        <div style={{
          width: S.stamp, height: S.stamp,
          borderRadius: "50%",
          border: `1.5px solid ${skin.deep}`,
          color: skin.deep,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: S.stamp * 0.52,
          fontWeight: 600,
          fontFamily: card.cat === "vocation" ? "var(--font-sans)" : "var(--font-serif)",
          letterSpacing: 0,
          background: `color-mix(in srgb, ${skin.wash} 40%, transparent)`,
        }}>{skin.letter}</div>
      </div>

      {/* Title */}
      <div style={{
        marginTop: "auto",
        marginBottom: size === "xs" ? 0 : 8,
      }}>
        <div style={{
          fontSize: S.title,
          fontWeight: 500,
          color: "var(--ink)",
          lineHeight: 1.15,
          letterSpacing: "0.02em",
          fontFamily: "var(--font-serif)",
        }}>{card.title}</div>
        {showSubtext && size !== "xs" && card.cat === "vocation" && (
          <div className="mono" style={{ fontSize: size === "sm" ? 9 : 10, color: "var(--ink-soft)", letterSpacing: 1.5, marginTop: 3 }}>
            {card.holland}
          </div>
        )}
        {showSubtext && size !== "xs" && card.cat === "value" && card.hint && size !== "sm" && (
          <div style={{ fontSize: size === "md" ? 10 : 11, color: "var(--ink-muted)", fontFamily: "var(--font-sans)", marginTop: 4, lineHeight: 1.5 }}>
            {card.hint}
          </div>
        )}
      </div>

      {/* Soul question (bottom italic) */}
      {size !== "xs" && (
        <div style={{
          paddingTop: 7,
          borderTop: `1px dashed ${skin.deep}`,
          fontFamily: "var(--font-serif)",
          fontSize: S.q,
          fontStyle: "italic",
          color: skin.deep,
          letterSpacing: "0.04em",
          lineHeight: 1.3,
        }}>
          <span style={{ opacity: 0.5, marginRight: 3 }}>— </span>{q}
        </div>
      )}

      {/* ID strip */}
      {size !== "xs" && size !== "sm" && (
        <div className="mono" style={{
          position: "absolute",
          bottom: 4, right: S.pad,
          fontSize: 8, color: "var(--ink-soft)",
          letterSpacing: 1,
        }}>{card.id}</div>
      )}

      {picked && (
        <div style={{
          position: "absolute", top: -1, right: -1,
          width: 22, height: 22, borderRadius: "0 10px 0 10px",
          background: skin.deep, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 600,
        }}>✓</div>
      )}
    </div>
  );
}

function CardBack({ skin, size, S }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `linear-gradient(135deg, ${skin.wash} 0%, var(--bg-sunken) 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 8,
    }}>
      <div style={{
        width: size === "xs" ? 24 : 40, height: size === "xs" ? 24 : 40,
        borderRadius: "50%",
        border: `1.5px solid ${skin.deep}`,
        color: skin.deep,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size === "xs" ? 12 : 18, fontWeight: 500,
        background: "var(--bg-elev)",
      }}>{skin.letter}</div>
      {size !== "xs" && (
        <div className="mono" style={{ fontSize: 10, color: skin.deep, letterSpacing: 3, opacity: 0.7 }}>SALARY · BOTTLE</div>
      )}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0 12px, color-mix(in srgb, ${skin.deep} 8%, transparent) 12px 13px)`,
        pointerEvents: "none",
      }} />
    </div>
  );
}

Object.assign(window, { Card, getSkin, HOLLAND, SOUL_QUESTION });
