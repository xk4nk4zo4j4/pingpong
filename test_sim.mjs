// ═══════════════════════════════════════════
// 乒乓分組器 - 核心邏輯模擬測試
// ═══════════════════════════════════════════

const BASE_V = 5.0;
const ALL_PLAYERS = [
  { id:"alan",    name:"Alan",  _v:BASE_V },
  { id:"jimmy",   name:"Jimmy", _v:BASE_V },
  { id:"curly",   name:"捲毛",  _v:BASE_V },
  { id:"peiyun",  name:"珮芸",  _v:BASE_V },
  { id:"siu",     name:"修哥",  _v:BASE_V },
  { id:"wenzhu",  name:"雯筑",  _v:BASE_V },
  { id:"yinxuan", name:"音旋",  _v:BASE_V },
  { id:"guest1",  name:"訪客A", _v:BASE_V },
  { id:"guest2",  name:"訪客B", _v:BASE_V },
];

// ── 核心演算法（從 App.jsx 原樣複製）────────────────
function _rank(tA, tB, hist, phase) {
  const gap = Math.abs(tA.reduce((s,p)=>s+p._v,0) - tB.reduce((s,p)=>s+p._v,0));
  const balPen = phase===1 ? gap*2.5 : gap*1;
  const pkA = [...tA.map(p=>p.id)].sort().join("-");
  const pkB = [...tB.map(p=>p.id)].sort().join("-");
  const mk  = [pkA,pkB].sort().join("|");
  const rep = (hist.partners.get(pkA)||0)+(hist.partners.get(pkB)||0)+(hist.matches.get(mk)||0)*2;
  return -(balPen + rep*4);
}

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
      const singles=active.filter(p=>!c4.map(x=>x.id).includes(p.id));
      const singleIds=singles.map(p=>p.id);
      const bothStillSingle=lastSingleIds.length>=2 &&
        lastSingleIds.every(id=>singleIds.includes(id));
      if(bothStillSingle) sc-=10;
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

// ── 模擬對戰並回傳報告 ──────────────────────────────
function simulate(playerCount, rounds=15, label="") {
  const active = ALL_PLAYERS.slice(0, playerCount);
  let hist = { partners: new Map(), matches: new Map() };
  let lastSingleIds = [];
  const matchLog = [];     // 每場雙打的 key
  const partnerLog = [];   // 每場搭檔的 key
  const dupMatches = [];
  const dupPartners = [];
  const roundDetails = [];

  for(let i=0;i<rounds;i++){
    const tables = makeRound(active, hist, i, lastSingleIds);
    if(!tables){ console.log(`  ⚠ round ${i+1}: makeRound returned null`); continue; }

    const roundStr = tables.map(t=>{
      if(t.isSingles) return `[擂台:${t.singles.map(p=>p.name).join("/")}]`;
      if(t.isSingle1v1) return `[單:${t.teamA[0].name} vs ${t.teamB[0].name}]`;
      const pkA=t.teamA.map(p=>p.name).sort().join("+");
      const pkB=t.teamB.map(p=>p.name).sort().join("+");
      return `[雙:${pkA} vs ${pkB}]`;
    }).join("  ");
    roundDetails.push(`  #${String(i+1).padStart(2)} ${roundStr}`);

    // 記錄單打側（只看 isSingles）
    lastSingleIds = tables
      .filter(t=>t.isSingles||t.isSingle1v1)
      .flatMap(t=>t.singles||[...(t.teamA||[]),...(t.teamB||[])])
      .map(p=>p.id);

    // 分析重複
    for(const t of tables){
      if(t.isSingles||t.isSingle1v1) continue;
      const pkA=[...t.teamA.map(p=>p.id)].sort().join("-");
      const pkB=[...t.teamB.map(p=>p.id)].sort().join("-");
      const mk=[pkA,pkB].sort().join("|");
      const pkAname=t.teamA.map(p=>p.name).sort().join("+");
      const pkBname=t.teamB.map(p=>p.name).sort().join("+");
      const mkName=[pkAname,pkBname].sort().join(" vs ");
      // 搭檔重複
      if(partnerLog.includes(pkA)) dupPartners.push(`  ⚠ 局${i+1} 搭檔重複：${pkAname}`);
      if(partnerLog.includes(pkB)) dupPartners.push(`  ⚠ 局${i+1} 搭檔重複：${pkBname}`);
      // 對戰組合重複
      if(matchLog.includes(mk)) dupMatches.push(`  ❌ 局${i+1} 對戰重複：${mkName}`);
      partnerLog.push(pkA, pkB);
      matchLog.push(mk);
    }

    hist = bumpHist(hist, tables);
  }

  // 輸出
  console.log(`\n${"═".repeat(60)}`);
  console.log(`▶ ${label || `${playerCount}人模式`}  (${rounds} 局)`);
  console.log(`${"─".repeat(60)}`);
  roundDetails.forEach(r=>console.log(r));
  console.log(`${"─".repeat(60)}`);
  if(dupMatches.length===0) console.log(`  ✅ 雙打對戰組合：無重複`);
  else { console.log(`  對戰重複 ${dupMatches.length} 次：`); dupMatches.forEach(d=>console.log(d)); }
  if(dupPartners.length===0) console.log(`  ✅ 雙打搭檔：無重複`);
  else { console.log(`  搭檔重複 ${dupPartners.length} 次：`); dupPartners.forEach(d=>console.log(d)); }
  return { dupMatches: dupMatches.length, dupPartners: dupPartners.length };
}

