import { useState, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   成員名單（隱藏積分，外部不顯示）
   ═══════════════════════════════════════════════════════════ */
const ROSTER = [
  { id: "alan", name: "Alan", _v: 8.5, active: true },
  { id: "jimmy", name: "Jimmy", _v: 8.5, active: true },
  { id: "curly", name: "捲毛", _v: 8.0, active: true },
  { id: "peiyun", name: "珮芸", _v: 7.5, active: true },
  { id: "siu", name: "修哥", _v: 7.0, active: true },
  { id: "wenzhu", name: "雯筑", _v: 5.0, active: true },
  { id: "yinxuan", name: "音旋", _v: 3.0, active: true },
];

/* ── 場次預設表 ───────────────────────────────────────────── */
const SCHEDULE = {
  4: [
    { pairA: [0, 1], pairB: [2, 3], rest: [] },
    { pairA: [0, 2], pairB: [1, 3], rest: [] },
    { pairA: [0, 3], pairB: [1, 2], rest: [] },
  ],
  5: [
    { pairA: [0, 1], pairB: [2, 3], rest: [4] },
    { pairA: [4, 0], pairB: [1, 2], rest: [3] },
    { pairA: [3, 4], pairB: [0, 2], rest: [1] },
    { pairA: [0, 3], pairB: [4, 1], rest: [2] },
    { pairA: [1, 3], pairB: [2, 4], rest: [0] },
  ],
  6: [
    { pairA: [0, 1], pairB: [2, 3], rest: [4, 5] },
    { pairA: [4, 5], pairB: [0, 2], rest: [1, 3] },
    { pairA: [1, 3], pairB: [4, 2], rest: [0, 5] },
    { pairA: [0, 5], pairB: [1, 4], rest: [2, 3] },
    { pairA: [2, 3], pairB: [0, 4], rest: [1, 5] },
    { pairA: [1, 5], pairB: [2, 4], rest: [0, 3] },
    { pairA: [0, 3], pairB: [1, 2], rest: [4, 5] },
    { pairA: [4, 3], pairB: [5, 0], rest: [1, 2] },
    { pairA: [1, 2], pairB: [3, 5], rest: [0, 4] },
  ],
  7: [
    { pairA: [0, 1], pairB: [2, 3], rest: [4, 5, 6] },
    { pairA: [4, 5], pairB: [6, 0], rest: [1, 2, 3] },
    { pairA: [1, 2], pairB: [3, 5], rest: [4, 6, 0] },
    { pairA: [4, 6], pairB: [0, 2], rest: [1, 3, 5] },
    { pairA: [1, 3], pairB: [5, 0], rest: [2, 4, 6] },
    { pairA: [2, 4], pairB: [6, 1], rest: [3, 5, 0] },
    { pairA: [3, 0], pairB: [5, 4], rest: [1, 2, 6] },
    { pairA: [1, 4], pairB: [2, 6], rest: [0, 3, 5] },
    { pairA: [0, 3], pairB: [5, 1], rest: [2, 4, 6] },
    { pairA: [2, 5], pairB: [4, 6], rest: [0, 1, 3] },
    { pairA: [0, 1], pairB: [3, 6], rest: [2, 4, 5] },
    { pairA: [2, 4], pairB: [5, 6], rest: [0, 1, 3] },
    { pairA: [0, 1], pairB: [3, 4], rest: [2, 5, 6] },
    { pairA: [2, 5], pairB: [6, 0], rest: [1, 3, 4] },
  ],
  8: [
    { pairA: [0, 1], pairB: [2, 3], pairC: [4, 5], pairD: [6, 7], rest: [] },
    { pairA: [0, 4], pairB: [1, 5], pairC: [2, 6], pairD: [3, 7], rest: [] },
    { pairA: [0, 2], pairB: [4, 6], pairC: [1, 3], pairD: [5, 7], rest: [] },
    { pairA: [0, 5], pairB: [2, 7], pairC: [1, 4], pairD: [3, 6], rest: [] },
    { pairA: [0, 3], pairB: [5, 6], pairC: [1, 2], pairD: [4, 7], rest: [] },
    { pairA: [0, 6], pairB: [1, 7], pairC: [2, 3], pairD: [4, 5], rest: [] },
    { pairA: [0, 7], pairB: [3, 4], pairC: [1, 6], pairD: [2, 5], rest: [] },
  ],
};

/* ── 從場次表生成對戰 ────────────────────────────────────── */

function calcDynaDelta(rounds) {
  const delta = {};
  for (const rd of rounds) {
    for (const t of (rd.tables || [])) {
      if (t.isSingles || t.isSingle1v1) continue;
      const gs = rd.gs?.[t.tableNo];
      if (!gs) continue;
      const games = gs.finalGames || gs.games || [];
      for (const g of games) {
        if (!g.winner || (g.scoreA === 0 && g.scoreB === 0)) continue;
        const total = g.scoreA + g.scoreB;
        const diff = Math.abs(g.scoreA - g.scoreB);
        const ratio = Math.min(diff / Math.max(total * 0.5, 1), 1);
        const adj = 0.4 * (0.6 * ratio + 0.4);
        const W = g.winner === "A" ? t.teamA : t.teamB;
        const L = g.winner === "A" ? t.teamB : t.teamA;
        W.forEach(p => { delta[p.id] = (delta[p.id] || 0) + adj; });
        L.forEach(p => { delta[p.id] = (delta[p.id] || 0) - adj; });
      }
    }
  }
  return delta;
}

function applyDelta(players, delta) {
  return players.map(p => ({ ...p, _v: Math.max(0, Math.min(12, p._v + (delta[p.id] || 0))) }));
}

function hasValidScore(gs) {
  if (!gs) return false;
  const games = gs.finalGames || gs.games || [];
  if (games.length > 0) return games.some(g => g.scoreA > 0 || g.scoreB > 0);
  return Number(gs.scoreA) > 0 || Number(gs.scoreB) > 0;
}

/* ── 從場次表生成對戰 ────────────────────────────────────── */
// players 已按 _v 排序後洗牌（確保最弱兩人不同組）
function shuffleWithConstraint(players) {
  const sorted = [...players].sort((a, b) => a._v - b._v);
  const arr = [...sorted];
  for (let i = arr.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(Math.random() * (i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeTablesFromEntry(entry, mapped) {
  const { pairA, pairB, pairC, pairD, rest } = entry;
  const tables = [];
  // 桌1：pairA vs pairB
  if (pairA && pairB) {
    tables.push({
      tableNo: 1,
      teamA: [mapped[pairA[0]], mapped[pairA[1]]],
      teamB: [mapped[pairB[0]], mapped[pairB[1]]],
    });
  }
  // 桌2：pairC vs pairD（8人用）
  if (pairC && pairD) {
    tables.push({
      tableNo: 2,
      teamA: [mapped[pairC[0]], mapped[pairC[1]]],
      teamB: [mapped[pairD[0]], mapped[pairD[1]]],
    });
  }
  // 候場
  if (rest && rest.length > 0) {
    const restPlayers = rest.map(i => mapped[i]).filter(Boolean);
    const nextTableNo = tables.length + 1;
    if (restPlayers.length === 1) {
      // 1人候場：兩桌都標記 waitingPlayer
      tables.forEach((_, i) => { tables[i] = { ...tables[i], waitingPlayer: restPlayers[0] }; });
    } else if (restPlayers.length === 2) {
      tables.push({ tableNo: nextTableNo, teamA: [restPlayers[0]], teamB: [restPlayers[1]], isSingle1v1: true, isRest: true });
    } else if (restPlayers.length >= 3) {
      tables.push({ tableNo: nextTableNo, singles: restPlayers, isSingles: true, isRest: true });
    }
  }
  return tables;
}

function initGS(table) {
  if (table.isSingles) {
    if (table.singles && table.singles.length >= 2) return { scoreA: 0, scoreB: 0, games: [] };
    return null;
  }
  if (!table.teamA || !table.teamB) return null;
  return { scoreA: 0, scoreB: 0, games: [] };
}

/* ═══════════════════════════════════════════════════════════
   Material Design 色彩 & 元件
   ═══════════════════════════════════════════════════════════ */
const M = {
  bg: "#0f1117",
  surface: "#1a1f2e",
  surfaceV: "#22293a",
  outline: "rgba(255,255,255,0.12)",
  primary: "#82b4ff",   // MD3 primary
  secondary: "#ffb4ab",   // MD3 secondary
  tertiary: "#ffd166",
  onSurface: "#e2e8f4",
  onSurfaceMid: "rgba(226,232,244,0.55)",
  onSurfaceLow: "rgba(226,232,244,0.28)",
  error: "#ffb4ab",
  ripple: "rgba(130,180,255,0.12)",
};

/* ── SVG 小人 ─────────────────────────────────────────────── */
function Stickman({ color, size = 40, flip = false, name = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size * 1.75} viewBox="0 0 44 77"
        style={{ display: "block", transform: flip ? "scaleX(-1)" : "none" }}>
        <ellipse cx={flip ? 10 : 34} cy={31} rx={8} ry={10} fill={color} opacity={0.9} />
        <line x1={flip ? 15 : 29} y1={38} x2={flip ? 19 : 25} y2={43} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={22} cy={8} r={8} fill={color} />
        <line x1={22} y1={16} x2={22} y2={46} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <line x1={22} y1={26} x2={flip ? 15 : 29} y2={39} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={22} y1={26} x2={flip ? 29 : 15} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <line x1={22} y1={46} x2={15} y2={62} stroke={color} strokeWidth={2.8} strokeLinecap="round" />
        <line x1={22} y1={46} x2={29} y2={62} stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      </svg>
      <span style={{ color, fontSize: 11, fontWeight: 600, maxWidth: 52, textAlign: "center", lineHeight: 1.2 }}>{name}</span>
    </div>
  );
}

function TableSVG() {
  return (
    <svg viewBox="0 0 180 64" style={{ display: "block", width: "100%", maxWidth: 180, margin: "0 auto" }}>
      <rect x={4} y={14} width={172} height={36} rx={7} fill="rgba(0,110,70,0.22)" stroke="rgba(0,200,120,0.4)" strokeWidth={1.5} />
      <line x1={90} y1={14} x2={90} y2={50} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="3,3" />
      <rect x={87} y={9} width={6} height={45} rx={2.5} fill="rgba(255,255,255,0.18)" />
      <line x1={18} y1={50} x2={13} y2={62} stroke="rgba(0,180,100,0.35)" strokeWidth={2} />
      <line x1={162} y1={50} x2={167} y2={62} stroke="rgba(0,180,100,0.35)" strokeWidth={2} />
    </svg>
  );
}

/* ── MD Chip ──────────────────────────────────────────────── */
function Chip({ label, selected, onClick, color }) {
  const c = color || M.primary;
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      height: 36, padding: "0 16px", borderRadius: 18,
      background: selected ? `${c}28` : "rgba(255,255,255,0.06)",
      border: `1.5px solid ${selected ? c : M.outline}`,
      color: selected ? c : M.onSurfaceMid,
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      transition: "all 0.15s", userSelect: "none",
      boxShadow: selected ? `0 0 12px ${c}30` : "none",
    }}>{label}</button>
  );
}

/* ── MD Button ────────────────────────────────────────────── */
function MdBtn({ label, onClick, variant = "filled", color, disabled, fullWidth, small }) {
  const c = color || M.primary;
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: small ? 36 : 44, padding: small ? "0 16px" : "0 24px",
    borderRadius: small ? 18 : 22, fontSize: small ? 13 : 14, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s", userSelect: "none",
    width: fullWidth ? "100%" : "auto",
    opacity: disabled ? 0.45 : 1,
    letterSpacing: 0.3,
  };
  if (variant === "filled") return <button onClick={disabled ? undefined : onClick} style={{ ...base, background: c, color: "#0f1117", border: "none", boxShadow: disabled ? "none" : `0 2px 8px ${c}44` }}>{label}</button>;
  if (variant === "tonal") return <button onClick={disabled ? undefined : onClick} style={{ ...base, background: `${c}22`, color: c, border: `1.5px solid ${c}55` }}>{label}</button>;
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, background: "transparent", color: c, border: `1.5px solid ${c}` }}>{label}</button>;
}

