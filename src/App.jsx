import { useState, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   隱藏評分系統 — 內部使用，請勿外露
   ═══════════════════════════════════════════════════════════ */
const ROSTER = [
  { id:"alan",    name:"Alan",  _v:8.5, active:true },
  { id:"jimmy",   name:"Jimmy", _v:8.5, active:true },
  { id:"curly",   name:"捲毛",  _v:8.0, active:true },
  { id:"peiyun",  name:"珮芸",  _v:7.5, active:true },
  { id:"siu",     name:"修哥",  _v:7.0, active:true },
  { id:"wenzhu",  name:"雯筑",  _v:5.0, active:true },
  { id:"yinxuan", name:"音旋",  _v:3.0, active:true },
];

/* ── 組合評分 ─────────────────────────────────────────────── */
function _rank(tA, tB, hist, phase) {
  const gap = Math.abs(tA.reduce((s,p)=>s+p._v,0) - tB.reduce((s,p)=>s+p._v,0));
  const balPen = phase===1 ? gap*3 : gap*1;
  const pkA = [...tA.map(p=>p.id)].sort().join("-");
  const pkB = [...tB.map(p=>p.id)].sort().join("-");
  const mk  = [pkA,pkB].sort().join("|");
  const rep = (hist.partners.get(pkA)||0)+(hist.partners.get(pkB)||0)+(hist.matches.get(mk)||0)*2;
  return -(balPen + rep*4);
}

function* _combs(arr, k) {
  if(k===0){yield[];return;}
  for(let i=0;i<=arr.length-k;i++)
    for(const r of _combs(arr.slice(i+1),k-1)) yield [arr[i],...r];
}

function _bestDoubles(players, hist, phase) {
  if(players.length<4) return null;
  let best=null, top=-Infinity;
  for(let a=0;a<players.length-1;a++)
    for(let b=a+1;b<players.length;b++){
      const tA=[players[a],players[b]];
      const rest=players.filter((_,i)=>i!==a&&i!==b);
      for(let c=0;c<rest.length-1;c++)
        for(let d=c+1;d<rest.length;d++){
          const tB=[rest[c],rest[d]];
          const sc=_rank(tA,tB,hist,phase);
          if(sc>top){top=sc;best={teamA:tA,teamB:tB};}
        }
    }
  return best;
}

/* ── 大型場次（6人以上）────────────────────────────────────── */
function makeRound(active, hist, idx) {
  const phase=idx<6?1:2, n=active.length;
  if(n>=8){
    let b1=null,b2=null,top=-Infinity;
    for(const c4 of _combs(active,4)){
      const rem=active.filter(p=>!c4.includes(p));
      if(rem.length<4) continue;
      const m1=_bestDoubles(c4,hist,phase);
      const m2=_bestDoubles(rem.slice(0,4),hist,phase);
      if(!m1||!m2) continue;
      const t=_rank(m1.teamA,m1.teamB,hist,phase)+_rank(m2.teamA,m2.teamB,hist,phase);
      if(t>top){top=t;b1={...m1,tableNo:1};b2={...m2,tableNo:2};}
    }
    return b1&&b2?[b1,b2]:null;
  }
  if(n===7||n===6){
    let best=null,top=-Infinity;
    for(const c4 of _combs(active,4)){
      const m=_bestDoubles(c4,hist,phase);
      if(!m) continue;
      const sc=_rank(m.teamA,m.teamB,hist,phase);
      if(sc>top){top=sc;best={match:m,four:c4};}
    }
    if(!best) return null;
    const singles=active.filter(p=>!best.four.includes(p));
    // 6人: isSingles1v1擂台，7人: isSingles擂台
    if(n===6) return [{...best.match,tableNo:1},{teamA:[singles[0]],teamB:[singles[1]],tableNo:2,isSingle1v1:true}];
    return [{...best.match,tableNo:1},{singles,tableNo:2,isSingles:true}];
  }
  return null;
}

/* ── 5人以下場次 ──────────────────────────────────────────── */
function makeSmallRound(active, mode, callCount) {
  const n=active.length;

  if(n===5){
    if(mode==="doubles"){
      // 輪流休息：每場換一個人休息
      const sittingIdx=callCount%5;
      const sitting=active[sittingIdx];
      const others=active.filter(p=>p.id!==sitting.id);
      const combos=[
        [[others[0],others[1]],[others[2],others[3]]],
        [[others[0],others[2]],[others[1],others[3]]],
        [[others[0],others[3]],[others[1],others[2]]],
      ];
      const pick=combos[callCount%3];
      // FIX #4: 顯示候場
      return [{teamA:pick[0],teamB:pick[1],tableNo:1,waiting:[sitting]}];
    } else {
      // 單打：兩桌，輪流一人候場
      const sittingIdx=callCount%5;
      const sitting=active[sittingIdx];
      const others=active.filter(p=>p.id!==sitting.id);
      return [
        {teamA:[others[0]],teamB:[others[1]],tableNo:1,isSingle1v1:true},
        {teamA:[others[2]],teamB:[others[3]],tableNo:2,isSingle1v1:true,waiting:[sitting]},
      ];
    }
  }

  if(n===4){
    if(mode==="doubles"){
      const combos=[
        [[active[0],active[1]],[active[2],active[3]]],
        [[active[0],active[2]],[active[1],active[3]]],
        [[active[0],active[3]],[active[1],active[2]]],
      ];
      // FIX #3: 每次用不同組合
      const pick=combos[callCount%3];
      return [{teamA:pick[0],teamB:pick[1],tableNo:1}];
    } else {
      // FIX #3: 單打4人兩桌，輪換對手
      const pairs=[
        [{teamA:[active[0]],teamB:[active[1]],tableNo:1,isSingle1v1:true},{teamA:[active[2]],teamB:[active[3]],tableNo:2,isSingle1v1:true}],
        [{teamA:[active[0]],teamB:[active[2]],tableNo:1,isSingle1v1:true},{teamA:[active[1]],teamB:[active[3]],tableNo:2,isSingle1v1:true}],
        [{teamA:[active[0]],teamB:[active[3]],tableNo:1,isSingle1v1:true},{teamA:[active[1]],teamB:[active[2]],tableNo:2,isSingle1v1:true}],
      ];
      return pairs[callCount%3];
    }
  }

  // FIX #2: 3人以下擂台 — 輪換上場，候場的人下一場替換輸家
  if(n===3){
    // callCount決定誰先候場，之後輸者換
    const sittingIdx=callCount%3;
    const sitting=active[sittingIdx];
    const playing=active.filter(p=>p.id!==sitting.id);
    return [{teamA:[playing[0]],teamB:[playing[1]],tableNo:1,isSingle1v1:true,waiting:[sitting]}];
  }

  if(n===2){
    return [{teamA:[active[0]],teamB:[active[1]],tableNo:1,isSingle1v1:true}];
  }

  return null;
}

/* ── 歷史記錄更新 ─────────────────────────────────────────── */
function bumpHist(hist, tables) {
  const h={partners:new Map(hist.partners),matches:new Map(hist.matches)};
  for(const t of tables){
    if(t.isSingles||t.isSingle1v1) continue;
    const pkA=[...t.teamA.map(p=>p.id)].sort().join("-");
    const pkB=[...t.teamB.map(p=>p.id)].sort().join("-");
    const mk=[pkA,pkB].sort().join("|");
    h.partners.set(pkA,(h.partners.get(pkA)||0)+1);
    h.partners.set(pkB,(h.partners.get(pkB)||0)+1);
    h.matches.set(mk,(h.matches.get(mk)||0)+1);
  }
  return h;
}

/* ── WTT 發球規則 ─────────────────────────────────────────── */
// FIX #5: 發球方必定站右側(teamB=紅)，接球方在左側(teamA=藍)
// 所以我們用 serverSide 決定誰發球，並在顯示時把發球者放右
function initServer(teamA, teamB) {
  // 隨機選哪隊先發
  const side=Math.random()<0.5?"A":"B";
  const servingTeam=side==="A"?teamA:teamB;
  const receivingTeam=side==="A"?teamB:teamA;
  return {
    servingTeamSide: side,
    serverIdx: Math.floor(Math.random()*servingTeam.length),
    receiverIdx: Math.floor(Math.random()*receivingTeam.length),
  };
}

function rotateSvForNewGame(sv, teamALen, teamBLen) {
  const newSide=sv.servingTeamSide==="A"?"B":"A";
  return {
    servingTeamSide: newSide,
    serverIdx: (sv.serverIdx+1)%(newSide==="A"?teamALen:teamBLen),
    receiverIdx: (sv.receiverIdx+1)%(newSide==="A"?teamBLen:teamALen),
  };
}

/* ═══════════════════════════════════════════════════════════
   SVG 小人
   ═══════════════════════════════════════════════════════════ */
const CA="#3ecfff", CB="#ff6b6b";

function PlayerFig({ color=CA, size=44, flip=false, serving=false, name="" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
      {serving
        ? <div style={{background:color,color:"#000",fontSize:9,fontWeight:900,
            borderRadius:10,padding:"2px 8px",letterSpacing:1.2,
            boxShadow:`0 0 10px ${color}88`,marginBottom:1}}>發球</div>
        : <div style={{height:20}}/>
      }
      <svg width={size} height={size*1.8} viewBox="0 0 44 80"
        style={{display:"block",transform:flip?"scaleX(-1)":"none"}}>
        <ellipse cx={flip?10:34} cy={33} rx={9} ry={11} fill={color} opacity={0.88}/>
        <line x1={flip?16:28} y1={40} x2={flip?20:24} y2={46} stroke={color} strokeWidth={3} strokeLinecap="round"/>
        <circle cx={22} cy={9} r={9} fill={color} opacity={0.95}/>
        <line x1={22} y1={18} x2={22} y2={48} stroke={color} strokeWidth={3.2} strokeLinecap="round"/>
        <line x1={22} y1={29} x2={flip?16:28} y2={42} stroke={color} strokeWidth={2.8} strokeLinecap="round"/>
        <line x1={22} y1={29} x2={flip?30:14} y2={24} stroke={color} strokeWidth={2.2} strokeLinecap="round"/>
        <line x1={22} y1={48} x2={14} y2={66} stroke={color} strokeWidth={3} strokeLinecap="round"/>
        <line x1={22} y1={48} x2={30} y2={66} stroke={color} strokeWidth={3} strokeLinecap="round"/>
        {serving&&<circle cx={flip?4:40} cy={22} r={4.5} fill="#fff" opacity={0.9}/>}
      </svg>
      <div style={{color,fontSize:12,fontWeight:700,textAlign:"center",
        maxWidth:58,lineHeight:1.2,textShadow:`0 0 8px ${color}44`}}>{name}</div>
    </div>
  );
}

function TableSVG() {
  return (
    <svg viewBox="0 0 210 80" width="100%" style={{display:"block",maxWidth:210,margin:"0 auto"}}>
      <rect x={5} y={18} width={200} height={44} rx={9}
        fill="rgba(0,120,80,0.18)" stroke="rgba(0,220,150,0.45)" strokeWidth={2}/>
      <line x1={105} y1={18} x2={105} y2={62} stroke="rgba(255,255,255,0.13)" strokeWidth={1} strokeDasharray="4,3"/>
      <rect x={101} y={11} width={8} height={57} rx={3} fill="rgba(255,255,255,0.15)"/>
      <rect x={99} y={9} width={12} height={4} rx={2} fill="rgba(255,255,255,0.35)"/>
      <line x1={22} y1={62} x2={16} y2={76} stroke="rgba(0,180,120,0.4)" strokeWidth={2.5}/>
      <line x1={188} y1={62} x2={194} y2={76} stroke="rgba(0,180,120,0.4)" strokeWidth={2.5}/>
    </svg>
  );
}

/* ── FIX #1: 比分從0開始（用number state而非string） ─────── */
function ScoreBox({ val, color, onChange }) {
  return (
    <input type="number" min={0} max={99}
      value={val}
      onChange={e=>{
        const v=e.target.value;
        // 允許空字串（清空時），否則轉成數字
        onChange(v===""?"":Math.max(0,parseInt(v)||0));
      }}
      style={{
        width:60,height:60,background:"rgba(0,0,0,0.45)",
        border:`3px solid ${color}`,borderRadius:14,
        color,fontWeight:900,fontSize:26,textAlign:"center",
        outline:"none",WebkitAppearance:"none",MozAppearance:"textfield",
        boxShadow:`0 0 16px ${color}33,inset 0 0 8px rgba(0,0,0,0.3)`,
        cursor:"text",
      }}
    />
  );
}

/* ── 比分與局歷史顯示 ─────────────────────────────────────── */
function ScoreSection({ gs, onScore, onSet, onToggleBo3 }) {
  const gamesA=(gs?.games||[]).filter(g=>g.winner==="A").length;
  const gamesB=(gs?.games||[]).filter(g=>g.winner==="B").length;
  if(!gs) return null;
  return (
    <>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginTop:16}}>
        <ScoreBox val={gs.scoreA} color={CA} onChange={v=>onScore("a",v)}/>
        <div style={{textAlign:"center"}}>
          <div style={{color:"rgba(255,255,255,0.2)",fontSize:20,lineHeight:1}}>:</div>
          {gs.isBo3&&<div style={{color:"rgba(255,255,255,0.3)",fontSize:11,marginTop:4}}>{gamesA}:{gamesB}</div>}
        </div>
        <ScoreBox val={gs.scoreB} color={CB} onChange={v=>onScore("b",v)}/>
      </div>

      {gs.isBo3&&(gs.games||[]).length>0&&(
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
          {(gs.games||[]).map((g,i)=>(
            <span key={i} style={{
              background:g.winner==="A"?`${CA}1a`:`${CB}1a`,
              border:`1px solid ${g.winner==="A"?CA:CB}55`,
              borderRadius:8,padding:"3px 10px",
              color:g.winner==="A"?CA:CB,fontSize:11,fontWeight:700,
            }}>局{i+1} {g.scoreA}:{g.scoreB}</span>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:14,flexWrap:"wrap"}}>
        <button onClick={onSet} style={S.setBtn(CA)}>
          {gs.isBo3?"記錄本局 →":"記錄比分 ✓"}
        </button>
        <button onClick={onToggleBo3} style={S.ghostBtn}>
          {gs.isBo3?"取消三戰兩勝":"三戰兩勝"}
        </button>
      </div>
    </>
  );
}

/* ── 雙打卡片 ─────────────────────────────────────────────── */
// FIX #5: 發球方永遠站右側(teamB紅色)，接球方站左側(teamA藍色)
// 若teamA發球 → teamA的發球者顯示在右邊位置 → 我們改變顯示順序
function DoublesCard({ table, gs, onScore, onSet, onToggleBo3, onSingleTable }) {
  const {teamA,teamB,tableNo}=table;
  const sv=gs?.serverInfo;
  const aServes=sv?.servingTeamSide==="A";

  // WTT規則：發球者站右側桌端
  // 所以：若A隊發球，A隊發球員站右，B隊接球員站左
  // 視覺上：左=接球方，右=發球方
  const rightTeam  = aServes ? teamA : teamB;   // 發球方→右
  const leftTeam   = aServes ? teamB : teamA;   // 接球方→左
  const rightColor = aServes ? CA : CB;
  const leftColor  = aServes ? CB : CA;
  const serverIdx  = sv?.serverIdx??0;
  const receiverIdx= sv?.receiverIdx??0;

  return (
    <div style={S.tableCard(CA)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={S.tLabel(CA)}>桌 {tableNo}　雙打</div>
        {/* FIX #7: 單桌換人按鈕 */}
        {onSingleTable&&(
          <button onClick={onSingleTable} style={{...S.ghostBtn,fontSize:11,padding:"5px 10px"}}>
            此桌換組 ↻
          </button>
        )}
      </div>

      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6}}>
        {/* 左側：接球方 */}
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          {leftTeam.map((p,i)=>(
            <PlayerFig key={p.id} color={leftColor} size={40} name={p.name}
              serving={false} flip={false}/>
          ))}
        </div>

        {/* 桌子 */}
        <div style={{flex:1,minWidth:0}}>
          <TableSVG/>
          {sv&&(
            <div style={{color:"rgba(255,255,255,0.28)",fontSize:10,textAlign:"center",marginTop:4}}>
              {aServes
                ?`${teamA[serverIdx]?.name} 發球 → 接：${teamB[receiverIdx]?.name}`
                :`${teamB[serverIdx]?.name} 發球 → 接：${teamA[receiverIdx]?.name}`}
            </div>
          )}
        </div>

        {/* 右側：發球方 */}
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          {rightTeam.map((p,i)=>(
            <PlayerFig key={p.id} color={rightColor} size={40} name={p.name}
              serving={i===serverIdx} flip={true}/>
          ))}
        </div>
      </div>

      <ScoreSection gs={gs} onScore={onScore} onSet={onSet} onToggleBo3={onToggleBo3}/>
    </div>
  );
}

/* ── 單打卡片 ─────────────────────────────────────────────── */
// FIX #5: 發球者也站右側
function SinglesCard({ table, gs, onScore, onSet, onToggleBo3 }) {
  const {teamA,teamB,tableNo,waiting=[]}=table;
  const sv=gs?.serverInfo;
  const aServes=sv?.servingTeamSide==="A";

  const rightPlayer = aServes ? teamA[0] : teamB[0];
  const leftPlayer  = aServes ? teamB[0] : teamA[0];
  const rightColor  = aServes ? CA : CB;
  const leftColor   = aServes ? CB : CA;

  return (
    <div style={S.tableCard(CA)}>
      <div style={S.tLabel(CA)}>桌 {tableNo}　單打</div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6}}>
        <PlayerFig color={leftColor} size={40} name={leftPlayer.name} serving={false} flip={false}/>
        <div style={{flex:1,minWidth:0}}>
          <TableSVG/>
          {sv&&(
            <div style={{color:"rgba(255,255,255,0.28)",fontSize:10,textAlign:"center",marginTop:4}}>
              {rightPlayer.name} 發球
            </div>
          )}
        </div>
        <PlayerFig color={rightColor} size={40} name={rightPlayer.name} serving={true} flip={true}/>
      </div>

      {waiting.length>0&&(
        <div style={{color:"rgba(255,209,102,0.6)",fontSize:12,textAlign:"center",marginTop:10}}>
          候場：{waiting.map(p=>p.name).join("、")}
        </div>
      )}

      <ScoreSection gs={gs} onScore={onScore} onSet={onSet} onToggleBo3={onToggleBo3}/>
    </div>
  );
}