// ── 測試「此桌換組」邏輯 ────────────────────────────
function testSingleTableNext(playerCount=8) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`▶ 此桌換組測試（${playerCount}人，模擬 5 次換組）`);
  console.log(`${"─".repeat(60)}`);
  const active = ALL_PLAYERS.slice(0, playerCount);
  let hist = { partners: new Map(), matches: new Map() };

  const tables = makeRound(active, hist, 0, []);
  console.log(`  初始分組：`);
  tables.forEach(t=>{
    if(!t.isSingles&&!t.isSingle1v1){
      console.log(`    桌${t.tableNo}: ${t.teamA.map(p=>p.name).join("+")} vs ${t.teamB.map(p=>p.name).join("+")}`);
    }
  });

  // 模擬對桌1換組
  for(let i=0;i<5;i++){
    const t1 = tables.find(t=>t.tableNo===1);
    const tablePlayers=[...t1.teamA,...t1.teamB];
    const newHist=bumpHist(hist,[t1]);
    const phase=0<6?1:2;
    const newMatch=_bestDoubles(tablePlayers,newHist,phase);
    if(!newMatch){ console.log(`  換組#${i+1}: 無法找到新組合`); break; }
    console.log(`  換組#${i+1}: ${newMatch.teamA.map(p=>p.name).join("+")} vs ${newMatch.teamB.map(p=>p.name).join("+")}`);
    hist=newHist;
    t1.teamA=newMatch.teamA;
    t1.teamB=newMatch.teamB;
  }
  console.log(`  ✅ 換組功能正常`);
}

// ── 測試手動指定（驗證 applyManual 路徑）───────────────
function testManualPick() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`▶ 手動指定對戰組合測試（6人）`);
  console.log(`${"─".repeat(60)}`);
  const active = ALL_PLAYERS.slice(0,6);
  let hist = { partners: new Map(), matches: new Map() };

  // 手動指定：alan+jimmy vs curly+peiyun，單打：siu vs wenzhu
  const manualDoubles = { teamA:[active[0],active[1]], teamB:[active[2],active[3]], tableNo:1 };
  const manualSingles = { teamA:[active[4]], teamB:[active[5]], tableNo:2, isSingle1v1:true };
  const manualTables = [manualDoubles, manualSingles];
  hist = bumpHist(hist, manualTables);

  console.log(`  手動指定：${active[0].name}+${active[1].name} vs ${active[2].name}+${active[3].name}`);
  console.log(`  單打：${active[4].name} vs ${active[5].name}`);

  // 下一場應避開這個組合
  const tables2 = makeRound(active, hist, 1, [active[4].id, active[5].id]);
  const t2 = tables2.find(t=>!t.isSingles&&!t.isSingle1v1);
  const mkNew=[t2.teamA.map(p=>p.id).sort().join("-"),t2.teamB.map(p=>p.id).sort().join("-")].sort().join("|");
  const mkManual=[["alan","jimmy"].join("-"),["curly","peiyun"].join("-")].sort().join("|");
  const isDup = mkNew===mkManual;
  console.log(`  下一場雙打：${t2.teamA.map(p=>p.name).join("+")} vs ${t2.teamB.map(p=>p.name).join("+")}`);
  console.log(`  ${isDup?"❌ 重複了！":"✅ 成功避開上場組合"}`);
}

// ── 主跑 ─────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════╗");
console.log("║     乒乓分組器 模擬測試（各人數 × 15 局）           ║");
console.log("╚══════════════════════════════════════════════════════╝");

const results = [];
for(const n of [5,6,7,8,9]){
  // 5人只測小人數模式（doubles），不跑 makeRound
  if(n===5){ console.log(`\n(5人走 makeSmallRound，makeRound 不適用，跳過重複測試)`); continue; }
  const r = simulate(n, 15);
  results.push({n, ...r});
}

testSingleTableNext(8);
testManualPick();

// ── 總結 ─────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log("▶ 總結");
console.log(`${"─".repeat(60)}`);
results.forEach(r=>{
  const matchStatus = r.dupMatches===0 ? "✅" : `❌(${r.dupMatches}次)`;
  const partnerStatus = r.dupPartners===0 ? "✅" : `⚠(${r.dupPartners}次)`;
  console.log(`  ${r.n}人：對戰重複 ${matchStatus}　搭檔重複 ${partnerStatus}`);
});
console.log();