/* ── ScoreInput ───────────────────────────────────────────── */
const QP_ROWS = [[11, 10, 9, 8, 7, 6], [5, 4, 3, 2, 1, 0]];
function QuickPick({ color, initial, onConfirm, onClose }) {
  const [sel, setSel] = useState(initial ?? 0);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: M.surfaceV, border: `1px solid ${M.outline}`, borderRadius: 28, padding: "28px 22px 20px", width: "min(320px,90vw)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ height: 64, border: `2.5px solid ${color}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color, fontWeight: 900, fontSize: 40 }}>{sel}</div>
        {QP_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 6 }}>
            {row.map(n => <button key={n} onClick={() => setSel(n)} style={{ flex: 1, height: 48, borderRadius: 12, background: sel === n ? `${color}28` : "rgba(255,255,255,0.06)", border: sel === n ? `2px solid ${color}` : `1px solid ${M.outline}`, color: sel === n ? color : M.onSurfaceMid, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>{n}</button>)}
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <MdBtn label="取消" variant="outlined" color={M.onSurfaceMid} onClick={onClose} />
          <MdBtn label={`確定 ${sel}`} variant="filled" color={color} onClick={() => onConfirm(sel)} fullWidth />
        </div>
      </div>
    </div>
  );
}

function ScoreInput({ value, color, label, onChange, onLongPress }) {
  const [timerActive, setTimerActive] = useState(false);
  const longFiredRef = { current: false };
  const timerIdRef = { current: null };
  const inputElRef = { current: null };
  const setInputRef = (el) => { inputElRef.current = el; };

  const startPress = (e) => {
    e.preventDefault();
    longFiredRef.current = false;
    timerIdRef.current = setTimeout(() => { longFiredRef.current = true; onLongPress(); }, 260);
  };
  const endPress = () => {
    clearTimeout(timerIdRef.current);
    if (!longFiredRef.current) inputElRef.current?.focus();
  };
  const cancelPress = () => clearTimeout(timerIdRef.current);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ color: M.onSurfaceMid, fontSize: 10, fontWeight: 600, textAlign: "center", letterSpacing: 0.8 }}>{label}</div>
      <div onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={cancelPress}
        onTouchStart={startPress} onTouchEnd={endPress} onTouchMove={cancelPress}>
        <input ref={setInputRef} inputMode="numeric" pattern="[0-9]*"
          value={value === 0 ? "0" : String(value)}
          onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); onChange(v === "" ? 0 : Math.min(99, parseInt(v))); }}
          onFocus={e => e.target.select()}
          style={{ height: 60, width: "100%", boxSizing: "border-box", background: M.surface, border: `2.5px solid ${color}`, borderRadius: 14, color, fontWeight: 900, fontSize: 30, textAlign: "center", outline: "none", caretColor: color }} />
      </div>
      <div style={{ color: M.onSurfaceLow, fontSize: 9, textAlign: "center" }}>點擊輸入・長按快選</div>
    </div>
  );
}

