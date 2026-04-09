import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAVhcg5LubHS1QDz54NnvFnkxWJfwbwyww",
  authDomain: "pingpong-cb3ce.firebaseapp.com",
  projectId: "pingpong-cb3ce",
  storageBucket: "pingpong-cb3ce.firebasestorage.app",
  messagingSenderId: "707368058631",
  appId: "1:707368058631:web:8b7dbe16c2b81ba3e8cfa2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * 把一晚的完整比賽記錄存入 Firestore。
 * @param {Array}  allRounds     - [...rounds, cur]（含當前局）
 * @param {Array}  activePlayers - 今晚出席的球員（含 id, name）
 */
export async function saveSession(allRounds, activePlayers) {
  // 過濾掉沒有任何有效比分的局
  const validRounds = allRounds.filter(rd =>
    rd.tables.some(t => {
      const gs = rd.gs?.[t.tableNo];
      if (!gs) return false;
      const games = gs.finalGames || gs.games || [];
      if (games.length > 0) return games.some(g => g.scoreA > 0 || g.scoreB > 0);
      return Number(gs.scoreA) > 0 || Number(gs.scoreB) > 0;
    })
  );

  if (validRounds.length === 0) return null; // 沒有任何有效比分，不存

  const sessionData = {
    date: new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })
      .replace(/\//g, "-"),
    timestamp: serverTimestamp(),
    players: activePlayers.map(p => ({ id: p.id, name: p.name })),
    rounds: validRounds.map((rd, i) => ({
      roundIdx: i + 1,
      tables: rd.tables.map(t => {
        const gs = rd.gs?.[t.tableNo];
        const rawGames = gs?.finalGames || gs?.games || [];
        const games = rawGames
          .filter(g => g.scoreA > 0 || g.scoreB > 0)
          .map(g => ({ scoreA: g.scoreA, scoreB: g.scoreB, winner: g.winner || "" }));

        if (t.isSingles) {
          return {
            tableNo: t.tableNo,
            type: "arena",
            singles: (t.singles || []).map(p => p.id),
            games,
          };
        }
        if (t.isSingle1v1) {
          return {
            tableNo: t.tableNo,
            type: "single1v1",
            teamA: (t.teamA || []).map(p => p.id),
            teamB: (t.teamB || []).map(p => p.id),
            games,
          };
        }
        // doubles
        return {
          tableNo: t.tableNo,
          type: "doubles",
          teamA: (t.teamA || []).map(p => p.id),
          teamB: (t.teamB || []).map(p => p.id),
          games,
        };
      }),
    })),
  };

  const docRef = await addDoc(collection(db, "sessions"), sessionData);
  return docRef.id;
}
