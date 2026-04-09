import { useState, useCallback, useMemo, useRef } from "react";
import { saveSession } from "./firebase";

/* ═══════════════════════════════════════════════════════════
   成員名單（#3: 所有人起始分數相同，用5.0）
   ═══════════════════════════════════════════════════════════ */
const BASE_V = 5.0; // 所有人平等起跑
const ROSTER = [
  { id:"alan",    name:"Alan",  _v:BASE_V, active:true },
  { id:"jimmy",   name:"Jimmy", _v:BASE_V, active:true },
  { id:"curly",   name:"捲毛",  _v:BASE_V, active:true },
  { id:"peiyun",  name:"珮芸",  _v:BASE_V, active:true },
  { id:"siu",     name:"修哥",  _v:BASE_V, active:true },
  { id:"wenzhu",  name:"雯筑",  _v:BASE_V, active:true },
  { id:"yinxuan", name:"音旋",  _v:BASE_V, active:true },
];

const CA = "#3ecfff", CB = "#ff6b6b";

/* ── 動態積分（#3: 依當日結果調整，起始分相同）──────────── */
// 調整幅度：maxAdj=0.4，分差比例影響 scoreWeight=0.6
function calcDynaDelta(rounds) {
  const delta = {};
  for(const rd of rounds) {
    for(const t of rd.tables) {
      if(t.isSingles||t.isSingle1v1) continue;
      const gs = rd.gs?.[t.tableNo];
      if(!gs) continue;
      const games = gs.finalGames||gs.games||[];
      for(const g of games) {
        // #2: 0:0 不計入
        if(!g.winner || g.winner==="" || (g.scoreA===0&&g.scoreB===0)) continue;
        const total = g.scoreA + g.scoreB;
        const diff  = Math.abs(g.scoreA - g.scoreB);
        const diffRatio = Math.min(diff / Math.max(total*0.5,1), 1);
        const adj = 0.4 * (0.6*diffRatio + 0.4);
        const winners = g.winner==="A" ? t.teamA : t.teamB;
        const losers  = g.winner==="A" ? t.teamB : t.teamA;
        winners.forEach(p=>{ delta[p.id]=(delta[p.id]||0)+adj; });
        losers.forEach(p=>{  delta[p.id]=(delta[p.id]||0)-adj; });
      }
    }
  }
  return delta;
}

function applyDelta(players, delta) {
  return players.map(p=>({...p, _v:Math.max(0,Math.min(12,p._v+(delta[p.id]||0)))}));
}

/* ── #2: 比賽是否有效（有非0:0分數）──────────────────────── */
function hasValidScore(gs) {
  if(!gs) return false;
  const games = gs.finalGames||gs.games||[];
  if(games.length>0) return games.some(g=>g.scoreA>0||g.scoreB>0);
  return Number(gs.scoreA)>0 || Number(gs.scoreB)>0;
}

/* ── 組合評分 ─────────────────────────────────────────────── */
function _rank(tA, tB, hist, phase) {
  const gap = Math.abs(tA.reduce((s,p)=>s+p._v,0) - tB.reduce((s,p)=>s+p._v,0));
  const balPen = phase===1 ? gap*2.5 : gap*1;
  const pkA = [...tA.map(p=>p.id)].sort().join("-");
  const pkB = [...tB.map(p=>p.id)].sort().join("-");
  const mk  = [pkA,pkB].sort().join("|");
  const rep = (hist.partners.get(pkA)||0)+(hist.partners.get(pkB)||0)+(hist.matches.get(mk)||0)*2;
  return -(balPen + rep*4);
}

// 改用普通遞迴，回傳陣列（避免 generator 在 artifact 環境的相容性問題）
function _combs(arr, k) {
  if(k===0) return [[]];
  if(arr.length<k) return [];
  const result=[];
  for(let i=0;i<=arr.length-k;i++){
    for(const rest of _combs(arr.slice(i+1),k-1)){
      result.push([arr[i],...rest]);
    }
  }
  return result;
}