function ScoreSection({ gs, onScore, onSet }) {
  const [flash, setFlash] = useState(null);
  const [qp, setQp] = useState(null);
  if (!gs) return null;
  const handleSet = () => {
    const a = Number(gs.scoreA), b = Number(gs.scoreB);
    if (isNaN(a) || isNaN(b)) return;
    setFlash(`${a}:${b}`); setTimeout(() => setFlash(null), 1800); onSet();
  };
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${M.outline}` }}>
      {(gs.games || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 10 }}>
          {gs.games.map((g, i) => (
            <span key={i} style={{ background: g.winner === "A" ? `${M.primary}20` : `${M.secondary}20`, border: `1px solid ${g.winner === "A" ? M.primary : M.secondary}55`, borderRadius: 8, padding: "2px 10px", color: g.winner === "A" ? M.primary : M.secondary, fontSize: 12, fontWeight: 700 }}>局{i + 1} {g.scoreA}:{g.scoreB}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "start", marginBottom: 14 }}>
        <ScoreInput value={gs.scoreA} color={M.primary} label="左隊" onChange={v => onScore("a", v)} onLongPress={() => setQp("a")} />
        <div style={{ color: M.onSurfaceLow, fontSize: 20, paddingTop: 18, flexShrink: 0 }}>:</div>
        <ScoreInput value={gs.scoreB} color={M.secondary} label="右隊" onChange={v => onScore("b", v)} onLongPress={() => setQp("b")} />
      </div>
      <MdBtn label={flash ? `✓ 已記錄 ${flash}` : "記錄比分 ✓"} variant="tonal" color={flash ? M.primary : M.primary} onClick={handleSet} fullWidth />
      {qp && <QuickPick color={qp === "a" ? M.primary : M.secondary} initial={qp === "a" ? gs.scoreA : gs.scoreB} onClose={() => setQp(null)} onConfirm={v => { onScore(qp, v); setQp(null); }} />}
    </div>
  );
}

/* ── 球桌卡片 ─────────────────────────────────────────────── */
function DoublesCard({ table, gs, onScore, onSet, onSwap, label }) {
  const { teamA, teamB, tableNo, waitingPlayer } = table;
  return (
    <div style={{ background: M.surface, border: `1px solid ${M.outline}`, borderRadius: 20, padding: "18px 16px", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ color: M.primary, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>{label || `桌 ${tableNo}　雙打`}</span>
        {onSwap && <button onClick={onSwap} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${M.outline}`, color: M.onSurfaceMid, borderRadius: 20, padding: "4px 12px", fontSize: 11, cursor: "pointer" }}>換組 ↻</button>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {teamA.map(p => <Stickman key={p.id} color={M.primary} size={38} name={p.name} />)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><TableSVG /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {teamB.map(p => <Stickman key={p.id} color={M.secondary} size={38} name={p.name} flip />)}
        </div>
      </div>
      {waitingPlayer && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${M.outline}` }}>
          <span style={{ color: M.tertiary, fontSize: 11, fontWeight: 600 }}>候場：</span>
          <Stickman color={M.tertiary} size={28} name={waitingPlayer.name} />
        </div>
      )}
      <ScoreSection gs={gs} onScore={onScore} onSet={onSet} />
    </div>
  );
}

function SingleCard({ table, gs, onScore, onSet, onSwapA, onSwapB, waitingName }) {
  const { teamA, teamB, tableNo, waiting = [], isRest } = table;
  const pA = teamA?.[0], pB = teamB?.[0];
  const wName = waitingName || (waiting[0]?.name) || "";
  return (
    <div style={{ background: M.surface, border: `1px solid ${M.outline}`, borderRadius: 20, padding: "18px 16px", width: "100%", boxSizing: "border-box" }}>
      <span style={{ color: isRest ? M.tertiary : M.primary, fontSize: 11, fontWeight: 700, letterSpacing: 2, display: "block", marginBottom: 14 }}>{isRest ? "桌 " + tableNo + "　練習 / 單打" : `桌 ${tableNo}　單打`}</span>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Stickman color={M.primary} size={38} name={pA?.name || ""} />
          {onSwapA && wName && <button onClick={onSwapA} style={{ background: `${M.primary}15`, border: `1px solid ${M.primary}55`, color: M.primary, borderRadius: 14, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>換 {wName}</button>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><TableSVG /></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Stickman color={M.secondary} size={38} name={pB?.name || ""} flip />
          {onSwapB && wName && <button onClick={onSwapB} style={{ background: `${M.secondary}15`, border: `1px solid ${M.secondary}55`, color: M.secondary, borderRadius: 14, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>換 {wName}</button>}
        </div>
      </div>
      {waiting.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <span style={{ color: M.tertiary, fontSize: 10 }}>候場：</span>
          {waiting.map(p => <Stickman key={p.id} color={M.tertiary} size={28} name={p.name} />)}
        </div>
      )}
      {gs && <ScoreSection gs={gs} onScore={onScore} onSet={onSet} />}
    </div>
  );
}

function ArenaCard({ table, gs, onScore, onSet, onSwap }) {
  const { singles, tableNo } = table;
  const playing = singles.slice(0, 2);
  const waiting = singles.slice(2);
  return (
    <div style={{ background: M.surface, border: `1px solid rgba(255,209,102,0.25)`, borderRadius: 20, padding: "18px 16px", width: "100%", boxSizing: "border-box" }}>
      <span style={{ color: M.tertiary, fontSize: 11, fontWeight: 700, letterSpacing: 2, display: "block", marginBottom: 14 }}>桌 {tableNo}　擂台 / 練習</span>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <Stickman color={M.primary} size={36} name={playing[0]?.name || ""} />
        <div style={{ flex: 1, minWidth: 0 }}><TableSVG /></div>
        <Stickman color={M.secondary} size={36} name={playing[1]?.name || ""} flip />
      </div>
      {waiting.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <span style={{ color: M.tertiary, fontSize: 10 }}>候場：</span>
          {waiting.map(p => <Stickman key={p.id} color={M.tertiary} size={26} name={p.name} />)}
        </div>
      )}
      {onSwap && waiting.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {playing.map((p, i) => (
            <button key={p.id} onClick={() => onSwap(i)} style={{ flex: 1, height: 34, background: "rgba(255,209,102,0.1)", border: "1px solid rgba(255,209,102,0.3)", color: M.tertiary, borderRadius: 16, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              換 {waiting[0]?.name}
            </button>
          ))}
        </div>
      )}
      {gs && <ScoreSection gs={gs} onScore={onScore} onSet={onSet} />}
    </div>
  );
}

/* ── 紀錄頁 ───────────────────────────────────────────────── */
function HistoryRow({ table, gs }) {
  const [open, setOpen] = useState(false);
  if (!gs || !hasValidScore(gs)) return null;
  const games = gs.finalGames || gs.games || [];
  const sA = gs.scoreA, sB = gs.scoreB;
  const hasG = games.length > 0;
  const wA = games.filter(g => g.winner === "A").length, wB = games.filter(g => g.winner === "B").length;
  const aWin = hasG ? wA > wB : Number(sA) > Number(sB);
  const bWin = hasG ? wB > wA : Number(sB) > Number(sA);
  const aName = (table.teamA || table.singles?.slice(0, 1) || []).map(p => p.name).join("+");
  const bName = (table.teamB || table.singles?.slice(1, 2) || []).map(p => p.name).join("+");
  if (table.isSingles && !hasG) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <span style={{ color: M.onSurfaceLow, fontSize: 11 }}>桌{table.tableNo}</span>
        <span style={{ color: aWin ? M.primary : M.onSurfaceMid, fontWeight: aWin ? 700 : 400, fontSize: 13 }}>{aName}</span>
        <span style={{ color: M.onSurfaceLow, fontSize: 12 }}>{hasG ? `(${wA}:${wB})` : hasValidScore(gs) ? `${sA}:${sB}` : "vs"}</span>
        <span style={{ color: bWin ? M.secondary : M.onSurfaceMid, fontWeight: bWin ? 700 : 400, fontSize: 13 }}>{bName}</span>
      </div>
      {open && hasG && (
        <div style={{ display: "flex", gap: 5, marginTop: 4, paddingLeft: 28, flexWrap: "wrap" }}>
          {games.map((g, i) => (
            <span key={i} style={{ background: g.winner === "A" ? `${M.primary}18` : `${M.secondary}18`, border: `1px solid ${g.winner === "A" ? M.primary : M.secondary}44`, borderRadius: 8, padding: "2px 8px", color: g.winner === "A" ? M.primary : M.secondary, fontSize: 11, fontWeight: 700 }}>局{i + 1} {g.scoreA}:{g.scoreB}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   主 App
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState("home");
  const [members, setMems] = useState(ROSTER);
  const [guests, setGuests] = useState([]);
  const [guestInput, setGI] = useState("");
  const [rounds, setRounds] = useState([]);
  const [cur, setCur] = useState(null);         // {tables, gs}
  const [schedIdx, setSchedIdx] = useState(0);       // 場次索引
  const [mapped, setMapped] = useState([]);       // A..H → 真實球員
  const [mode4, setMode4] = useState("doubles");// 4人模式選擇
  const [mode5, setMode5] = useState("doubles");// 5人模式選擇
  const [overLimit, setOverLimit] = useState(false);    // 超過場次上限警語

  // 3人模式：選人狀態
  const [sel3, setSel3] = useState([]);
  // 4人模式：選人狀態
  const [sel4, setSel4] = useState([]);

  const addGuest = () => { const name = guestInput.trim(); if (!name) return; setGuests(g => [...g, { id: `g_${Date.now()}`, name, _v: 5.0, active: true }]); setGI(""); };
  const removeGuest = (id) => setGuests(g => g.filter(x => x.id !== id));

  const activePlayers = useMemo(() => {
    const base = [...members.filter(m => m.active), ...guests];
    const delta = calcDynaDelta(rounds);
    return applyDelta(base, delta);
  }, [members, guests, rounds]);

  const n = activePlayers.length;

  /* ── 比分 ─────────────────────────────────────────────────── */
  const handleScore = (tableNo, side, val) => {
    const key = side === "a" ? "scoreA" : "scoreB";
    setCur(c => ({ ...c, gs: { ...c.gs, [tableNo]: { ...c.gs[tableNo], [key]: val } } }));
  };
  const handleSet = (tableNo) => {
    setCur(c => {
      const gs = c.gs[tableNo];
      const a = Number(gs.scoreA), b = Number(gs.scoreB);
      if (isNaN(a) || isNaN(b)) return c;
      const winner = a > b ? "A" : b > a ? "B" : "";
      const games = [...(gs.games || []), { scoreA: a, scoreB: b, winner }];
      return { ...c, gs: { ...c.gs, [tableNo]: { ...gs, scoreA: 0, scoreB: 0, games, finished: true, finalGames: games } } };
    });
  };

  /* ── 儲存當前場次，推進到下一場 ──────────────────────────── */
  const saveAndNext = (newTables) => {
    if (cur) setRounds(r => [...r, cur]);
    const gs = {};
    newTables.forEach(t => { gs[t.tableNo] = initGS(t); });
    setCur({ tables: newTables, gs });
  };

  /* ── 開始分組 ────────────────────────────────────────────── */
  const startSession = useCallback(() => {
    setRounds([]); setCur(null); setSchedIdx(0); setSel3([]); setSel4([]); setOverLimit(false); setMode4(m => m);

    if (n === 2) {
      const [pA, pB] = activePlayers;
      const t = { tableNo: 1, teamA: [pA], teamB: [pB], isSingle1v1: true };
      const gs = { 1: initGS(t) };
      setCur({ tables: [t], gs });
      setPage("match"); return;
    }
    if (n === 3) {
      // 3人：手動點選
      setPage("match"); return;
    }
    if (n === 4) {
      if (mode4 === "singles") {
        // 4人單打：手動選人（像3人模式）
        setPage("match"); return;
      } else {
        // 4人雙打：走 schedule
        const shuffled = shuffleWithConstraint(activePlayers);
        setMapped(shuffled);
        const entry = SCHEDULE[4][0];
        const tables = makeTablesFromEntry(entry, shuffled);
        const gs = {}; tables.forEach(t => { gs[t.tableNo] = initGS(t); });
        setCur({ tables, gs });
        setSchedIdx(1);
        setPage("match"); return;
      }
    }

    // 5人單打模式
    if (n === 5 && mode5 === "singles") {
      const shuffled = shuffleWithConstraint(activePlayers);
      setMapped(shuffled);
      const entry = SCHEDULE[5][0];
      const waiting = shuffled[entry.rest[0]];
      const tables = [
        { tableNo: 1, teamA: [shuffled[entry.pairA[0]]], teamB: [shuffled[entry.pairA[1]]], isSingle1v1: true, waitingPlayer: waiting },
        { tableNo: 2, teamA: [shuffled[entry.pairB[0]]], teamB: [shuffled[entry.pairB[1]]], isSingle1v1: true, waitingPlayer: waiting },
      ];
      const gs = {}; tables.forEach(t => { gs[t.tableNo] = initGS(t); });
      setCur({ tables, gs });
      setSchedIdx(1);
      setPage("match"); return;
    }

    // 5人雙打 + 6/7/8人
    const shuffled = shuffleWithConstraint(activePlayers);
    setMapped(shuffled);
    const key = Math.min(n, 8);
    const schedule = SCHEDULE[key];
    if (!schedule) { setPage("match"); return; }
    const tables = makeTablesFromEntry(schedule[0], shuffled, null);
    const gs = {}; tables.forEach(t => { gs[t.tableNo] = initGS(t); });
    setCur({ tables, gs });
    setSchedIdx(1);
    setPage("match");
  }, [activePlayers, n, mode4, mode5]);

  /* ── 產生下一場 ──────────────────────────────────────────── */
  const nextRound = useCallback(() => {
    // 4人單打：清除 cur，回到手動選人
    if (n === 4 && mode4 === "singles") {
      if (cur) setRounds(r => [...r, cur]);
      setCur(null);
      return;
    }

    if (cur) setRounds(r => [...r, cur]);
    const key = Math.min(n, 8);
    const schedule = SCHEDULE[key];
    if (!schedule) { setCur(null); return; }

    // 超過場次上限 → reshuffle，重新洗牌
    let currentMapped = mapped;
    if (schedIdx >= schedule.length) {
      currentMapped = shuffleWithConstraint(activePlayers);
      setMapped(currentMapped);
      setSchedIdx(0);
      setOverLimit(true);
    }

    const idx = (schedIdx >= schedule.length) ? 0 : schedIdx;
    const entry = schedule[idx];

    let tables;
    if (n === 5 && mode5 === "singles") {
      const waiting = currentMapped[entry.rest[0]];
      tables = [
        { tableNo: 1, teamA: [currentMapped[entry.pairA[0]]], teamB: [currentMapped[entry.pairA[1]]], isSingle1v1: true, waitingPlayer: waiting },
        { tableNo: 2, teamA: [currentMapped[entry.pairB[0]]], teamB: [currentMapped[entry.pairB[1]]], isSingle1v1: true, waitingPlayer: waiting },
      ];
    } else {
      tables = makeTablesFromEntry(entry, currentMapped);
    }

    const gs = {}; tables.forEach(t => { gs[t.tableNo] = initGS(t); });
    setCur({ tables, gs });
    setSchedIdx(i => (i >= schedule.length ? 1 : i + 1));
  }, [cur, n, schedIdx, mapped, mode4, mode5, overLimit, activePlayers]);

  /* ── 3人：換人 ───────────────────────────────────────────── */
  const swap3 = (swapIdx) => {
    if (!cur) return;
    const t = cur.tables[0];
    const pA = t.teamA[0], pB = t.teamB[0];
    const waiting = t.waiting?.[0] || activePlayers.find(p => p.id !== pA.id && p.id !== pB.id);
    if (!waiting) return;
    let newA = pA, newB = pB, newWaiting;
    if (swapIdx === 0) { newA = waiting; newWaiting = pA; }
    else { newB = waiting; newWaiting = pB; }
    const newTable = { ...t, teamA: [newA], teamB: [newB], waiting: [newWaiting] };
    const gs = { 1: initGS(newTable) };
    if (cur) setRounds(r => [...r, cur]);
    setCur({ tables: [newTable], gs });
  };

  /* ── 5人單打：換人 ────────────────────────────────────────── */
  const swap5Singles = (tableNo, side) => {
    if (!cur) return;
    const allTables = cur.tables;
    const waitingPlayer = allTables.find(t => t.waitingPlayer)?.waitingPlayer;
    if (!waitingPlayer) return;
    const targetTable = allTables.find(t => t.tableNo === tableNo);
    if (!targetTable) return;
    const outPlayer = side === "A" ? targetTable.teamA[0] : targetTable.teamB[0];
    if (!outPlayer) return;
    const newTables = allTables.map(t => {
      if (t.tableNo === tableNo) {
        return {
          ...t,
          teamA: side === "A" ? [waitingPlayer] : t.teamA,
          teamB: side === "B" ? [waitingPlayer] : t.teamB,
          waitingPlayer: outPlayer,
        };
      }
      return { ...t, waitingPlayer: outPlayer };
    });
    const gs = {}; newTables.forEach(t => { gs[t.tableNo] = initGS(t); });
    if (cur) setRounds(r => [...r, cur]);
    setCur({ tables: newTables, gs });
  };

  /* ── 換組按鈕（6人以上桌1）──────────────────────────────── */
  const swapTable1 = () => {
    if (!cur) return;
    const t = cur.tables.find(t => t.tableNo === 1);
    if (!t) return;
    const { teamA, teamB } = t;
    // 交換搭檔：[A0,B0] vs [A1,B1]
    const newTable = { ...t, teamA: [teamA[0], teamB[0]], teamB: [teamA[1], teamB[1]] };
    const newGs = { ...cur.gs, [1]: initGS(newTable) };
    if (cur) setRounds(r => [...r, cur]);
    setCur(c => ({ ...c, tables: c.tables.map(t => t.tableNo === 1 ? newTable : t), gs: newGs }));
  };

  /* ── 擂台換人 ────────────────────────────────────────────── */
  const swapArena = (tableNo, playingIdx) => {
    if (!cur) return;
    const t = cur.tables.find(t => t.tableNo === tableNo);
    if (!t || !t.isSingles) return;
    const newSingles = [...t.singles];
    // 把 playingIdx 那人換到候場位（最後），候場第一人換上來
    const waiting = newSingles.splice(2, 1)[0];
    const outPlayer = newSingles.splice(playingIdx, 1)[0];
    newSingles.splice(playingIdx, 0, waiting);
    newSingles.push(outPlayer);
    const newTable = { ...t, singles: newSingles };
    const newGs = { ...cur.gs, [tableNo]: initGS(newTable) };
    if (cur) setRounds(r => [...r, cur]);
    setCur(c => ({ ...c, tables: c.tables.map(t => t.tableNo === tableNo ? newTable : t), gs: newGs }));
  };

  const handleEnd = () => { if (cur) { setRounds(r => [...r, cur]); setCur(null); } setPage("end"); };

  /* ── 結算統計 ─────────────────────────────────────────────── */
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const stats = useMemo(() => {
    const all = [...rounds, ...(cur ? [cur] : [])];
    const map = {};
    for (const rd of all) {
      for (const t of (rd.tables || [])) {
        const gs = rd.gs?.[t.tableNo];
        if (!gs || !hasValidScore(gs)) continue;
        const games = gs.finalGames || gs.games || [];
        const allP = [...(t.teamA || []), ...(t.teamB || [])];
        allP.forEach(p => { if (!map[p.id]) map[p.id] = { name: p.name, wins: 0, games: 0, history: [] }; });
        const processGames = (ta, tb, glist) => {
          const aName = ta.map(p => p.name).join("+"), bName = tb.map(p => p.name).join("+");
          if (glist.length > 0) {
            const wA = glist.filter(g => g.winner === "A").length, wB = glist.filter(g => g.winner === "B").length;
            if (!wA && !wB) return;
            const wt = wA > wB ? "A" : wB > wA ? "B" : null;
            ta.forEach(p => { map[p.id].games++; if (wt === "A") map[p.id].wins++; map[p.id].history.push({ myTeam: aName, oppTeam: bName, score: glist.map(g => `${g.scoreA}:${g.scoreB}`).join(", "), win: wt === "A" }); });
            tb.forEach(p => { map[p.id].games++; if (wt === "B") map[p.id].wins++; map[p.id].history.push({ myTeam: bName, oppTeam: aName, score: glist.map(g => `${g.scoreB}:${g.scoreA}`).join(", "), win: wt === "B" }); });
          } else {
            const a = Number(gs.scoreA), b = Number(gs.scoreB);
            if (!a && !b) return;
            const wt = a > b ? "A" : b > a ? "B" : null;
            ta.forEach(p => { map[p.id].games++; if (wt === "A") map[p.id].wins++; map[p.id].history.push({ myTeam: aName, oppTeam: bName, score: `${a}:${b}`, win: wt === "A" }); });
            tb.forEach(p => { map[p.id].games++; if (wt === "B") map[p.id].wins++; map[p.id].history.push({ myTeam: bName, oppTeam: aName, score: `${b}:${a}`, win: wt === "B" }); });
          }
        };
        if (t.teamA && t.teamB) processGames(t.teamA, t.teamB, games);
      }
    }
    const sorted = Object.values(map).filter(s => s.games > 0).map(s => ({ ...s, rate: Math.round(s.wins / s.games * 100) })).sort((a, b) => b.rate - a.rate || b.wins - a.wins);
    let rank = 1;
    return sorted.map((s, i) => { if (i > 0 && (s.rate !== sorted[i - 1].rate || s.wins !== sorted[i - 1].wins)) rank = i + 1; return { ...s, rank }; });
  }, [rounds, cur]);

  const rankMedal = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `#${r}`;

  /* ── 3人選人畫面 ─────────────────────────────────────────── */
  const render3Select = () => {
    const ps = activePlayers;
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ color: M.onSurfaceMid, fontSize: 13, marginBottom: 16 }}>挑選兩人開始對打</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {ps.map(p => (
            <button key={p.id} onClick={() => {
              setSel3(s => {
                if (s.includes(p.id)) return s.filter(x => x !== p.id);
                if (s.length >= 2) return s;
                const ns = [...s, p.id];
                if (ns.length === 2) {
                  // 開始！
                  const pA = ps.find(x => x.id === ns[0]);
                  const pB = ps.find(x => x.id === ns[1]);
                  const waiting = ps.filter(x => x.id !== ns[0] && x.id !== ns[1]);
                  const t = { tableNo: 1, teamA: [pA], teamB: [pB], isSingle1v1: true, waiting };
                  const gs = { 1: initGS(t) };
                  setCur({ tables: [t], gs });
                  setSel3([]);
                }
                return ns;
              });
            }} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              background: sel3.includes(p.id) ? `${M.primary}20` : "rgba(255,255,255,0.05)",
              border: `2px solid ${sel3.includes(p.id) ? M.primary : M.outline}`,
              borderRadius: 16, padding: "12px 20px", cursor: "pointer",
              color: sel3.includes(p.id) ? M.primary : M.onSurface,
            }}>
              <Stickman color={sel3.includes(p.id) ? M.primary : M.onSurfaceMid} size={40} name="" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
            </button>
          ))}
        </div>
        <div style={{ color: M.onSurfaceLow, fontSize: 12 }}>已選 {sel3.length}/2</div>
      </div>
    );
  };

  /* ── 4人選人畫面 ─────────────────────────────────────────── */
  const render4Select = () => {
    const ps = activePlayers;
    const isSingles = mode4 === "singles";
    const hint = isSingles ? "選兩人 → 桌1對打，另外兩人 → 桌2對打" : "選兩人組成一隊，剩下兩人自動組隊";
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ color: M.onSurfaceMid, fontSize: 13, marginBottom: 16 }}>{hint}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {ps.map(p => (
            <button key={p.id} onClick={() => {
              setSel4(s => {
                if (s.includes(p.id)) return s.filter(x => x !== p.id);
                if (s.length >= 2) return s;
                const ns = [...s, p.id];
                if (ns.length === 2) {
                  const picked = ps.filter(x => ns.includes(x.id));
                  const others = ps.filter(x => !ns.includes(x.id));
                  let tables, gs;
                  if (isSingles) {
                    // 單打：選中的兩人各自對打，另外兩人對打
                    tables = [
                      { tableNo: 1, teamA: [picked[0]], teamB: [picked[1]], isSingle1v1: true },
                      { tableNo: 2, teamA: [others[0]], teamB: [others[1]], isSingle1v1: true },
                    ];
                    gs = { 1: initGS(tables[0]), 2: initGS(tables[1]) };
                  } else {
                    // 雙打：選中的兩人同隊
                    const t = { tableNo: 1, teamA: picked, teamB: others };
                    tables = [t];
                    gs = { 1: initGS(t) };
                  }
                  setCur({ tables, gs });
                  setSel4([]);
                }
                return ns;
              });
            }} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              background: sel4.includes(p.id) ? `${M.primary}20` : "rgba(255,255,255,0.05)",
              border: `2px solid ${sel4.includes(p.id) ? M.primary : M.outline}`,
              borderRadius: 16, padding: "12px 20px", cursor: "pointer",
              color: sel4.includes(p.id) ? M.primary : M.onSurface,
            }}>
              <Stickman color={sel4.includes(p.id) ? M.primary : M.onSurfaceMid} size={40} name="" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
            </button>
          ))}
        </div>
        <div style={{ color: M.onSurfaceLow, fontSize: 12 }}>已選 {sel4.length}/2</div>
      </div>
    );
  };

  /* ── 渲染球桌 ─────────────────────────────────────────────── */
  const renderTable = (t) => {
    if (!cur) return null;
    const gs = cur.gs[t.tableNo];
    if (t.isSingles) return (
      <ArenaCard key={t.tableNo} table={t} gs={gs}
        onScore={(s, v) => handleScore(t.tableNo, s, v)} onSet={() => handleSet(t.tableNo)}
        onSwap={t.isRest ? (idx) => swapArena(t.tableNo, idx) : null} />
    );
    const waitingName = t.waitingPlayer?.name || t.waiting?.[0]?.name || "";
    if (t.isSingle1v1) return (
      <SingleCard key={t.tableNo} table={t} gs={gs}
        waitingName={waitingName}
        onScore={(s, v) => handleScore(t.tableNo, s, v)} onSet={() => handleSet(t.tableNo)}
        onSwapA={n === 3 && waitingName ? () => swap3(0) : (n === 5 && mode5 === "singles" && waitingName ? () => swap5Singles(t.tableNo, "A") : null)}
        onSwapB={n === 3 && waitingName ? () => swap3(1) : (n === 5 && mode5 === "singles" && waitingName ? () => swap5Singles(t.tableNo, "B") : null)} />
    );
    return (
      <DoublesCard key={t.tableNo} table={t} gs={gs}
        onScore={(s, v) => handleScore(t.tableNo, s, v)} onSet={() => handleSet(t.tableNo)}
        onSwap={t.tableNo === 1 && n >= 4 ? swapTable1 : null} />
    );
  };

  /* ── 歷史列表 ─────────────────────────────────────────────── */
  const historyList = useMemo(() => [
    ...rounds.map((r, i) => ({ ...r, _key: i, _ri: i })),
    ...(cur ? [{ ...cur, _key: "cur", _ri: "cur", _isCurrent: true }] : []),
  ], [rounds, cur]);

  /* ── 主渲染 ─────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: M.bg, color: M.onSurface, fontFamily: "'Noto Sans TC','PingFang TC',sans-serif", boxSizing: "border-box", maxWidth: "100vw", overflow: "hidden" }}>

      {/* 頂部 App Bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,17,23,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${M.outline}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <button onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: M.primary }}>
          <span style={{ fontSize: 22 }}>🏓</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>乒乓分組器</span>
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {[["home", "首頁"], ["match", "出賽"], ["history", "紀錄"]].map(([p, l]) => (
            <button key={p} onClick={() => setPage(p)} style={{ background: page === p ? `${M.primary}18` : "transparent", border: `1px solid ${page === p ? M.primary : M.outline}`, color: page === p ? M.primary : M.onSurfaceMid, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
          ))}
          {(rounds.length > 0 || cur) && <button onClick={handleEnd} style={{ background: "rgba(255,100,80,0.12)", border: "1px solid rgba(255,100,80,0.4)", color: "#ff8a80", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>結算</button>}
        </div>
      </div>

      <main style={{ padding: "20px 14px 80px", maxWidth: 560, margin: "0 auto" }}>

        {/* ── 首頁 ── */}
        {page === "home" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: M.onSurfaceMid, letterSpacing: 1, marginBottom: 10 }}>出席名單</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {members.map(m => <Chip key={m.id} label={m.name} selected={m.active} onClick={() => setMems(ms => ms.map(x => x.id === m.id ? { ...x, active: !x.active } : x))} />)}
              {guests.map(g => <Chip key={g.id} label={`${g.name} ✕`} selected color={M.tertiary} onClick={() => removeGuest(g.id)} />)}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: M.onSurfaceMid, letterSpacing: 1, marginBottom: 10 }}>臨打</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <input placeholder="輸入姓名" value={guestInput} onChange={e => setGI(e.target.value)} onKeyDown={e => e.key === "Enter" && addGuest()}
                style={{ flex: 1, background: M.surface, border: `1.5px solid ${M.outline}`, borderRadius: 12, padding: "10px 14px", color: M.onSurface, fontSize: 14, outline: "none" }} />
              <MdBtn label="＋ 加入" variant="tonal" color={M.tertiary} onClick={addGuest} />
            </div>

            <div style={{ background: M.surface, borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: M.onSurfaceMid, fontSize: 13 }}>今晚出席：</span>
              <span style={{ color: M.primary, fontWeight: 800, fontSize: 18 }}>{n} 人</span>
              <span style={{ color: M.outline }}>｜</span>
              <span style={{ color: M.tertiary, fontSize: 13 }}>{n >= 8 ? "兩桌雙打" : n === 7 ? "一桌雙打＋一桌單打/練習（7人循環）" : n === 6 ? "一桌雙打＋一桌單打/練習（6人循環）" : n === 5 ? (mode5 === "singles" ? "兩桌單打（5人）" : "一桌雙打（5人循環）") : n === 4 ? (mode4 === "singles" ? "兩桌單打（手動選人）" : "一桌雙打（自動分組）") : n === 3 ? "一桌單打（手動選人）" : n === 2 ? "一桌單打" : "人數不足"}</span>
            </div>

            {n === 4 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <Chip label="雙打模式" selected={mode4 === "doubles"} onClick={() => setMode4("doubles")} />
                <Chip label="單打模式" selected={mode4 === "singles"} onClick={() => setMode4("singles")} />
              </div>
            )}
            {n === 5 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <Chip label="雙打模式" selected={mode5 === "doubles"} onClick={() => setMode5("doubles")} />
                <Chip label="單打模式" selected={mode5 === "singles"} onClick={() => setMode5("singles")} />
              </div>
            )}

            {n >= 2 && <MdBtn label="開始分組 🏓" variant="filled" color={M.primary} onClick={startSession} fullWidth />}
            {n < 2 && <div style={{ color: M.onSurfaceLow, fontSize: 13, textAlign: "center", marginTop: 8 }}>至少需要 2 位出席者</div>}

            <div style={{ marginTop: 24, background: M.surface, borderRadius: 16, padding: "14px 16px" }}>
              {[{
                key: 3,
                text: "3人：一桌單打，手動點選對戰組合"
              }, {
                key: 4,
                text: "4人：先選單打或雙打模式，單打模式請手動點選對戰組合；雙打模式程式自動分組，數學上第4場開始搭檔必然重複。"
              }, {
                key: 5,
                text: "5人：先選單打或雙打模式，單打模式程式自動分組，可點選換人按鈕換人；雙打模式程式自動分組，5場為一個循環，每個人都是5場裡打4休1。數學上第4場開始搭檔必然重複。"
              }, {
                key: 6,
                text: "6人：預設一桌雙打一桌單打或練習，程式自動分組，數學上第5場開始搭檔必然重複。優先考慮讓單打練習桌的人下一場必然換去打雙打，同時在9場後每兩個人都至少搭檔過一次。"
              }, {
                key: 7,
                text: "7人：預設一桌雙打一桌單打或練習，程式自動分組，數學上第9場開始搭檔必然重複。優先考慮讓單打練習桌的人下一場必然換去打雙打，同時在13場後每兩個人都至少搭檔過一次。"
              }, {
                key: 8,
                text: "8人：兩桌雙打，數學上可以完美實現14場對戰組合都不重複。"
              }].map(item => (
                <div key={item.key} style={{
                  fontSize: 11, lineHeight: 1.8, marginBottom: 4, padding: "4px 8px", borderRadius: 8,
                  background: n === item.key ? `${M.primary}18` : "transparent",
                  color: n === item.key ? M.onSurface : M.onSurfaceLow,
                  border: n === item.key ? `1px solid ${M.primary}44` : "1px solid transparent",
                  fontWeight: n === item.key ? 600 : 400,
                  transition: "all 0.2s",
                }}>• {item.text}</div>
              ))}
              <div style={{ fontSize: 11, color: M.onSurfaceLow, marginTop: 4, padding: "0 8px" }}>
                💡 分數框點擊輸入，長按快選 0–11
              </div>
            </div>
          </div>
        )}

        {/* ── 出賽頁 ── */}
        {page === "match" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: M.onSurfaceMid, fontSize: 13, fontWeight: 600 }}>
                對戰組合 <span style={{ color: M.primary, fontWeight: 800, fontSize: 18 }}>#{rounds.length + (cur ? 1 : 0)}</span>
                {n >= 4 && !(n === 4 && mode4 === "singles") && SCHEDULE[Math.min(n, 8)] && (
                  <span style={{ color: M.onSurfaceLow, fontSize: 12, marginLeft: 8 }}>
                    （第 {Math.min(schedIdx, SCHEDULE[Math.min(n, 8)].length)}/{SCHEDULE[Math.min(n, 8)].length} 場）
                  </span>
                )}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {n >= 4 && <MdBtn label="下一組 →" variant="tonal" color={M.primary} onClick={nextRound} small />}
                <MdBtn label="結束今日" variant="outlined" color="#ff8a80" onClick={handleEnd} small />
              </div>
            </div>

            {/* 超過場次警語 */}
            {(() => {
              const currentRound = rounds.length + (cur ? 1 : 0);
              let msg = null;
              if (n === 4 && mode4 === "doubles" && currentRound >= 4) {
                msg = "已完成一次循環，分組將開始重複";
              } else if (n === 5 && mode5 === "doubles" && currentRound >= 6) {
                msg = "已完成一次循環，分組將開始重複";
              } else if (n === 6 && currentRound >= 5) {
                msg = "已達數學上限，分組將開始重複。9場後重分";
              } else if (n === 7 && currentRound >= 9) {
                msg = "已達數學上限，分組將開始重複，14場後重分";
              } else if (n >= 8 && currentRound >= 8) {
                msg = "已完成一次循環，分組將開始重複";
              }
              if (!msg) return null;
              return (
                <div style={{ background: "rgba(255,180,50,0.12)", border: "1px solid rgba(255,180,50,0.35)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ color: "#ffca6e", fontSize: 12 }}>{msg}</span>
                </div>
              );
            })()}

            {/* 2人 */}
            {n === 2 && cur && <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{cur.tables.map(t => renderTable(t))}</div>}

            {/* 3人手動選人 */}
            {n === 3 && !cur && render3Select()}
            {n === 3 && cur && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cur.tables.map(t => renderTable(t))}
              </div>
            )}

            {/* 4人單打：手動選人 */}
            {n === 4 && mode4 === "singles" && !cur && render4Select()}
            {n === 4 && mode4 === "singles" && cur && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cur.tables.map(t => renderTable(t))}
              </div>
            )}

            {/* 4人雙打 + 5人以上 */}
            {(n === 4 && mode4 === "doubles" ? true : n >= 5) && cur && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cur.tables.map(t => renderTable(t))}
              </div>
            )}
            {(n === 4 && mode4 === "doubles" ? true : n >= 5) && !cur && <div style={{ textAlign: "center", color: M.onSurfaceLow, marginTop: 40 }}>請先到首頁開始分組</div>}
          </div>
        )}

        {/* ── 紀錄頁 ── */}
        {page === "history" && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: M.onSurface, marginBottom: 16 }}>今日紀錄</div>
            {!historyList.length && <div style={{ color: M.onSurfaceLow, textAlign: "center", marginTop: 40 }}>尚無紀錄</div>}
            {historyList.map(rd => (
              <div key={rd._key} style={{ background: M.surface, border: `1px solid ${rd._isCurrent ? "rgba(130,180,255,0.3)" : M.outline}`, borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: M.primary, fontSize: 12, fontWeight: 700 }}>對戰組合 #{typeof rd._ri === "number" ? rd._ri + 1 : rounds.length + 1}</span>
                  {rd._isCurrent && <span style={{ background: "rgba(255,209,102,0.15)", border: "1px solid rgba(255,209,102,0.3)", color: M.tertiary, borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>進行中</span>}
                </div>
                {(rd.tables || []).map(t => <HistoryRow key={t.tableNo} table={t} gs={rd.gs?.[t.tableNo]} />)}
              </div>
            ))}
          </div>
        )}

        {/* ── 結算頁 ── */}
        {page === "end" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>今日結算</div>
            <div style={{ color: M.onSurfaceLow, fontSize: 13, marginBottom: 24 }}>
              共 {[...rounds, ...(cur ? [cur] : [])].reduce((s, r) => { return s + (r.tables || []).filter(t => hasValidScore(r.gs?.[t.tableNo]) && !t.isSingles && !t.isSingle1v1).length; }, 0)} 有效場次
            </div>
            {!stats.length && <div style={{ color: M.onSurfaceLow }}>沒有有效比分紀錄</div>}
            {stats.map(s => (
              <div key={s.name}>
                <div style={{ background: M.surface, border: `1px solid ${expandedPlayer === s.name ? M.primary : s.rank === 1 ? "rgba(255,209,102,0.35)" : M.outline}`, borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 22, minWidth: 28 }}>{rankMedal(s.rank)}</span>
                  <button onClick={() => setExpandedPlayer(ep => ep === s.name ? null : s.name)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    <span style={{ fontWeight: s.rank === 1 ? 800 : 600, color: s.rank === 1 ? M.tertiary : M.onSurface, fontSize: 15 }}>{s.name}</span>
                  </button>
                  <span style={{ color: M.primary, fontWeight: 800, fontSize: 16 }}>{s.rate}%</span>
                  <span style={{ color: M.onSurfaceLow, fontSize: 12 }}>{s.wins}勝/{s.games}場</span>
                </div>
                {expandedPlayer === s.name && (
                  <div style={{ background: `${M.primary}08`, border: `1px solid ${M.primary}20`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, marginTop: -4 }}>
                    <div style={{ color: M.primary, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{s.name} 今日戰績</div>
                    {(s.history || []).map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ color: M.onSurfaceLow, minWidth: 20 }}>#{i + 1}</span>
                        <span style={{ color: h.win ? M.primary : M.onSurfaceMid, fontWeight: h.win ? 700 : 400 }}>{h.myTeam}</span>
                        <span style={{ color: M.onSurfaceLow }}>vs</span>
                        <span style={{ color: !h.win ? M.secondary : M.onSurfaceMid }}>{h.oppTeam}</span>
                        <span style={{ color: h.win ? M.primary : M.secondary, fontWeight: 700, marginLeft: "auto" }}>{h.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <MdBtn label="🔄 開始新的一晚" variant="tonal" color={M.primary} onClick={() => { setRounds([]); setCur(null); setSchedIdx(0); setGuests([]); setMapped([]); setExpandedPlayer(null); setSel3([]); setSel4([]); setOverLimit(false); setPage("home"); }} fullWidth />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