/* ── 擂台卡片（7人模式，FIX #6 加比分） ──────────────────── */
function ArenaCard({ table, gs, onScore, onSet, onToggleBo3 }) {
  const {singles, tableNo} = table;

  // FIX #6: 7人擂台模式也有比分
  // 顯示3個人，說明是擂台制
  return (
    <div style={S.sideCard}>
      <div style={S.tLabel("#ffd166")}>桌 {tableNo}　擂台</div>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:6,marginBottom:4}}>
        {singles.map((p,i)=>(
          <PlayerFig key={p.id} color={i===2?"rgba(255,209,102,0.4)":"#ffd166"} size={34} name={p.name}/>
        ))}
      </div>
      {singles.length===3&&(
        <div style={{color:"rgba(255,209,102,0.4)",fontSize:10,textAlign:"center",marginBottom:8}}>
          贏者留場，輸者換候場者
        </div>
      )}
      {/* 顯示目前上場的兩人 */}
      {gs&&(
        <ScoreSection gs={gs} onScore={onScore} onSet={onSet} onToggleBo3={onToggleBo3}/>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   主 App
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  const [page,setPage]    = useState("home");
  const [members,setMems] = useState(ROSTER);
  const [guest,setGuest]  = useState({name:""});
  const [hist,setHist]    = useState({partners:new Map(),matches:new Map()});
  const [rounds,setRounds]= useState([]);
  const [cur,setCur]      = useState(null);
  const [roundIdx,setRIdx]= useState(0);
  const [smallMode,setSM] = useState(null);
  const [smallCall,setSC] = useState(0);

  const activePlayers = useMemo(()=>{
    const base=members.filter(m=>m.active);
    const gn=guest.name.trim();
    if(gn) base.push({id:"guest",name:gn,_v:6.0,active:true});
    return base;
  },[members,guest]);

  const n=activePlayers.length;
  const isSmall=n<=5;

  /* ── initGS: 分數從0開始（FIX #1） ──────────────────────── */
  function initGS(table) {
    if(table.isSingles&&!table.isArena) {
      // 純擂台（7人）—— 也給gs讓它可以記分
      if(table.singles&&table.singles.length>=2){
        const fakeA=[table.singles[0]],fakeB=[table.singles[1]];
        const sv=initServer(fakeA,fakeB);
        return {scoreA:0,scoreB:0,games:[],isBo3:false,serverInfo:sv,arenaPlayers:table.singles};
      }
      return null;
    }
    if(!table.teamA||!table.teamB) return null;
    const sv=initServer(table.teamA,table.teamB);
    return {scoreA:0,scoreB:0,games:[],isBo3:false,serverInfo:sv};
  }

  /* ── handleScore: 支援數字型分數 ────────────────────────── */
  const handleScore=(tableNo,side,val)=>{
    const key=side==="a"?"scoreA":"scoreB";
    setCur(c=>({...c,gs:{...c.gs,[tableNo]:{...c.gs[tableNo],[key]:val}}}));
  };

  /* ── handleSet: val可以是0（FIX #1） ────────────────────── */
  const handleSet=(tableNo)=>{
    setCur(c=>{
      const gs=c.gs[tableNo];
      const a=gs.scoreA===""||(typeof gs.scoreA==="string"&&gs.scoreA.trim()==="")?null:Number(gs.scoreA);
      const b=gs.scoreB===""||(typeof gs.scoreB==="string"&&gs.scoreB.trim()==="")?null:Number(gs.scoreB);
      if(a===null||b===null||isNaN(a)||isNaN(b)) return c;
      const winner=a>b?"A":b>a?"B":"";
      const games=[...(gs.games||[]),{scoreA:a,scoreB:b,winner}];
      const wA=games.filter(g=>g.winner==="A").length;
      const wB=games.filter(g=>g.winner==="B").length;
      const done=!gs.isBo3||wA>=2||wB>=2;

      let sv=gs.serverInfo;
      if(gs.isBo3&&sv&&!done){
        const table=c.tables.find(t=>t.tableNo===tableNo);
        const aLen=table?.teamA?.length||1, bLen=table?.teamB?.length||1;
        sv=rotateSvForNewGame(sv,aLen,bLen);
      }

      return {...c,gs:{...c.gs,[tableNo]:{
        ...gs,scoreA:0,scoreB:0,games,serverInfo:sv,
        ...(done?{finished:true,finalGames:games}:{}),
      }}};
    });
  };

  const toggleBo3=(tableNo)=>{
    setCur(c=>({...c,gs:{...c.gs,[tableNo]:{...c.gs[tableNo],isBo3:!c.gs[tableNo].isBo3,games:[]}}}));
  };

  /* ── 下一場 ─────────────────────────────────────────────── */
  const nextRound=useCallback((overrideHist)=>{
    let h=overrideHist||hist, r=rounds;
    if(cur&&!overrideHist){
      r=[...rounds,cur];
      h=bumpHist(hist,cur.tables);
      setRounds(r);
      setHist(h);
    }
    let tables;
    if(isSmall){
      tables=makeSmallRound(activePlayers,smallMode||"singles",smallCall);
      setSC(c=>c+1);
    } else {
      tables=makeRound(activePlayers,h,roundIdx);
    }
    if(!tables) return;
    const gs={};
    tables.forEach(t=>{gs[t.tableNo]=initGS(t);});
    setCur({tables,gs});
    setRIdx(i=>i+1);
  },[activePlayers,hist,rounds,cur,roundIdx,isSmall,smallMode,smallCall]);

  /* ── FIX #7: 單桌換人（8人以上，某桌打完先換） ──────────── */
  const singleTableNext=(tableNo)=>{
    if(!cur) return;
    // 找這張桌子的4人
    const thisTable=cur.tables.find(t=>t.tableNo===tableNo);
    if(!thisTable||thisTable.isSingles||thisTable.isSingle1v1) return;
    const tablePlayers=[...thisTable.teamA,...thisTable.teamB];

    // 先把這張桌子的比分存入歷史
    const savedRound={tables:[thisTable],gs:{[tableNo]:cur.gs[tableNo]}};
    const newHist=bumpHist(hist,[thisTable]);
    setHist(newHist);
    // 加入rounds記錄
    setRounds(r=>[...r,savedRound]);

    // 為這4人生成新對戰組合（排除剛才的）
    const phase=roundIdx<6?1:2;
    const newMatch=_bestDoubles(tablePlayers,newHist,phase);
    if(!newMatch) return;

    const newTable={...newMatch,tableNo};
    const newGs=initGS(newTable);

    // 更新cur：只換這張桌子
    setCur(c=>({
      ...c,
      tables:c.tables.map(t=>t.tableNo===tableNo?newTable:t),
      gs:{...c.gs,[tableNo]:newGs},
    }));
  };

  const start=useCallback((mode)=>{
    setSM(mode||null); setSC(0);
    setPage("match");
    setTimeout(()=>{
      let tables;
      if(isSmall||n<=5){
        tables=makeSmallRound(activePlayers,mode||"singles",0);
        setSC(1);
      } else {
        tables=makeRound(activePlayers,{partners:new Map(),matches:new Map()},0);
      }
      if(!tables) return;
      const gs={};
      tables.forEach(t=>{gs[t.tableNo]=initGS(t);});
      setCur({tables,gs});
      setRIdx(1);
    },0);
  },[activePlayers,isSmall,n]);

  const handleEnd=()=>{
    if(cur){setRounds(r=>[...r,cur]);setCur(null);}
    setPage("end");
  };

  /* ── 勝率統計 ─────────────────────────────────────────────── */
  const stats=useMemo(()=>{
    const all=[...rounds,...(cur?[cur]:[])];
    const map={};
    for(const rd of all){
      for(const t of rd.tables){
        if(t.isSingles&&!rd.gs?.[t.tableNo]) continue;
        const gs=rd.gs?.[t.tableNo];
        if(!gs) continue;
        const games=gs.finalGames||gs.games||[];
        const allP=[...(t.teamA||[]),...(t.teamB||[])];
        allP.forEach(p=>{if(!map[p.id])map[p.id]={name:p.name,wins:0,games:0};});
        if(games.length>0){
          const wA=games.filter(g=>g.winner==="A").length,wB=games.filter(g=>g.winner==="B").length;
          if(wA||wB){
            const wt=wA>wB?"A":wB>wA?"B":null;
            (t.teamA||[]).forEach(p=>{map[p.id].games++;if(wt==="A")map[p.id].wins++;});
            (t.teamB||[]).forEach(p=>{map[p.id].games++;if(wt==="B")map[p.id].wins++;});
          }
        } else {
          const a=Number(gs.scoreA),b=Number(gs.scoreB);
          if(!isNaN(a)&&!isNaN(b)&&gs.scoreA!==""&&gs.scoreB!==""){
            const wt=a>b?"A":b>a?"B":null;
            (t.teamA||[]).forEach(p=>{map[p.id].games++;if(wt==="A")map[p.id].wins++;});
            (t.teamB||[]).forEach(p=>{map[p.id].games++;if(wt==="B")map[p.id].wins++;});
          }
        }
      }
    }
    return Object.values(map).filter(s=>s.games>0)
      .map(s=>({...s,rate:Math.round(s.wins/s.games*100)}))
      .sort((a,b)=>b.rate-a.rate||b.wins-a.wins);
  },[rounds,cur]);

  /* ── 渲染球桌 ────────────────────────────────────────────── */
  const renderTable=(t)=>{
    if(!cur) return null;
    const gs=cur.gs[t.tableNo];

    // FIX #6: 7人擂台桌
    if(t.isSingles){
      return <ArenaCard key={t.tableNo} table={t} gs={gs}
        onScore={(side,v)=>handleScore(t.tableNo,side,v)}
        onSet={()=>handleSet(t.tableNo)}
        onToggleBo3={()=>toggleBo3(t.tableNo)}/>;
    }
    if(t.isSingle1v1){
      return <SinglesCard key={t.tableNo} table={t} gs={gs}
        onScore={(side,v)=>handleScore(t.tableNo,side,v)}
        onSet={()=>handleSet(t.tableNo)}
        onToggleBo3={()=>toggleBo3(t.tableNo)}/>;
    }
    // FIX #7: 8人以上才有單桌換組按鈕
    const canSingleSwap = n>=8;
    return <DoublesCard key={t.tableNo} table={t} gs={gs}
      onScore={(side,v)=>handleScore(t.tableNo,side,v)}
      onSet={()=>handleSet(t.tableNo)}
      onToggleBo3={()=>toggleBo3(t.tableNo)}
      onSingleTable={canSingleSwap?()=>singleTableNext(t.tableNo):null}/>;
  };

  /* ── 渲染紀錄 ────────────────────────────────────────────── */
  const renderHistoryTable=(t, gs)=>{
    if(t.isSingles){
      const hasGs=gs&&(gs.finalGames||gs.games||[]).length>0;
      const games=gs?.finalGames||gs?.games||[];
      const wA=games.filter(g=>g.winner==="A").length;
      const wB=games.filter(g=>g.winner==="B").length;
      // 7人擂台：顯示比分
      if(hasGs&&t.singles){
        const aName=t.singles[0]?.name||"";
        const bName=t.singles[1]?.name||"";
        return (
          <div key={t.tableNo} style={{marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{color:"rgba(255,255,255,0.25)",fontSize:11}}>桌{t.tableNo}（擂台）</span>
              <span style={{color:wA>wB?CA:"rgba(62,207,255,0.45)",fontWeight:wA>wB?700:400,fontSize:13}}>{aName}</span>
              <span style={{color:"rgba(255,255,255,0.22)",fontSize:12}}>{`(${wA}:${wB})`}</span>
              <span style={{color:wB>wA?CB:"rgba(255,107,107,0.45)",fontWeight:wB>wA?700:400,fontSize:13}}>{bName}</span>
            </div>
            {games.length>0&&(
              <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap",paddingLeft:32}}>
                {games.map((g,i)=>(
                  <span key={i} style={{background:g.winner==="A"?`${CA}18`:`${CB}18`,
                    border:`1px solid ${g.winner==="A"?CA:CB}44`,
                    borderRadius:7,padding:"2px 9px",
                    color:g.winner==="A"?CA:CB,fontSize:11,fontWeight:700}}>
                    局{i+1} {g.scoreA}:{g.scoreB}</span>
                ))}
              </div>
            )}
          </div>
        );
      }
      return <div key={t.tableNo} style={{color:"#ffd166",fontSize:13,marginBottom:4}}>
        桌{t.tableNo}（擂台）：{t.singles?.map(p=>p.name).join(" / ")}</div>;
    }

    const games=gs?.finalGames||gs?.games||[];
    const hasG=games.length>0;
    const wA=games.filter(g=>g.winner==="A").length;
    const wB=games.filter(g=>g.winner==="B").length;
    const sA=gs?.scoreA, sB=gs?.scoreB;
    const hasSc=!hasG&&sA!==undefined&&sA!==""&&sB!==undefined&&sB!=="";
    const aName=(t.teamA||[]).map(p=>p.name).join("+");
    const bName=(t.teamB||[]).map(p=>p.name).join("+");
    const aWin=hasG?wA>wB:hasSc&&Number(sA)>Number(sB);
    const bWin=hasG?wB>wA:hasSc&&Number(sB)>Number(sA);
    return (
      <div key={t.tableNo} style={{marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{color:"rgba(255,255,255,0.25)",fontSize:11}}>桌{t.tableNo}</span>
          <span style={{color:aWin?CA:"rgba(62,207,255,0.45)",fontWeight:aWin?700:400,fontSize:13}}>{aName}</span>
          <span style={{color:"rgba(255,255,255,0.22)",fontSize:12}}>
            {hasG?`(${wA}:${wB})`:hasSc?`${sA}:${sB}`:"vs"}
          </span>
          <span style={{color:bWin?CB:"rgba(255,107,107,0.45)",fontWeight:bWin?700:400,fontSize:13}}>{bName}</span>
        </div>
        {hasG&&(
          <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap",paddingLeft:32}}>
            {games.map((g,i)=>(
              <span key={i} style={{background:g.winner==="A"?`${CA}18`:`${CB}18`,
                border:`1px solid ${g.winner==="A"?CA:CB}44`,
                borderRadius:7,padding:"2px 9px",
                color:g.winner==="A"?CA:CB,fontSize:11,fontWeight:700}}>
                局{i+1} {g.scoreA}:{g.scoreB}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── 渲染主體 ────────────────────────────────────────────── */
  return (
    <div style={S.root}>
      <div style={S.bgMesh}/>
      <header style={S.header}>
        <div style={S.logo} onClick={()=>setPage("home")}>
          <span style={{fontSize:24}}>🏓</span>
          <span style={{color:CA,fontWeight:900,letterSpacing:1.5,fontSize:16}}>乒乓分組器</span>
        </div>
        <nav style={{display:"flex",gap:6}}>
          {[["home","首頁"],["match","出賽"],["history","紀錄"]].map(([p,l])=>(
            <button key={p} onClick={()=>setPage(p)} style={S.navBtn(page===p)}>{l}</button>
          ))}
          {(rounds.length>0||cur)&&(
            <button onClick={handleEnd} style={{...S.navBtn(page==="end"),color:"#ff8a80",borderColor:"rgba(255,100,80,0.35)"}}>結算</button>
          )}
        </nav>
      </header>

      <main style={S.main}>

        {/* ── 首頁 ── */}
        {page==="home"&&(
          <div style={{maxWidth:520,margin:"0 auto"}}>
            <h2 style={S.h2}>出席名單</h2>
            <div style={{display:"flex",flexWrap:"wrap",gap:9,marginBottom:22}}>
              {members.map(m=>(
                <button key={m.id}
                  onClick={()=>setMems(ms=>ms.map(x=>x.id===m.id?{...x,active:!x.active}:x))}
                  style={S.chip(m.active)}>{m.active?"✓ ":""}{m.name}</button>
              ))}
            </div>

            <h2 style={S.h2}>臨打</h2>
            <div style={{display:"flex",gap:10,marginBottom:24}}>
              <input placeholder="臨打姓名（選填）" value={guest.name}
                onChange={e=>setGuest({name:e.target.value})}
                style={{...S.input,flex:1}}/>
            </div>

            <div style={S.infoBox}>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>今晚出席：</span>
              <span style={{color:CA,fontWeight:800,fontSize:16}}>{n}</span>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}> 人　|　</span>
              <span style={{color:"#ffd166",fontSize:13}}>
                {n>=8?"兩桌雙打":n===7?"雙打＋擂台":n===6?"雙打＋單打":
                 n===5?"5人模式":n===4?"4人模式":n>=2?"單打擂台":"人數不足"}
              </span>
            </div>

            {n>=6&&(
              <button onClick={()=>start(null)} style={S.primaryBtn(true)}>開始分組 🏓</button>
            )}
            {n===5&&(
              <div style={{display:"flex",gap:10,marginTop:10}}>
                <button onClick={()=>start("doubles")} style={{...S.primaryBtn(true),flex:1}}>雙打模式</button>
                <button onClick={()=>start("singles")} style={{...S.primaryBtn(true),flex:1,borderColor:"rgba(255,209,102,0.45)",color:"#ffd166"}}>單打模式</button>
              </div>
            )}
            {n===4&&(
              <div style={{display:"flex",gap:10,marginTop:10}}>
                <button onClick={()=>start("doubles")} style={{...S.primaryBtn(true),flex:1}}>雙打模式</button>
                <button onClick={()=>start("singles")} style={{...S.primaryBtn(true),flex:1,borderColor:"rgba(255,209,102,0.45)",color:"#ffd166"}}>單打模式</button>
              </div>
            )}
            {n>=2&&n<=3&&(
              <button onClick={()=>start("singles")} style={S.primaryBtn(true)}>開始擂台 🏓</button>
            )}
            {n<2&&<div style={{color:"rgba(255,255,255,0.22)",fontSize:13,marginTop:12}}>至少需要 2 位出席者</div>}
          </div>
        )}

        {/* ── 出賽頁 ── */}
        {page==="match"&&(
          <div style={{maxWidth:900,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
              <h2 style={{...S.h2,margin:0}}>第 {roundIdx} 場</h2>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>nextRound()} style={S.primaryBtn(true)}>下一場 →</button>
                <button onClick={handleEnd} style={{...S.primaryBtn(true),color:"#ff8a80",borderColor:"rgba(255,100,80,0.4)"}}>結束今日</button>
              </div>
            </div>
            {cur
              ?<div style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center"}}>
                {cur.tables.map(t=>renderTable(t))}
               </div>
              :<div style={{color:"rgba(255,255,255,0.25)",textAlign:"center",marginTop:40}}>請先到首頁設定出席名單</div>
            }
          </div>
        )}

        {/* ── 紀錄頁 ── */}
        {page==="history"&&(
          <div style={{maxWidth:680,margin:"0 auto"}}>
            <h2 style={S.h2}>今日紀錄</h2>
            {!rounds.length&&<div style={{color:"rgba(255,255,255,0.25)",textAlign:"center",marginTop:40}}>尚無紀錄</div>}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {rounds.map((rd,ri)=>(
                <div key={ri} style={S.card}>
                  <div style={{color:"rgba(62,207,255,0.5)",fontWeight:700,fontSize:12,marginBottom:8}}>第 {ri+1} 場</div>
                  {rd.tables.map(t=>renderHistoryTable(t, rd.gs?.[t.tableNo]))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 結算頁 ── */}
        {page==="end"&&(
          <div style={{maxWidth:440,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:6}}>🏆</div>
            <h2 style={{...S.h2,textAlign:"center"}}>今日結算</h2>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:13,marginBottom:20}}>
              共打 {rounds.reduce((s,r)=>s+r.tables.filter(t=>!t.isSingles||r.gs?.[t.tableNo]).length,0)} 場
            </div>
            {!stats.length
              ?<div style={{color:"rgba(255,255,255,0.22)"}}>沒有有效比分紀錄</div>
              :<div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:28}}>
                {stats.map((s,i)=>(
                  <div key={s.name} style={{...S.card,display:"flex",alignItems:"center",gap:14,
                    background:i===0?"rgba(255,209,102,0.08)":"rgba(255,255,255,0.03)",
                    borderColor:i===0?"rgba(255,209,102,0.3)":"rgba(255,255,255,0.07)"}}>
                    <span style={{fontSize:22,minWidth:28}}>{["🥇","🥈","🥉"][i]||`#${i+1}`}</span>
                    <span style={{flex:1,fontWeight:i===0?800:500,color:i===0?"#ffd166":"rgba(255,255,255,0.8)",fontSize:15,textAlign:"left"}}>{s.name}</span>
                    <span style={{color:CA,fontWeight:800,fontSize:16}}>{s.rate}%</span>
                    <span style={{color:"rgba(255,255,255,0.28)",fontSize:12}}>{s.wins}勝/{s.games}場</span>
                  </div>
                ))}
               </div>
            }
            <button onClick={()=>{
              setRounds([]);setCur(null);setRIdx(0);
              setHist({partners:new Map(),matches:new Map()});
              setSC(0);setPage("home");
            }} style={S.primaryBtn(true)}>🔄 開始新的一晚</button>
          </div>
        )}

      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   樣式
   ═══════════════════════════════════════════════════════════ */
const S={
  root:{minHeight:"100vh",background:"#070c17",color:"#dce4f0",
    fontFamily:"'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif",
    position:"relative",overflow:"hidden"},
  bgMesh:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
    background:"radial-gradient(ellipse at 18% 22%, rgba(0,140,220,0.09) 0%,transparent 55%), radial-gradient(ellipse at 82% 78%, rgba(0,80,180,0.07) 0%,transparent 55%)"},
  header:{position:"sticky",top:0,zIndex:100,
    background:"rgba(7,12,23,0.95)",backdropFilter:"blur(14px)",
    borderBottom:"1px solid rgba(62,207,255,0.09)",
    display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 18px"},
  logo:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"},
  main:{position:"relative",zIndex:1,padding:"24px 14px 70px"},
  navBtn:(a)=>({
    background:a?"rgba(62,207,255,0.10)":"transparent",
    border:`1px solid ${a?"rgba(62,207,255,0.35)":"rgba(255,255,255,0.08)"}`,
    color:a?CA:"rgba(255,255,255,0.4)",
    borderRadius:8,padding:"5px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}),
  h2:{color:"#dce4f0",fontWeight:800,fontSize:18,marginBottom:14,letterSpacing:0.3},
  chip:(a)=>({
    background:a?"rgba(62,207,255,0.10)":"rgba(255,255,255,0.03)",
    border:`1.5px solid ${a?"rgba(62,207,255,0.42)":"rgba(255,255,255,0.08)"}`,
    color:a?CA:"rgba(255,255,255,0.28)",
    borderRadius:20,padding:"6px 16px",fontSize:14,fontWeight:700,cursor:"pointer"}),
  input:{background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.10)",
    borderRadius:10,padding:"9px 13px",color:"#dce4f0",fontSize:14,outline:"none"},
  infoBox:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:12,padding:"11px 18px",marginBottom:16,
    display:"inline-flex",alignItems:"center",gap:3,flexWrap:"wrap"},
  primaryBtn:(on)=>({
    background:on?"rgba(62,207,255,0.12)":"rgba(255,255,255,0.03)",
    border:`1.5px solid ${on?"rgba(62,207,255,0.42)":"rgba(255,255,255,0.08)"}`,
    color:on?CA:"rgba(255,255,255,0.18)",
    borderRadius:12,padding:"11px 24px",fontSize:14,fontWeight:800,
    cursor:on?"pointer":"not-allowed",letterSpacing:0.4,display:"inline-block"}),
  tableCard:(c)=>({
    background:"rgba(0,0,0,0.30)",border:`1.5px solid ${c}1e`,
    borderRadius:22,padding:"18px 16px",minWidth:300,flex:1,maxWidth:430}),
  tLabel:(c)=>({color:c,fontWeight:700,fontSize:11,letterSpacing:2.2,marginBottom:0,opacity:0.75}),
  sideCard:{background:"rgba(255,209,102,0.05)",border:"1.5px solid rgba(255,209,102,0.2)",
    borderRadius:22,padding:"18px 16px",minWidth:260},
  card:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:14,padding:"14px 18px"},
  setBtn:(c)=>({background:`${c}1a`,border:`1.5px solid ${c}55`,color:c,
    borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:800,cursor:"pointer"}),
  ghostBtn:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",
    color:"rgba(255,255,255,0.38)",borderRadius:10,padding:"9px 14px",fontSize:12,cursor:"pointer"},
};