function _bestDoubles(players, hist, phase) {
  if(players.length<4) return null;
  let candidates=[], top=-Infinity;
  for(let a=0;a<players.length-1;a++)
    for(let b=a+1;b<players.length;b++){
      const tA=[players[a],players[b]];
      const rest=players.filter((_,i)=>i!==a&&i!==b);
      for(let c=0;c<rest.length-1;c++)
        for(let d=c+1;d<rest.length;d++){
          const tB=[rest[c],rest[d]];
          const sc=_rank(tA,tB,hist,phase);
          if(sc>top+0.01){top=sc;candidates=[{teamA:tA,teamB:tB}];}
          else if(sc>top-0.5){candidates.push({teamA:tA,teamB:tB});}
        }
    }
  if(!candidates.length) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

/* ── makeRound: 6/7人加入單打輪換懲罰（#1）──────────────── */
function makeRound(active, hist, idx, lastSingleIds=[]) {
  const phase=idx<6?1:2, n=active.length;

  if(n>=8){
    let candidates=[], top=-Infinity;
    for(const c4 of _combs(active,4)){
      const rem=active.filter(p=>!c4.includes(p));
      if(rem.length<4) continue;
      const m1=_bestDoubles(c4,hist,phase);
      const m2=_bestDoubles(rem.slice(0,4),hist,phase);
      if(!m1||!m2) continue;
      const t=_rank(m1.teamA,m1.teamB,hist,phase)+_rank(m2.teamA,m2.teamB,hist,phase);
      if(t>top+0.01){top=t;candidates=[{b1:{...m1,tableNo:1},b2:{...m2,tableNo:2}}];}
      else if(t>top-0.5){candidates.push({b1:{...m1,tableNo:1},b2:{...m2,tableNo:2}});}
    }
    if(!candidates.length) return null;
    const pick=candidates[Math.floor(Math.random()*candidates.length)];
    return [pick.b1, pick.b2];
  }

  if(n===7||n===6){
    let candidates=[], top=-Infinity;
    for(const c4 of _combs(active,4)){
      const m=_bestDoubles(c4,hist,phase);
      if(!m) continue;
      let sc=_rank(m.teamA,m.teamB,hist,phase);

      // #1: 單打輪換 — 若上場單打的兩人都還在單打側，大力懲罰
      const singles=active.filter(p=>!c4.map(x=>x.id).includes(p.id));
      const singleIds=singles.map(p=>p.id);
      const bothStillSingle=lastSingleIds.length>=2 &&
        lastSingleIds.every(id=>singleIds.includes(id));
      if(bothStillSingle) sc-=10; // 重罰：連續兩場同一對

      // 優先讓上場單打的人進雙打
      const c4ids=c4.map(p=>p.id);
      const rotateBonus=lastSingleIds.filter(id=>c4ids.includes(id)).length*1.5;
      sc+=rotateBonus;

      if(sc>top+0.01){top=sc;candidates=[{match:m,four:c4}];}
      else if(sc>top-0.5){candidates.push({match:m,four:c4});}
    }
    if(!candidates.length) return null;
    const pick=candidates[Math.floor(Math.random()*candidates.length)];
    const singles=active.filter(p=>!pick.four.map(x=>x.id).includes(p.id));
    if(n===6) return [{...pick.match,tableNo:1},{teamA:[singles[0]],teamB:[singles[1]],tableNo:2,isSingle1v1:true}];
    return [{...pick.match,tableNo:1},{singles,tableNo:2,isSingles:true}];
  }
  return null;
}

function makeSmallRound(active, mode, callCount) {
  const n=active.length;
  if(n===5){
    if(mode==="doubles"){
      const sitting=active[callCount%5];
      const others=active.filter(p=>p.id!==sitting.id);
      const combos=[[[others[0],others[1]],[others[2],others[3]]],[[others[0],others[2]],[others[1],others[3]]],[[others[0],others[3]],[others[1],others[2]]]];
      const pick=combos[callCount%3];
      return [{teamA:pick[0],teamB:pick[1],tableNo:1,waiting:[sitting]}];
    } else {
      const sitting=active[callCount%5];
      const others=active.filter(p=>p.id!==sitting.id);
      return [{teamA:[others[0]],teamB:[others[1]],tableNo:1,isSingle1v1:true},{teamA:[others[2]],teamB:[others[3]],tableNo:2,isSingle1v1:true,waiting:[sitting]}];
    }
  }
  if(n===4){
    if(mode==="doubles"){
      const combos=[[[active[0],active[1]],[active[2],active[3]]],[[active[0],active[2]],[active[1],active[3]]],[[active[0],active[3]],[active[1],active[2]]]];
      return [{teamA:combos[callCount%3][0],teamB:combos[callCount%3][1],tableNo:1}];
    } else {
      const pairs=[[{teamA:[active[0]],teamB:[active[1]],tableNo:1,isSingle1v1:true},{teamA:[active[2]],teamB:[active[3]],tableNo:2,isSingle1v1:true}],[{teamA:[active[0]],teamB:[active[2]],tableNo:1,isSingle1v1:true},{teamA:[active[1]],teamB:[active[3]],tableNo:2,isSingle1v1:true}],[{teamA:[active[0]],teamB:[active[3]],tableNo:1,isSingle1v1:true},{teamA:[active[1]],teamB:[active[2]],tableNo:2,isSingle1v1:true}]];
      return pairs[callCount%3];
    }
  }
  if(n===3){const sitting=active[callCount%3];const playing=active.filter(p=>p.id!==sitting.id);return [{teamA:[playing[0]],teamB:[playing[1]],tableNo:1,isSingle1v1:true,waiting:[sitting]}];}
  if(n===2) return [{teamA:[active[0]],teamB:[active[1]],tableNo:1,isSingle1v1:true}];
  return null;
}

/* ── #2: bumpHist 只記錄有效比賽 ─────────────────────────── */
function bumpHist(hist, tables, gsMap) {
  const h={partners:new Map(hist.partners),matches:new Map(hist.matches)};
  for(const t of tables){
    if(t.isSingles||t.isSingle1v1) continue;
    // 只有有效比分才記入歷史，避免影響後續分組
    const gs=gsMap?.[t.tableNo];
    if(!hasValidScore(gs)) continue;
    const pkA=[...t.teamA.map(p=>p.id)].sort().join("-");
    const pkB=[...t.teamB.map(p=>p.id)].sort().join("-");
    const mk=[pkA,pkB].sort().join("|");
    h.partners.set(pkA,(h.partners.get(pkA)||0)+1);
    h.partners.set(pkB,(h.partners.get(pkB)||0)+1);
    h.matches.set(mk,(h.matches.get(mk)||0)+1);
  }
  return h;
}

function initGS(table) {
  if(table.isSingles){if(table.singles&&table.singles.length>=2)return{scoreA:0,scoreB:0,games:[]};return null;}
  if(!table.teamA||!table.teamB)return null;
  return{scoreA:0,scoreB:0,games:[]};
}

/* ═══════════════════════════════════════════════════════════
   SVG 小人
   ═══════════════════════════════════════════════════════════ */
function PlayerFig({color=CA,size=44,flip=false,name=""}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
      <svg width={size} height={size*1.8} viewBox="0 0 44 80" style={{display:"block",transform:flip?"scaleX(-1)":"none"}}>
        <ellipse cx={flip?10:34} cy={33} rx={9} ry={11} fill={color} opacity={0.88}/>
        <line x1={flip?16:28} y1={40} x2={flip?20:24} y2={46} stroke={color} strokeWidth={3} strokeLinecap="round"/>
        <circle cx={22} cy={9} r={9} fill={color} opacity={0.95}/>
        <line x1={22} y1={18} x2={22} y2={48} stroke={color} strokeWidth={3.2} strokeLinecap="round"/>
        <line x1={22} y1={29} x2={flip?16:28} y2={42} stroke={color} strokeWidth={2.8} strokeLinecap="round"/>
        <line x1={22} y1={29} x2={flip?30:14} y2={24} stroke={color} strokeWidth={2.2} strokeLinecap="round"/>
        <line x1={22} y1={48} x2={14} y2={66} stroke={color} strokeWidth={3} strokeLinecap="round"/>
        <line x1={22} y1={48} x2={30} y2={66} stroke={color} strokeWidth={3} strokeLinecap="round"/>
      </svg>
      <div style={{color,fontSize:12,fontWeight:700,textAlign:"center",maxWidth:58,lineHeight:1.2}}>{name}</div>
    </div>
  );
}

