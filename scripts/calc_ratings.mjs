import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 嘗試載入 service account key
const keyPath = join(process.cwd(), 'serviceAccountKey.json');
let serviceAccount;

try {
  if (existsSync(keyPath)) {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  } else {
    console.error('❌ 找不到 serviceAccountKey.json 檔案。');
    console.error('請至 Firebase Console -> 專案設定 -> 服務帳戶 -> 產生新的私密金鑰');
    console.error('並將下載的檔案重新命名為 serviceAccountKey.json，放在 pingpong 目錄下。');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ 讀取或解析 serviceAccountKey.json 失敗:', error.message);
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  console.log('正在從 Firestore 拉取比賽紀錄...');
  const sessionsSnapshot = await db.collection('sessions').get();
  
  if (sessionsSnapshot.empty) {
    console.log('沒有找到任何比賽紀錄。');
    return;
  }

  console.log(`✓ 找到 ${sessionsSnapshot.size} 天的紀錄。`);
  
  const playersStats = {};

  sessionsSnapshot.forEach(doc => {
    const data = doc.data();
    const rounds = data.rounds || [];
    
    // 初始化當天有出席的球員
    const dayPlayers = data.players || [];
    dayPlayers.forEach(p => {
       if (!playersStats[p.id]) {
           playersStats[p.id] = {
               name: p.name,
               gamesPlayed: 0,
               wins: 0,
               totalContribution: 0,
               totalExpected: 0,
               totalAdjustedScore: 0
           };
       }
    });

    // 目前 _v 都是 5.0，所以期望勝率 (expected) 計算時
    const DEFAULT_V = 5.0;

    rounds.forEach(rd => {
      const tables = rd.tables || [];
      tables.forEach(t => {
        // 只計算雙打 (有 teamA 和 teamB)，單打(arena, single1v1)雖然會改變勝率，但為了團隊貢獻度，暫只計雙打較為準確，或一起計(視需求)
        // 為了簡單起見，我們先計算所有的有效 game
        const games = t.games || [];
        if (games.length === 0) return;

        const isDouble = t.type === 'doubles';
        const teamAIds = t.teamA || [];
        const teamBIds = t.teamB || [];
        
        // 如果是單打，也把它當作 1v1 的隊伍
        // 單打擂台的 teamA/teamB 記錄方式在存檔時如果轉成了 singles array，這裡處理要注意
        let finalTeamAIds = teamAIds;
        let finalTeamBIds = teamBIds;
        
        if (t.type === 'arena') {
            // 目前存檔 arena 把單打的 id 放進 singles array，而且沒有記誰跟誰打哪一局，所以難以精確算，暫時跳過擂台
            return; 
        }

        const teamARating = finalTeamAIds.length * DEFAULT_V;
        const teamBRating = finalTeamBIds.length * DEFAULT_V;
        
        // 如果有隊伍人數為0，跳過
        if(teamARating === 0 || teamBRating === 0) return;

        const expectedA = teamARating / (teamARating + teamBRating);
        const expectedB = teamBRating / (teamARating + teamBRating);

        games.forEach(g => {
            if (g.scoreA === 0 && g.scoreB === 0) return;
            if (!g.winner || g.winner === "") return;

            const totalScore = g.scoreA + g.scoreB;
            const marginScore = totalScore > 0 ? (Math.abs(g.scoreA - g.scoreB) / totalScore) : 0;
            
            // 計算貢獻度 (0.7 * 勝負 + 0.3 * 分差)
            const isAWin = g.winner === "A";
            const isBWin = g.winner === "B";
            
            const contributionA = (isAWin ? 1 : 0) * 0.7 + (isAWin ? marginScore : -marginScore) * 0.3;
            // contributionA 這裡算出來範圍:
            // 全贏 11:0 -> 1*0.7 + 1*0.3 = 1
            // 慘敗 0:11 -> 0*0.7 + (-1)*0.3 = -0.3
            // 稍微調整讓它是正的，或直接用實際勝率比較簡單理解
            // 我們採用你提到的：
            // contribution = 0.7 × (1 或 0) + 0.3 × margin_score_normalized (0~1)
            
            const marginNorm = totalScore > 0 ? (Math.max(g.scoreA, g.scoreB) - Math.min(g.scoreA, g.scoreB)) / totalScore : 0;
            
            let contA = 0;
            let contB = 0;
            if (isAWin) {
                contA = 0.7 * 1 + 0.3 * marginNorm;
                contB = 0; // 輸家不給貢獻值基準，或者你可以給 0.7*0 + 0.3*(1-marginNorm)。為配合 expected，我們給 0
            } else {
                contA = 0;
                contB = 0.7 * 1 + 0.3 * marginNorm;
            }

            const adjustedA = contA - expectedA;
            const adjustedB = contB - expectedB;

            finalTeamAIds.forEach(id => {
                if(playersStats[id]) {
                    playersStats[id].gamesPlayed++;
                    if(isAWin) playersStats[id].wins++;
                    playersStats[id].totalContribution += contA;
                    playersStats[id].totalExpected += expectedA;
                    playersStats[id].totalAdjustedScore += adjustedA;
                }
            });

            finalTeamBIds.forEach(id => {
                if(playersStats[id]) {
                    playersStats[id].gamesPlayed++;
                    if(isBWin) playersStats[id].wins++;
                    playersStats[id].totalContribution += contB;
                    playersStats[id].totalExpected += expectedB;
                    playersStats[id].totalAdjustedScore += adjustedB;
                }
            });
        });
      });
    });
  });

  console.log('\n╔════════════╦══════════╦══════════╦══════════════╦══════════╗');
  console.log('║ 球員       ║ 場次     ║ 原始勝率 ║ 平均調整貢獻 ║ 建議_v   ║');
  console.log('╠════════════╬══════════╬══════════╬══════════════╬══════════╣');

  const resultRows = [];

  for (const id in playersStats) {
      const stats = playersStats[id];
      if (stats.gamesPlayed === 0) continue;

      const winRate = (stats.wins / stats.gamesPlayed * 100).toFixed(0) + '%';
      const avgAdjusted = stats.totalAdjustedScore / stats.gamesPlayed;
      
      // 建議 _v 計算： clamp(5.0 + avgAdjusted * 10, 1.0, 10.0)
      let suggestedV = 5.0 + (avgAdjusted * 10);
      suggestedV = Math.max(1.0, Math.min(10.0, suggestedV));

      resultRows.push({
          name: stats.name,
          gamesCount: stats.gamesPlayed,
          winRate: winRate,
          avgAdjusted: avgAdjusted,
          suggestedV: suggestedV
      });
  }

  // 依建議 _v 排序
  resultRows.sort((a, b) => b.suggestedV - a.suggestedV);

  resultRows.forEach(r => {
      const name = r.name.padEnd(10, '　').substring(0, 5); // 簡單對齊
      const games = `${r.gamesCount}場`.padEnd(8, ' ');
      const wr = r.winRate.padEnd(8, ' ');
      const adj = (r.avgAdjusted > 0 ? '+' : '') + r.avgAdjusted.toFixed(3);
      const adjStr = adj.padEnd(12, ' ');
      const vStr = r.suggestedV.toFixed(1).padEnd(8, ' ');
      
      console.log(`║ ${name} ║ ${games} ║ ${wr} ║ ${adjStr} ║ ${vStr} ║`);
  });

  console.log('╚════════════╩══════════╩══════════╩══════════════╩══════════╝');
  console.log('\n說明:');
  console.log('1. 平均調整貢獻 = 每局的(實際貢獻 - 系統預期勝率) 之平均。');
  console.log('2. 實際貢獻 = 勝負占0.7，比分差占0.3。');
  console.log('3. 建議_v = 5.0 + (平均調整貢獻 × 10)，介於 1.0 ~ 10.0 之間。');
}

run().catch(console.error);