function TableSVG() {
  return (
    <svg viewBox="0 0 210 80" width="100%" style={{display:"block",maxWidth:210,margin:"0 auto"}}>
      <rect x={5} y={18} width={200} height={44} rx={9} fill="rgba(0,120,80,0.18)" stroke="rgba(0,220,150,0.45)" strokeWidth={2}/>
      <line x1={105} y1={18} x2={105} y2={62} stroke="rgba(255,255,255,0.13)" strokeWidth={1} strokeDasharray="4,3"/>
      <rect x={101} y={11} width={8} height={57} rx={3} fill="rgba(255,255,255,0.15)"/>
      <rect x={99} y={9} width={12} height={4} rx={2} fill="rgba(255,255,255,0.35)"/>
      <line x1={22} y1={62} x2={16} y2={76} stroke="rgba(0,180,120,0.4)" strokeWidth={2.5}/>
      <line x1={188} y1={62} x2={194} y2={76} stroke="rgba(0,180,120,0.4)" strokeWidth={2.5}/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   快選 Modal
   ═══════════════════════════════════════════════════════════ */
const QP_ROWS=[[11,10,9,8,7,6],[5,4,3,2,1,0]];
function QuickPick({color,initial,onConfirm,onClose}) {
  const [sel,setSel]=useState(initial??0);
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.72)",backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"rgba(14,22,40,0.97)",border:`2px solid ${color}55`,borderRadius:24,padding:"28px 24px 20px",width:"min(340px,90vw)",display:"flex",flexDirection:"column",gap:14,boxShadow:`0 0 40px ${color}22`}}>
        <div style={{height:70,background:"rgba(0,0,0,0.5)",border:`3px solid ${color}`,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:900,fontSize:42,boxShadow:`0 0 20px ${color}44`}}>{sel}</div>
        {QP_ROWS.map((row,ri)=>(
          <div key={ri} style={{display:"flex",gap:8}}>
            {row.map(n=>(
              <button key={n} onClick={()=>setSel(n)} style={{flex:1,height:52,borderRadius:12,background:sel===n?`${color}30`:"rgba(255,255,255,0.06)",border:sel===n?`2.5px solid ${color}`:"1.5px solid rgba(255,255,255,0.1)",color:sel===n?color:"rgba(255,255,255,0.6)",fontWeight:800,fontSize:18,cursor:"pointer",transition:"all 0.1s",boxShadow:sel===n?`0 0 12px ${color}44`:"none"}}>{n}</button>
            ))}
          </div>
        ))}
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <button onClick={onClose} style={{flex:1,height:46,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1.5px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)",fontSize:14,cursor:"pointer"}}>取消</button>
          <button onClick={()=>onConfirm(sel)} style={{flex:2,height:46,borderRadius:12,background:`${color}22`,border:`2px solid ${color}88`,color,fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 0 12px ${color}33`}}>確定　{sel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── 分數框 ───────────────────────────────────────────────── */
function ScoreInput({value,color,label,onChange,onLongPress}) {
  const pressTimer=useRef(null);
  const longFired=useRef(false);
  const inputRef=useRef(null);
  const startPress=(e)=>{e.preventDefault();longFired.current=false;pressTimer.current=setTimeout(()=>{longFired.current=true;onLongPress();},260);};
  const endPress=()=>{clearTimeout(pressTimer.current);if(!longFired.current)inputRef.current?.focus();};
  const cancelPress=()=>clearTimeout(pressTimer.current);
  const handleChange=(e)=>{const v=e.target.value.replace(/[^0-9]/g,"");onChange(v===""?0:Math.min(99,parseInt(v)));};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5,minWidth:0,flex:1}}>
      <div style={{color,fontSize:10,fontWeight:700,letterSpacing:1,opacity:0.65,textAlign:"center"}}>{label}</div>
      <div style={{position:"relative"}} onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={cancelPress} onTouchStart={startPress} onTouchEnd={endPress} onTouchMove={cancelPress}>
        <input ref={inputRef} inputMode="numeric" pattern="[0-9]*" value={value===0?"0":String(value)} onChange={handleChange} onFocus={e=>e.target.select()}
          style={{height:64,width:"100%",boxSizing:"border-box",background:"rgba(0,0,0,0.4)",border:`3px solid ${color}`,borderRadius:14,color,fontWeight:900,fontSize:32,textAlign:"center",outline:"none",caretColor:color,WebkitUserSelect:"text"}}/>
      </div>
      <div style={{color:"rgba(255,255,255,0.18)",fontSize:10,textAlign:"center",letterSpacing:0.5}}>點擊輸入　·　長按快選</div>
    </div>
  );
}

function ScoreSection({gs,onScore,onSet}) {
  const [flash,setFlash]=useState(null);
  const [qp,setQp]=useState(null);
  if(!gs) return null;
  const handleSet=()=>{const a=Number(gs.scoreA),b=Number(gs.scoreB);if(isNaN(a)||isNaN(b))return;setFlash(`${a} : ${b}`);setTimeout(()=>setFlash(null),1800);onSet();};
  return (
    <div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:14}}>
      {(gs.games||[]).length>0&&(
        <div style={{display:"flex",gap:5,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
          {(gs.games||[]).map((g,i)=>(
            <span key={i} style={{background:g.winner==="A"?`${CA}18`:`${CB}18`,border:`1px solid ${g.winner==="A"?CA:CB}44`,borderRadius:8,padding:"3px 10px",color:g.winner==="A"?CA:CB,fontSize:12,fontWeight:700}}>局{i+1}　{g.scoreA}:{g.scoreB}</span>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:10,alignItems:"start",marginBottom:14}}>
        <ScoreInput value={gs.scoreA} color={CA} label="左隊得分" onChange={v=>onScore("a",v)} onLongPress={()=>setQp("a")}/>
        <div style={{color:"rgba(255,255,255,0.2)",fontSize:22,paddingTop:22,flexShrink:0}}>:</div>
        <ScoreInput value={gs.scoreB} color={CB} label="右隊得分" onChange={v=>onScore("b",v)} onLongPress={()=>setQp("b")}/>
      </div>
      <button onClick={handleSet} style={{width:"100%",padding:"13px 0",boxSizing:"border-box",background:flash?`${CA}28`:`${CA}12`,border:`2px solid ${flash?CA:`${CA}44`}`,color:CA,borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",transition:"all 0.25s",boxShadow:flash?`0 0 18px ${CA}44`:"none"}}>{flash?`✓ 已記錄　${flash}`:"記錄比分 ✓"}</button>
      {qp&&<QuickPick color={qp==="a"?CA:CB} initial={qp==="a"?gs.scoreA:gs.scoreB} onClose={()=>setQp(null)} onConfirm={v=>{onScore(qp,v);setQp(null);}}/>}
    </div>
  );
}

/* ── #8 手動換人 Modal ────────────────────────────────────── */
function ManualPick({tables,allPlayers,onConfirm,onClose}) {
  // 初始狀態：從當前 tables 讀出 4 個位置
  const doublesTable=tables.find(t=>!t.isSingles&&!t.isSingle1v1);
  const singlesTable=tables.find(t=>t.isSingle1v1||t.isSingles);
  const init={
    a0:doublesTable?.teamA?.[0]?.id||"",
    a1:doublesTable?.teamA?.[1]?.id||"",
    b0:doublesTable?.teamB?.[0]?.id||"",
    b1:doublesTable?.teamB?.[1]?.id||"",
    s0:singlesTable?.teamA?.[0]?.id||singlesTable?.singles?.[0]?.id||"",
    s1:singlesTable?.teamB?.[0]?.id||singlesTable?.singles?.[1]?.id||"",
  };
  const [picks,setPicks]=useState(init);
  const allIds=Object.values(picks);
  const hasDup=new Set(allIds.filter(Boolean)).size<allIds.filter(Boolean).length;

  const sel=(slot,id)=>setPicks(p=>({...p,[slot]:id}));
  const pid=allPlayers.reduce((m,p)=>{m[p.id]=p;return m;},{});

  const slots=[
    {key:"a0",label:"左隊 1"},{key:"a1",label:"左隊 2"},
    {key:"b0",label:"右隊 1"},{key:"b1",label:"右隊 2"},
    ...(singlesTable?[{key:"s0",label:"單打 1"},{key:"s1",label:"單打 2"}]:[]),
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"rgba(14,22,40,0.97)",border:"1.5px solid rgba(62,207,255,0.3)",borderRadius:24,padding:"24px 20px",width:"min(360px,92vw)",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{color:CA,fontWeight:800,fontSize:16,marginBottom:4}}>手動指定對戰組合</div>
        {slots.map(({key,label})=>(
          <div key={key} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{color:"rgba(255,255,255,0.4)",fontSize:12,minWidth:54}}>{label}</div>
            <select value={picks[key]} onChange={e=>sel(key,e.target.value)}
              style={{flex:1,background:"rgba(0,0,0,0.4)",border:`1.5px solid ${picks[key]?"rgba(62,207,255,0.5)":"rgba(255,255,255,0.15)"}`,borderRadius:10,color:"#dce4f0",fontSize:14,padding:"8px 10px",outline:"none"}}>
              <option value="">— 選擇 —</option>
              {allPlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        ))}
        {hasDup&&<div style={{color:"#ff8a80",fontSize:12}}>⚠ 有人選重複了</div>}
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <button onClick={onClose} style={{flex:1,height:44,borderRadius:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)",cursor:"pointer"}}>取消</button>
          <button onClick={()=>{if(hasDup)return;onConfirm(picks,doublesTable,singlesTable);}} style={{flex:2,height:44,borderRadius:12,background:"rgba(62,207,255,0.2)",border:"2px solid rgba(62,207,255,0.5)",color:CA,fontWeight:800,cursor:"pointer",opacity:hasDup?0.4:1}}>確定</button>
        </div>
      </div>
    </div>
  );
}

/* ── 球桌卡片 ─────────────────────────────────────────────── */
function DoublesCard({table,gs,onScore,onSet,onSingleTable}) {
  const {teamA,teamB,tableNo}=table;
  return (
    <div style={S.tableCard(CA)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={S.tLabel(CA)}>桌 {tableNo}　雙打</div>
        {onSingleTable&&<button onClick={onSingleTable} style={{...S.ghostBtn,fontSize:11,padding:"5px 10px"}}>此桌換組 ↻</button>}
      </div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6}}>
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          {teamA.map(p=><PlayerFig key={p.id} color={CA} size={40} name={p.name} flip={false}/>)}
        </div>
        <div style={{flex:1,minWidth:0}}><TableSVG/></div>
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          {teamB.map(p=><PlayerFig key={p.id} color={CB} size={40} name={p.name} flip={true}/>)}
        </div>
      </div>
      <ScoreSection gs={gs} onScore={onScore} onSet={onSet}/>
    </div>
  );
}

function SinglesCard({table,gs,onScore,onSet}) {
  const {teamA,teamB,tableNo,waiting=[]}=table;
  return (
    <div style={S.tableCard(CA)}>
      <div style={S.tLabel(CA)}>桌 {tableNo}　單打</div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6}}>
        <PlayerFig color={CA} size={40} name={teamA[0].name} flip={false}/>
        <div style={{flex:1,minWidth:0}}><TableSVG/></div>
        <PlayerFig color={CB} size={40} name={teamB[0].name} flip={true}/>
      </div>
      {waiting.length>0&&<div style={{color:"rgba(255,209,102,0.6)",fontSize:12,textAlign:"center",marginTop:10}}>候場：{waiting.map(p=>p.name).join("、")}</div>}
      <ScoreSection gs={gs} onScore={onScore} onSet={onSet}/>
    </div>
  );
}

function ArenaCard({table,gs,onScore,onSet}) {
  const playing=table.singles.slice(0,2);
  const waiting=table.singles.slice(2);
  return (
    <div style={S.sideCard}>
      <div style={S.tLabel("#ffd166")}>桌 {table.tableNo}　擂台</div>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:6,marginTop:6}}>
        <PlayerFig color={CA} size={36} name={playing[0]?.name||""} flip={false}/>
        <div style={{flex:1,minWidth:0}}><TableSVG/></div>
        <PlayerFig color={CB} size={36} name={playing[1]?.name||""} flip={true}/>
      </div>
      {waiting.length>0&&<div style={{textAlign:"center",marginTop:8}}><div style={{color:"rgba(255,209,102,0.4)",fontSize:10,marginBottom:4}}>候場</div><div style={{display:"flex",gap:8,justifyContent:"center"}}>{waiting.map(p=><PlayerFig key={p.id} color="rgba(255,209,102,0.5)" size={30} name={p.name}/>)}</div></div>}
      {gs&&<ScoreSection gs={gs} onScore={onScore} onSet={onSet}/>}
    </div>
  );
}

/* ── 紀錄頁元件 ───────────────────────────────────────────── */
function EditableScore({val,color,onBlur}) {
  return <input type="number" min={0} max={99} defaultValue={val} onBlur={e=>onBlur(e.target.value)} style={{width:36,height:26,background:"rgba(0,0,0,0.4)",border:`1.5px solid ${color}88`,borderRadius:6,color,fontWeight:700,fontSize:13,textAlign:"center",outline:"none",WebkitAppearance:"none",MozAppearance:"textfield"}}/>;
}

function HistoryTableRow({table,gs,onEditGame,onEditSingle}) {
  const [editing,setEditing]=useState(false);
  if(table.isSingles){
    const games=gs?.finalGames||gs?.games||[];
    if(!games.length) return <div style={{color:"#ffd166",fontSize:13,marginBottom:4}}>桌{table.tableNo}（擂台）：{table.singles?.map(p=>p.name).join(" / ")}</div>;
    const wA=games.filter(g=>g.winner==="A").length,wB=games.filter(g=>g.winner==="B").length;
    return (<div style={{marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{color:"rgba(255,255,255,0.25)",fontSize:11}}>桌{table.tableNo}（擂台）</span><span style={{color:wA>wB?CA:"rgba(62,207,255,0.45)",fontWeight:wA>wB?700:400,fontSize:13}}>{table.singles?.[0]?.name}</span><span style={{color:"rgba(255,255,255,0.22)",fontSize:12}}>({wA}:{wB})</span><span style={{color:wB>wA?CB:"rgba(255,107,107,0.45)",fontWeight:wB>wA?700:400,fontSize:13}}>{table.singles?.[1]?.name}</span></div><GameBadges games={games} editing={editing} onEdit={(i,s,v)=>onEditGame(table.tableNo,i,s,v)}/><EditToggleBtn editing={editing} setEditing={setEditing}/></div>);
  }
  const games=gs?.finalGames||gs?.games||[];
  const hasG=games.length>0;
  const wA=games.filter(g=>g.winner==="A").length,wB=games.filter(g=>g.winner==="B").length;
  const sA=gs?.scoreA,sB=gs?.scoreB;
  const hasSc=!hasG&&sA!==undefined&&String(sA)!==""&&sB!==undefined&&String(sB)!=="";
  const aName=(table.teamA||[]).map(p=>p.name).join("+");
  const bName=(table.teamB||[]).map(p=>p.name).join("+");
  const aWin=hasG?wA>wB:hasSc&&Number(sA)>Number(sB);
  const bWin=hasG?wB>wA:hasSc&&Number(sB)>Number(sA);
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{color:"rgba(255,255,255,0.25)",fontSize:11}}>桌{table.tableNo}</span>
        <span style={{color:aWin?CA:"rgba(62,207,255,0.45)",fontWeight:aWin?700:400,fontSize:13}}>{aName}</span>
        <span style={{color:"rgba(255,255,255,0.22)",fontSize:12}}>{hasG?`(${wA}:${wB})`:hasSc?`${sA}:${sB}`:"vs"}</span>
        <span style={{color:bWin?CB:"rgba(255,107,107,0.45)",fontWeight:bWin?700:400,fontSize:13}}>{bName}</span>
      </div>
      {hasG&&<><GameBadges games={games} editing={editing} onEdit={(i,s,v)=>onEditGame(table.tableNo,i,s,v)}/><EditToggleBtn editing={editing} setEditing={setEditing}/></>}
      {hasSc&&(<div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,paddingLeft:32}}>{editing?(<><EditableScore val={sA} color={CA} onBlur={v=>onEditSingle(table.tableNo,"a",v)}/><span style={{color:"rgba(255,255,255,0.3)"}}>:</span><EditableScore val={sB} color={CB} onBlur={v=>onEditSingle(table.tableNo,"b",v)}/></>):<span style={{color:"rgba(255,255,255,0.35)",fontSize:12}}>{sA}:{sB}</span>}<EditToggleBtn editing={editing} setEditing={setEditing}/></div>)}
    </div>
  );
}

function GameBadges({games,editing,onEdit}) {
  if(!games.length) return null;
  return (<div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap",paddingLeft:32}}>{games.map((g,i)=>(<div key={i} style={{background:g.winner==="A"?`${CA}18`:`${CB}18`,border:`1px solid ${g.winner==="A"?CA:CB}44`,borderRadius:8,padding:"3px 8px",display:"flex",alignItems:"center",gap:4}}><span style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>局{i+1}</span>{editing?(<><EditableScore val={g.scoreA} color={CA} onBlur={v=>onEdit(i,"scoreA",v)}/><span style={{color:"rgba(255,255,255,0.3)",fontSize:11}}>:</span><EditableScore val={g.scoreB} color={CB} onBlur={v=>onEdit(i,"scoreB",v)}/></>):<span style={{color:g.winner==="A"?CA:CB,fontSize:11,fontWeight:700}}>{g.scoreA}:{g.scoreB}</span>}</div>))}</div>);
}

function EditToggleBtn({editing,setEditing}) {
  return <button onClick={()=>setEditing(e=>!e)} style={{...S.ghostBtn,fontSize:10,padding:"2px 8px",marginTop:4,marginLeft:32,display:"block"}}>{editing?"✓ 完成":"✎ 修改"}</button>;
}

/* ═══════════════════════════════════════════════════════════
   主 App
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  const [page,setPage]      = useState("home");
  const [members,setMems]   = useState(ROSTER);
  const [guests,setGuests]  = useState([]);
  const [guestInput,setGI]  = useState("");
  const [hist,setHist]      = useState({partners:new Map(),matches:new Map()});
  const [rounds,setRounds]  = useState([]);
  const [cur,setCur]        = useState(null);
  const [roundIdx,setRIdx]  = useState(0);
  const [smallMode,setSM]   = useState(null);
  const [smallCall,setSC]   = useState(0);
  const [lastSingleIds,setLSI] = useState([]);
  const [showManual,setShowManual] = useState(false);
  const [expandedPlayer,setExpandedPlayer] = useState(null); // #7
  const [saveStatus,setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

  const addGuest=()=>{const name=guestInput.trim();if(!name)return;setGuests(g=>[...g,{id:`guest_${Date.now()}`,name,_v:BASE_V,active:true}]);setGI("");};
  const removeGuest=(id)=>setGuests(g=>g.filter(x=>x.id!==id));

  const activePlayers=useMemo(()=>{
    const base=[...members.filter(m=>m.active),...guests];
    const delta=calcDynaDelta(rounds);
    return applyDelta(base,delta);
  },[members,guests,rounds]);

  const n=activePlayers.length;
  const isSmall=n<=5;

  const handleScore=(tableNo,side,val)=>{const key=side==="a"?"scoreA":"scoreB";setCur(c=>({...c,gs:{...c.gs,[tableNo]:{...c.gs[tableNo],[key]:val}}}));};

  const handleSet=(tableNo)=>{
    setCur(c=>{
      const gs=c.gs[tableNo];
      const a=Number(gs.scoreA),b=Number(gs.scoreB);
      if(isNaN(a)||isNaN(b))return c;
      const winner=a>b?"A":b>a?"B":"";
      const games=[...(gs.games||[]),{scoreA:a,scoreB:b,winner}];
      return{...c,gs:{...c.gs,[tableNo]:{...gs,scoreA:0,scoreB:0,games,finished:true,finalGames:games}}};
    });
  };

  // #2: nextRound 只記錄有效比賽到 hist
  const nextRound=useCallback(()=>{
    let h=hist,r=rounds;
    if(cur){
      r=[...rounds,cur];
      h=bumpHist(hist,cur.tables,cur.gs); // 傳入 gsMap
      setRounds(r);setHist(h);
    }
    const singleIds=cur?.tables.filter(t=>t.isSingles||t.isSingle1v1).flatMap(t=>t.singles||[...(t.teamA||[]),...(t.teamB||[])]).map(p=>p.id)||[];
    setLSI(singleIds);
    let tables;
    if(isSmall){tables=makeSmallRound(activePlayers,smallMode||"singles",smallCall);setSC(c=>c+1);}
    else{tables=makeRound(activePlayers,h,roundIdx,singleIds);}
    if(!tables)return;
    const gs={};tables.forEach(t=>{gs[t.tableNo]=initGS(t);});
    setCur({tables,gs});setRIdx(i=>i+1);
  },[activePlayers,hist,rounds,cur,roundIdx,isSmall,smallMode,smallCall]);

  // #2: singleTableNext 也只記有效
  const singleTableNext=(tableNo)=>{
    if(!cur)return;
    const thisTable=cur.tables.find(t=>t.tableNo===tableNo);
    if(!thisTable||thisTable.isSingles||thisTable.isSingle1v1)return;
    const savedRound={tables:[thisTable],gs:{[tableNo]:cur.gs[tableNo]}};
    const newHist=bumpHist(hist,[thisTable],{[tableNo]:cur.gs[tableNo]});
    setHist(newHist);setRounds(r=>[...r,savedRound]);
    const phase=roundIdx<6?1:2;
    const tablePlayers=[...thisTable.teamA,...thisTable.teamB];
    const newMatch=_bestDoubles(tablePlayers,newHist,phase);
    if(!newMatch)return;
    const newTable={...newMatch,tableNo};
    setCur(c=>({...c,tables:c.tables.map(t=>t.tableNo===tableNo?newTable:t),gs:{...c.gs,[tableNo]:initGS(newTable)}}));
  };

  // #8 手動指定確認
  const applyManual=(picks,doublesTable,singlesTable)=>{
    if(!cur)return;
    const pid=activePlayers.reduce((m,p)=>{m[p.id]=p;return m;},{});
    const newTables=cur.tables.map(t=>{
      if(!t.isSingles&&!t.isSingle1v1&&doublesTable&&t.tableNo===doublesTable.tableNo){
        return{...t,teamA:[pid[picks.a0],pid[picks.a1]].filter(Boolean),teamB:[pid[picks.b0],pid[picks.b1]].filter(Boolean)};
      }
      if((t.isSingle1v1||t.isSingles)&&singlesTable&&t.tableNo===singlesTable.tableNo){
        if(t.isSingle1v1) return{...t,teamA:[pid[picks.s0]].filter(Boolean),teamB:[pid[picks.s1]].filter(Boolean)};
        return{...t,singles:[pid[picks.s0],pid[picks.s1]].filter(Boolean)};
      }
      return t;
    });
    const gs={};newTables.forEach(t=>{gs[t.tableNo]=initGS(t);});
    setCur({tables:newTables,gs});
    setShowManual(false);
  };

  const start=useCallback((mode)=>{
    setSM(mode||null);setSC(0);setPage("match");
    setTimeout(()=>{
      let tables;
      if(n<=5){tables=makeSmallRound(activePlayers,mode||"singles",0);setSC(1);}
      else{tables=makeRound(activePlayers,{partners:new Map(),matches:new Map()},0,[]);}
      if(!tables)return;
      const gs={};tables.forEach(t=>{gs[t.tableNo]=initGS(t);});
      setCur({tables,gs});setRIdx(1);
    },0);
  },[activePlayers,n]);

  const handleEnd=async()=>{
    const finalRounds=cur?[...rounds,cur]:rounds;
    if(cur){setRounds(finalRounds);setCur(null);}
    setPage("end");
    setSaveStatus("saving");
    try{
      const docId=await saveSession(finalRounds,activePlayers);
      setSaveStatus(docId?"saved":"skipped");
    }catch(e){
      console.error("Firebase save failed:",e);
      setSaveStatus("error");
    }
  };

  const editGameScore=(ri,tableNo,gameIdx,side,val)=>{
    const upd=(gs)=>{const games=[...(gs.finalGames||gs.games||[])];games[gameIdx]={...games[gameIdx],[side]:Number(val)};games[gameIdx].winner=games[gameIdx].scoreA>games[gameIdx].scoreB?"A":games[gameIdx].scoreB>games[gameIdx].scoreA?"B":"";const useFinal=!!gs.finalGames;return{...gs,[useFinal?"finalGames":"games"]:games};};
    if(ri==="cur")setCur(c=>({...c,gs:{...c.gs,[tableNo]:upd(c.gs[tableNo])}}));
    else setRounds(rs=>rs.map((r,i)=>i!==ri?r:{...r,gs:{...r.gs,[tableNo]:upd(r.gs[tableNo])}}));
  };
  const editSingleScore=(ri,tableNo,side,val)=>{
    const key=side==="a"?"scoreA":"scoreB";
    if(ri==="cur")setCur(c=>({...c,gs:{...c.gs,[tableNo]:{...c.gs[tableNo],[key]:Number(val)}}}));
    else setRounds(rs=>rs.map((r,i)=>i!==ri?r:{...r,gs:{...r.gs,[tableNo]:{...r.gs[tableNo],[key]:Number(val)}}}) );
  };

  /* ── #2: 結算只計有效比賽，每「局」各算一場 ─────────────── */
  const stats=useMemo(()=>{
    const all=[...rounds,...(cur?[cur]:[])];
    const map={};
    for(const rd of all){
      for(const t of rd.tables){
        const gs=rd.gs?.[t.tableNo];
        if(!gs||!hasValidScore(gs))continue;
        const games=gs.finalGames||gs.games||[];
        const allP=[...(t.teamA||[]),...(t.teamB||[]),...(t.singles||[])];
        allP.forEach(p=>{if(!map[p.id])map[p.id]={name:p.name,wins:0,games:0,history:[]};});
        if(games.length>0){
          // 每一局各算一場（每次按「記錄比分」= 一場）
          const aNames=(t.teamA||[]).map(p=>p.name).join("+");
          const bNames=(t.teamB||[]).map(p=>p.name).join("+");
          for(const g of games){
            if(!g.winner||g.winner==="") continue;
            if(g.scoreA===0&&g.scoreB===0) continue; // 0:0 不計
            const wt=g.winner; // "A" or "B"
            const scoreStr=`${g.scoreA}:${g.scoreB}`;
            (t.teamA||[]).forEach(p=>{if(!map[p.id])map[p.id]={name:p.name,wins:0,games:0,history:[]};map[p.id].games++;if(wt==="A")map[p.id].wins++;map[p.id].history.push({myTeam:aNames,oppTeam:bNames,score:scoreStr,win:wt==="A"});});
            (t.teamB||[]).forEach(p=>{if(!map[p.id])map[p.id]={name:p.name,wins:0,games:0,history:[]};map[p.id].games++;if(wt==="B")map[p.id].wins++;map[p.id].history.push({myTeam:bNames,oppTeam:aNames,score:`${g.scoreB}:${g.scoreA}`,win:wt==="B"});});
          }
        } else {
          const a=Number(gs.scoreA),b=Number(gs.scoreB);
          if(!isNaN(a)&&!isNaN(b)&&(a>0||b>0)){
            const wt=a>b?"A":b>a?"B":null;
            const aNames=(t.teamA||[]).map(p=>p.name).join("+");
            const bNames=(t.teamB||[]).map(p=>p.name).join("+");
            (t.teamA||[]).forEach(p=>{if(!map[p.id])map[p.id]={name:p.name,wins:0,games:0,history:[]};map[p.id].games++;if(wt==="A")map[p.id].wins++;map[p.id].history.push({myTeam:aNames,oppTeam:bNames,score:`${a}:${b}`,win:wt==="A"});});
            (t.teamB||[]).forEach(p=>{if(!map[p.id])map[p.id]={name:p.name,wins:0,games:0,history:[]};map[p.id].games++;if(wt==="B")map[p.id].wins++;map[p.id].history.push({myTeam:bNames,oppTeam:aNames,score:`${b}:${a}`,win:wt==="B"});});
          }
        }
      }
    }
    const sorted=Object.values(map).filter(s=>s.games>0).map(s=>({...s,rate:Math.round(s.wins/s.games*100)})).sort((a,b)=>b.rate-a.rate||b.wins-a.wins);
    let rank=1;
    return sorted.map((s,i)=>{if(i>0&&(s.rate!==sorted[i-1].rate||s.wins!==sorted[i-1].wins))rank=i+1;return{...s,rank};});
  },[rounds,cur]);

  const renderTable=(t)=>{
    if(!cur)return null;
    const gs=cur.gs[t.tableNo];
    if(t.isSingles)return<ArenaCard key={t.tableNo} table={t} gs={gs} onScore={(s,v)=>handleScore(t.tableNo,s,v)} onSet={()=>handleSet(t.tableNo)}/>;
    if(t.isSingle1v1)return<SinglesCard key={t.tableNo} table={t} gs={gs} onScore={(s,v)=>handleScore(t.tableNo,s,v)} onSet={()=>handleSet(t.tableNo)}/>;
    // #2: 6人以上都顯示「此桌換組」
    const canSwap=!t.isSingles&&!t.isSingle1v1;
    return<DoublesCard key={t.tableNo} table={t} gs={gs} onScore={(s,v)=>handleScore(t.tableNo,s,v)} onSet={()=>handleSet(t.tableNo)} onSingleTable={canSwap?()=>singleTableNext(t.tableNo):null}/>;
  };

  const historyList=useMemo(()=>[...rounds.map((r,i)=>({...r,_key:i,_ri:i,_isCurrent:false})),...(cur?[{...cur,_key:"cur",_ri:"cur",_isCurrent:true}]:[])],[rounds,cur]);
  const rankMedal=(rank)=>rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":`#${rank}`;

  return (
    <div style={S.root}>
      <div style={S.bgMesh}/>
      <header style={S.header}>
        <div style={S.logo} onClick={()=>setPage("home")}><span style={{fontSize:24}}>🏓</span><span style={{color:CA,fontWeight:900,letterSpacing:1.5,fontSize:16}}>乒乓分組器</span></div>
        <nav style={{display:"flex",gap:6}}>
          {[["home","首頁"],["match","出賽"],["history","紀錄"]].map(([p,l])=>(<button key={p} onClick={()=>setPage(p)} style={S.navBtn(page===p)}>{l}</button>))}
          {(rounds.length>0||cur)&&<button onClick={handleEnd} style={{...S.navBtn(page==="end"),color:"#ff8a80",borderColor:"rgba(255,100,80,0.35)"}}>結算</button>}
        </nav>
      </header>

      <main style={S.main}>

        {/* ── 首頁 ── */}
        {page==="home"&&(
          <div style={{maxWidth:520,margin:"0 auto"}}>
            <h2 style={S.h2}>出席名單</h2>
            <div style={{display:"flex",flexWrap:"wrap",gap:9,marginBottom:16}}>
              {members.map(m=>(<button key={m.id} onClick={()=>setMems(ms=>ms.map(x=>x.id===m.id?{...x,active:!x.active}:x))} style={S.chip(m.active)}>{m.active?"✓ ":""}{m.name}</button>))}
              {guests.map(g=>(<button key={g.id} onClick={()=>removeGuest(g.id)} style={{...S.chip(true),borderColor:"rgba(255,209,102,0.5)",color:"#ffd166"}}>✓ {g.name}　✕</button>))}
            </div>
            <h2 style={S.h2}>臨打</h2>
            <div style={{display:"flex",gap:8,marginBottom:24}}>
              <input placeholder="輸入臨打姓名" value={guestInput} onChange={e=>setGI(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGuest()} style={{...S.input,flex:1}}/>
              <button onClick={addGuest} style={{background:"rgba(255,209,102,0.12)",border:"1.5px solid rgba(255,209,102,0.45)",color:"#ffd166",borderRadius:10,padding:"9px 16px",fontSize:14,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>＋ 加入</button>
            </div>
            <div style={S.infoBox}>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>今晚出席：</span>
              <span style={{color:CA,fontWeight:800,fontSize:16}}>{n}</span>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:13}}> 人　|　</span>
              <span style={{color:"#ffd166",fontSize:13}}>{n>=8?"兩桌雙打":n===7?"雙打＋擂台":n===6?"雙打＋單打":n===5?"5人模式":n===4?"4人模式":n>=2?"單打擂台":"人數不足"}</span>
            </div>
            {n>=6&&<button onClick={()=>start(null)} style={S.primaryBtn(true)}>開始分組 🏓</button>}
            {(n===4||n===5)&&(<div style={{display:"flex",gap:10,marginTop:10}}><button onClick={()=>start("doubles")} style={{...S.primaryBtn(true),flex:1}}>雙打模式</button><button onClick={()=>start("singles")} style={{...S.primaryBtn(true),flex:1,borderColor:"rgba(255,209,102,0.45)",color:"#ffd166"}}>單打模式</button></div>)}
            {n>=2&&n<=3&&<button onClick={()=>start("singles")} style={S.primaryBtn(true)}>開始擂台 🏓</button>}
            {n<2&&<div style={{color:"rgba(255,255,255,0.22)",fontSize:13,marginTop:12}}>至少需要 2 位出席者</div>}
            <div style={{marginTop:28,padding:"14px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12}}>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:11,lineHeight:1.8}}>💡 <strong style={{color:"rgba(255,255,255,0.5)"}}>使用說明</strong><br/>1. 勾選今晚出席的人，可加入臨打<br/>2. 按「開始分組」進入出賽頁<br/>3. 每場打完後輸入比分，按「記錄比分」<br/>4. 按「產生新的對戰組合」換下一組<br/>5. 分數框可點擊直接輸入，或長按呼叫快選<br/>6. 出賽頁可手動指定組合或桌內換組</div>
            </div>
          </div>
        )}

        {/* ── 出賽頁 ── */}
        {page==="match"&&(
          <div style={{maxWidth:900,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:8}}>
              <div style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontWeight:600,letterSpacing:1}}>
                對戰組合 <span style={{color:CA,fontWeight:800,fontSize:18}}>#{roundIdx}</span>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>setShowManual(true)} style={{...S.ghostBtn,fontSize:12,padding:"8px 14px"}}>✏️ 手動指定</button>
                <button onClick={nextRound} style={S.primaryBtn(true)}>產生新的對戰組合 →</button>
                <button onClick={handleEnd} style={{...S.primaryBtn(true),color:"#ff8a80",borderColor:"rgba(255,100,80,0.4)"}}>結束今日</button>
              </div>
            </div>
            {cur?<div style={{display:"flex",flexDirection:"column",gap:18,maxWidth:480,margin:"0 auto"}}>{cur.tables.map(t=>renderTable(t))}</div>:<div style={{color:"rgba(255,255,255,0.25)",textAlign:"center",marginTop:40}}>請先到首頁設定出席名單</div>}
            {showManual&&cur&&<ManualPick tables={cur.tables} allPlayers={activePlayers} onConfirm={applyManual} onClose={()=>setShowManual(false)}/>}
          </div>
        )}

        {/* ── 紀錄頁 ── */}
        {page==="history"&&(
          <div style={{maxWidth:680,margin:"0 auto"}}>
            <h2 style={S.h2}>今日紀錄</h2>
            {!historyList.length&&<div style={{color:"rgba(255,255,255,0.25)",textAlign:"center",marginTop:40}}>尚無紀錄</div>}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {historyList.map((rd)=>(
                <div key={rd._key} style={{...S.card,borderColor:rd._isCurrent?"rgba(62,207,255,0.22)":"rgba(255,255,255,0.07)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{color:"rgba(62,207,255,0.5)",fontWeight:700,fontSize:12}}>對戰組合 #{typeof rd._ri==="number"?rd._ri+1:roundIdx}</div>
                    {rd._isCurrent&&<span style={{color:"rgba(255,209,102,0.7)",fontSize:11,background:"rgba(255,209,102,0.1)",border:"1px solid rgba(255,209,102,0.25)",borderRadius:6,padding:"2px 8px"}}>進行中</span>}
                  </div>
                  {rd.tables.map(t=>(<HistoryTableRow key={t.tableNo} table={t} gs={rd.gs?.[t.tableNo]} onEditGame={(tableNo,gi,s,v)=>editGameScore(rd._ri,tableNo,gi,s,v)} onEditSingle={(tableNo,s,v)=>editSingleScore(rd._ri,tableNo,s,v)}/>))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 結算頁 ── */}
        {page==="end"&&(
          <div style={{maxWidth:480,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:6}}>🏆</div>
            <h2 style={{...S.h2,textAlign:"center"}}>今日結算</h2>
            <div style={{color:"rgba(255,255,255,0.3)",fontSize:13,marginBottom:20}}>
              共打 {[...rounds,...(cur?[cur]:[])].reduce((s,r)=>s+r.tables.reduce((s2,t)=>{const gs=r.gs?.[t.tableNo];if(!hasValidScore(gs))return s2;const gms=gs.finalGames||gs.games||[];return s2+(gms.length>0?gms.filter(g=>g.winner&&g.winner!==""&&!(g.scoreA===0&&g.scoreB===0)).length:1);},0),0)} 有效場次
            </div>
            {!stats.length?<div style={{color:"rgba(255,255,255,0.22)"}}>沒有有效比分紀錄</div>:(
              <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:28}}>
                {stats.map((s)=>(
                  <div key={s.id||s.name}>
                    {/* #7: 點擊人名展開個人戰績 */}
                    <div style={{...S.card,display:"flex",alignItems:"center",gap:14,
                      background:s.rank===1?"rgba(255,209,102,0.08)":"rgba(255,255,255,0.03)",
                      borderColor:expandedPlayer===s.name?"rgba(62,207,255,0.4)":s.rank===1?"rgba(255,209,102,0.3)":"rgba(255,255,255,0.07)"}}>
                      <span style={{fontSize:22,minWidth:28}}>{rankMedal(s.rank)}</span>
                      <button onClick={()=>setExpandedPlayer(ep=>ep===s.name?null:s.name)}
                        style={{flex:1,background:"none",border:"none",cursor:"pointer",textAlign:"left",
                          padding:"2px 6px",borderRadius:8,
                          outline:expandedPlayer===s.name?`2px solid ${CA}`:"none"}}>
                        <span style={{fontWeight:s.rank===1?800:600,color:s.rank===1?"#ffd166":"rgba(255,255,255,0.85)",fontSize:15}}>{s.name}</span>
                      </button>
                      <span style={{color:CA,fontWeight:800,fontSize:16}}>{s.rate}%</span>
                      <span style={{color:"rgba(255,255,255,0.28)",fontSize:12}}>{s.wins}勝/{s.games}場</span>
                    </div>
                    {/* 展開的個人戰績 */}
                    {expandedPlayer===s.name&&(
                      <div style={{marginTop:6,marginLeft:8,marginRight:8,background:"rgba(62,207,255,0.04)",border:"1px solid rgba(62,207,255,0.15)",borderRadius:12,padding:"12px 14px"}}>
                        <div style={{color:CA,fontSize:11,fontWeight:700,marginBottom:8,letterSpacing:1}}>
                          {s.name} 的今日戰績
                        </div>
                        {(s.history||[]).length===0?<div style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>無紀錄</div>:(
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {(s.history||[]).map((h,i)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,flexWrap:"wrap"}}>
                                <span style={{color:"rgba(255,255,255,0.25)",minWidth:20}}>#{i+1}</span>
                                <span style={{color:h.win?CA:"rgba(255,255,255,0.6)",fontWeight:h.win?700:400}}>{h.myTeam}</span>
                                <span style={{color:"rgba(255,255,255,0.3)"}}>vs</span>
                                <span style={{color:!h.win?CB:"rgba(255,255,255,0.6)"}}>{h.oppTeam}</span>
                                <span style={{color:h.win?CA:CB,fontWeight:700,marginLeft:"auto"}}>{h.score}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* 存檔狀態 */}
            {saveStatus==="saving"&&<div style={{color:"rgba(255,209,102,0.7)",fontSize:12,marginBottom:12}}>⏳ 紀錄存檔中…</div>}
            {saveStatus==="saved"&&<div style={{color:"rgba(62,207,255,0.7)",fontSize:12,marginBottom:12}}>✅ 今日紀錄已存入雲端</div>}
            {saveStatus==="skipped"&&<div style={{color:"rgba(255,255,255,0.3)",fontSize:12,marginBottom:12}}>— 無有效比分，未存檔</div>}
            {saveStatus==="error"&&<div style={{color:"#ff8a80",fontSize:12,marginBottom:12}}>❌ 存檔失敗，請確認網路連線</div>}
            <button onClick={()=>{setRounds([]);setCur(null);setRIdx(0);setGuests([]);setHist({partners:new Map(),matches:new Map()});setSC(0);setLSI([]);setExpandedPlayer(null);setSaveStatus(null);setPage("home");}} style={S.primaryBtn(true)}>🔄 開始新的一晚</button>
          </div>
        )}

      </main>
    </div>
  );
}

const S={
  root:{minHeight:"100vh",background:"#070c17",color:"#dce4f0",fontFamily:"'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif",position:"relative",overflow:"hidden",boxSizing:"border-box",maxWidth:"100vw"},
  bgMesh:{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"radial-gradient(ellipse at 18% 22%, rgba(0,140,220,0.09) 0%,transparent 55%), radial-gradient(ellipse at 82% 78%, rgba(0,80,180,0.07) 0%,transparent 55%)"},
  header:{position:"sticky",top:0,zIndex:100,background:"rgba(7,12,23,0.95)",backdropFilter:"blur(14px)",borderBottom:"1px solid rgba(62,207,255,0.09)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 18px"},
  logo:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"},
  main:{position:"relative",zIndex:1,padding:"24px 14px 70px"},
  navBtn:(a)=>({background:a?"rgba(62,207,255,0.10)":"transparent",border:`1px solid ${a?"rgba(62,207,255,0.35)":"rgba(255,255,255,0.08)"}`,color:a?CA:"rgba(255,255,255,0.4)",borderRadius:8,padding:"5px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}),
  h2:{color:"#dce4f0",fontWeight:800,fontSize:18,marginBottom:14,letterSpacing:0.3},
  chip:(a)=>({background:a?"rgba(62,207,255,0.10)":"rgba(255,255,255,0.03)",border:`1.5px solid ${a?"rgba(62,207,255,0.42)":"rgba(255,255,255,0.08)"}`,color:a?CA:"rgba(255,255,255,0.28)",borderRadius:20,padding:"6px 16px",fontSize:14,fontWeight:700,cursor:"pointer"}),
  input:{background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.10)",borderRadius:10,padding:"9px 13px",color:"#dce4f0",fontSize:14,outline:"none"},
  infoBox:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"11px 18px",marginBottom:16,display:"inline-flex",alignItems:"center",gap:3,flexWrap:"wrap"},
  primaryBtn:(on)=>({background:on?"rgba(62,207,255,0.12)":"rgba(255,255,255,0.03)",border:`1.5px solid ${on?"rgba(62,207,255,0.42)":"rgba(255,255,255,0.08)"}`,color:on?CA:"rgba(255,255,255,0.18)",borderRadius:12,padding:"11px 24px",fontSize:14,fontWeight:800,cursor:on?"pointer":"not-allowed",letterSpacing:0.4,display:"inline-block"}),
  tableCard:(c)=>({background:"rgba(0,0,0,0.30)",border:`1.5px solid ${c}1e`,borderRadius:22,padding:"18px 16px",width:"100%",boxSizing:"border-box",overflow:"hidden"}),
  tLabel:(c)=>({color:c,fontWeight:700,fontSize:11,letterSpacing:2.2,marginBottom:14,opacity:0.75}),
  sideCard:{background:"rgba(255,209,102,0.05)",border:"1.5px solid rgba(255,209,102,0.2)",borderRadius:22,padding:"18px 16px",width:"100%",boxSizing:"border-box",overflow:"hidden"},
  card:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px 18px"},
  setBtn:(c)=>({background:`${c}1a`,border:`1.5px solid ${c}55`,color:c,borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:800,cursor:"pointer"}),
  ghostBtn:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.38)",borderRadius:10,padding:"9px 14px",fontSize:12,cursor:"pointer"},
};
