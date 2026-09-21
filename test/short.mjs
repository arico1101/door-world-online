/* ショート版（6〜25歳・1〜4人）だけの自動テスト。
   ここで守るのは、短くしたときにいちばん壊れやすい4つ:
     1. ウガンダの遺児家庭(w5/w6)が、何人で遊んでも必ず配られる
     2. 1人プレイで、ロビーからゴール・結果発表まで完走できる
     3. AAI が、遺児家庭の「大学のトビラ」に必ず出てくる／カギ★3に届く
     4. 25歳のゴールで、奨学金の残額が没収されず、結果に残る
   使い方: HOST=ws://localhost:8787 node test/short.mjs */
const HOST = process.env.HOST || "ws://localhost:8787";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, fatal = null;
const ok = label => { passed++; console.log("  ok　" + label); };
const room = () => "S" + Math.random().toString(36).slice(2, 7).toUpperCase();

function mk(rm, pid, name) {
  const c = { pid, name, g: null, you: null, auto: null, watch: null };
  c.ws = new WebSocket(`${HOST}/ws?room=${rm}&pid=${pid}&name=${name}`);
  c.ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t !== "state") return;
    c.g = m.g; c.you = m.you;
    try { if (c.watch) c.watch(c); if (c.auto) c.auto(c); }
    catch (e) { fatal = fatal || e; }                  /* onmessage の中で投げても外に届かないので拾っておく */
  };
  /* 閉じたあとの error は無視する（閉じた瞬間に上がることがあり、次のテストを巻きこむ） */
  c.ws.onerror = () => { if (!c.dead) fatal = fatal || new Error("ws error " + pid); };
  c.send = m => { try { c.ws.send(JSON.stringify(m)); } catch {} };
  c.close = () => { c.dead = true; try { c.ws.onmessage = null; c.ws.onerror = null; c.ws.close(); } catch {} };
  return c;
}
async function waitFor(c, fn, label, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fatal) throw fatal;
    if (c.g && fn(c.g)) return c.g;
    await sleep(20);
  }
  throw new Error("TIMEOUT: " + label + " / phase=" + (c.g && c.g.phase));
}
/* 入った順で進行役が決まるので、1人ずつ順番に入れる */
async function joinAll(rm, n) {
  const cs = [];
  for (let i = 0; i < n; i++) {
    const c = mk(rm, "p" + i, "P" + i);
    await waitFor(c, g => g.players.some(p => p.id === c.pid), "P" + i + " 参加");
    cs.push(c);
  }
  await waitFor(cs[0], g => g.players.length === n, n + "人そろう");
  return cs;
}
/* 通しプレイの自動応答。pick(pd, open) で「選びかたのクセ」を変えられる */
function autoPlay(pick) {
  return c => {
    const g = c.g;
    if (!g || g.phase !== "play") return;
    const cur = g.players[g.turn];
    if (!cur || cur.id !== c.pid) return;
    const pd = g.pending;
    if (!pd) return c.send({ t: "roll" });
    if (pd.kind === "choice") {
      const open = pd.states.map((s, i) => s === "open" ? i : -1).filter(i => i >= 0);
      if (!open.length) throw new Error("開けられる選択肢がひとつもない（袋小路）");
      return c.send({ t: "choose", i: pick ? pick(pd, open) : open[Math.floor(Math.random() * open.length)] });
    }
    c.send({ t: "ok" });
  };
}
const rand = (pd, open) => open[Math.floor(Math.random() * open.length)];
/* 全トビラのマスが stop:true なので、6枚全部と必ず出会う（1人プレイのネタバラシを濃くするため） */
const SIX_DOORS = ["進学のトビラ", "くらしのトビラ", "大学のトビラ", "まちのトビラ", "技術のトビラ", "しごとのトビラ"];
function checkSixDoors(p) {
  const titles = (p.doorLog || []).map(d => (d.title && d.title.ja) || "");
  for (const t of SIX_DOORS)
    if (!titles.includes(t)) throw new Error(`${p.name}(${p.fam.id}) が「${t}」と出会っていない [${titles.join("、")}]`);
}
/* 貸与型の奨学金と、大学（19歳）の道を必ず通るように選ぶ。
   奨学金は15歳・大学は19歳の別のトビラなので、優先順位が競合することはない */
const seekLoan = (pd, open) => {
  const loan = open.find(i => pd.opts[i].special === "shogakukin");
  if (loan != null) return loan;
  const univ = open.find(i => pd.opts[i].univ);
  if (univ != null) return univ;
  const manabi = open.find(i => pd.opts[i].tag === "manabi");
  if (manabi != null) return manabi;
  return open[Math.floor(Math.random() * open.length)];
};

/* ============ 1. 家庭カードの配り ============ */
async function dealTest() {
  console.log("[1] ウガンダの遺児家庭(w5/w6)が、1〜4人すべてで必ず配られる");
  const ROUNDS = 40;
  for (let n = 1; n <= 4; n++) {
    const rm = room();
    const cs = await joinAll(rm, n);
    const tally = {};
    for (let r = 0; r < ROUNDS; r++) {
      cs[0].send({ t: "setmode", mode: "short" }); cs[0].send({ t: "start", heavyOn: true });
      await waitFor(cs[0], g => g.phase === "cards", `${n}人・${r + 1}回目：配りはじめ`);
      for (const c of cs) await waitFor(c, () => c.you && c.you.fam, `${n}人・${r + 1}回目：カード受信`);
      const ids = cs.map(c => c.you.fam.id);
      if (!ids.some(id => id === "w5" || id === "w6"))
        throw new Error(`${n}人・${r + 1}回目：w5/w6 が1枚も配られなかった [${ids.join(",")}]`);
      if (n === 1 && !(ids[0] === "w5" || ids[0] === "w6"))
        throw new Error(`1人プレイなのに ${ids[0]} が配られた`);
      if (new Set(ids).size !== ids.length)
        throw new Error(`同じ家庭カードが重複して配られた [${ids.join(",")}]`);
      ids.forEach(id => tally[id] = (tally[id] || 0) + 1);
      cs[0].send({ t: "reset" });
      await waitFor(cs[0], g => g.phase === "lobby", "ロビーにもどる");
      for (const c of cs) await waitFor(c, () => !c.you, "カードが手元から消える");
    }
    const mix = Object.keys(tally).sort().map(k => `${k}:${tally[k]}`).join(" ");
    ok(`${n}人 × ${ROUNDS}回：毎回 w5/w6 が入る（内訳 ${mix}）`);
    cs.forEach(c => c.close());
  }
}

/* ============ 2. 1人プレイの完走 ============ */
async function soloTest() {
  console.log("[2] 1人プレイで、ロビーからゴール・結果発表まで完走する");
  const rm = room();
  const [c] = await joinAll(rm, 1);
  c.send({ t: "setmode", mode: "short" }); c.send({ t: "start", heavyOn: true });
  await waitFor(c, g => g.phase === "cards", "1人でもゲームを開始できる");
  ok("1人でもロビーから開始できる");
  c.send({ t: "seen" });
  await waitFor(c, g => g.phase === "play", "カード確認からプレイへ");
  c.auto = autoPlay(rand); c.auto(c);
  await waitFor(c, g => g.phase === "result", "ゴール・結果発表まで到達", 30000);
  c.auto = null;
  const p = c.g.players[0];
  if (!(p.fam.id === "w5" || p.fam.id === "w6")) throw new Error("1人プレイの主人公が遺児家庭でない: " + p.fam.id);
  if (!p.doorLog || !p.doorLog.length) throw new Error("ネタバラシの材料(doorLog)が空");
  if (p.open + p.locked + p.unseen === 0) throw new Error("トビラの集計が空");
  checkSixDoors(p);
  ok(`1人で完走・6枚のトビラ全部と出会った（${p.fam.id} / 記録${p.doorLog.length}件・開${p.open} 鍵${p.locked} 見${p.unseen} / ♥${p.happy}）`);
  c.close();
}

/* ============ 3+4. AAIのトビラと、奨学金の残額 ============
   同じ通しプレイから両方を確かめる。奨学金の貸与は家庭カードの配りしだいなので、
   出るまで何ゲームか回す（出なければ失敗として報告する） */
const aaiOptIndex = e => e.opts.findIndex(o => o.special === "aai");
async function playAndCheck(games) {
  console.log("[3] AAI が、遺児家庭の大学のトビラに必ず出る／★3のカギに届く");
  console.log("[4] 25歳のゴールで、奨学金の残額が没収されない");
  console.log("[5] 24歳の大学院は、19歳で大学に行けた人にだけ開く（ほかの人には🔒で見える）");
  let orphans = 0, aaiOpen = 0, loanSeen = 0, univSeen = 0, gradOpen = 0;
  const dom = {};                                      /* 国内大学（おかね150万）に、家庭カード別で手が届いたか */
  for (let n = 0; n < games; n++) {
    const rm = room();
    const cs = await joinAll(rm, 4);
    const goals = {};                                  /* ゴールした瞬間の「おかね」と「のこりの奨学金」 */
    cs[0].watch = c => {
      const pd = c.g.pending;
      if (pd && pd.kind === "goal" && !goals[pd.for]) {
        const p = c.g.players.find(x => x.id === pd.for);
        goals[pd.for] = { loan: pd.loan, fxMoney: (pd.fx && pd.fx.money) || 0, money: p.money };
      }
    };
    cs[0].send({ t: "setmode", mode: "short" }); cs[0].send({ t: "start", heavyOn: true });
    await waitFor(cs[0], g => g.phase === "cards", "カード確認へ");
    cs.forEach(c => c.send({ t: "seen" }));
    await waitFor(cs[0], g => g.phase === "play", "プレイ開始");
    cs.forEach(c => { c.auto = autoPlay(seekLoan); c.auto(c); });
    await waitFor(cs[0], g => g.phase === "result", `${n + 1}ゲーム目が結果発表まで進む`, 40000);
    cs.forEach(c => c.auto = null);

    for (const p of cs[0].g.players) {
      checkSixDoors(p);                                /* 全員が6枚のトビラ全部と出会う */
      /* --- 3. 遺児家庭には、AAIのトビラが必ず出る --- */
      const orphan = p.fam.id === "w5" || p.fam.id === "w6";
      if (orphan) {
        orphans++;
        const e = (p.doorLog || []).find(d => aaiOptIndex(d) >= 0);
        if (!e) throw new Error(`${p.fam.id} の盤面にAAIのトビラが出なかった（大学のマスを通っていない）`);
        if (e.age !== 19) throw new Error(`AAIのトビラが19歳ではなく${e.age}歳に出ている`);
        const i = aaiOptIndex(e), st = e.chosen === i ? "chosen" : e.states[i];
        if (st === "locked")
          throw new Error(`${p.fam.id} がAAIのカギ（★${e.opts[i].req.learn}）に届かなかった。req を下げること`);
        if (p.fam.id === "w5" && st === "unseen")
          throw new Error("支援を知っている w5 にAAIが見えていない");
        if (st === "open" || st === "chosen") aaiOpen++;
      }
      /* --- 国内大学のカギに、どの家庭が届いているか（バランス確認用の実測） --- */
      const uni = (p.doorLog || []).find(d => d.title && d.title.ja === "大学のトビラ");
      const di = uni.opts.findIndex(o => o.t.ja === "自分の国の大学に進む");
      if (di < 0) throw new Error("大学のトビラに国内大学の選択肢がない");
      if (uni.states[di] === "unseen") throw new Error("国内大学が？？？になっている（全員に見せるはず）");
      const d = dom[p.fam.id] || (dom[p.fam.id] = { open: 0, all: 0 });
      d.all++; if (uni.chosen === di || uni.states[di] === "open") d.open++;

      /* --- 5. 24歳の大学院は、大学を出た人だけが開けられる --- */
      const job = (p.doorLog || []).find(d => d.title && d.title.ja === "しごとのトビラ");
      const gi = job.opts.findIndex(o => o.req && o.req.univ);
      if (gi < 0) throw new Error("24歳のしごとのトビラに大学院の選択肢がない");
      const gst = job.chosen === gi ? "chosen" : job.states[gi];
      if (gst === "unseen") throw new Error("大学院が？？？になっている（🔒で全員に見せるはず）");
      if (!p.univ && gst !== "locked")
        throw new Error(`大学に行っていない ${p.fam.id} の大学院が ${gst} になっている`);
      if (p.univ) { univSeen++; if (gst !== "locked") gradOpen++; }

      /* --- 4. 25歳では奨学金を返し終わらない。没収もしない --- */
      const gl = goals[p.id];
      if (gl && gl.loan > 0) {
        loanSeen++;
        if (gl.fxMoney) throw new Error(`ゴールで奨学金 ${gl.loan}万 が没収されている（fx.money=${gl.fxMoney}）`);
        if (p.money !== gl.money) throw new Error(`ゴール後におかねが変わっている ${gl.money} → ${p.money}`);
        if (p.loan !== gl.loan) throw new Error(`結果発表に残額が引きつがれていない ${gl.loan} → ${p.loan}`);
      }
    }
    cs.forEach(c => c.close());
    /* 貸与型とAAIの「開いた例」の両方を見られたら十分。
       w6 は支援に出会うまでAAIが？？？なので、少ないゲーム数だと開いた例が1件も出ないことがある */
    if (loanSeen && aaiOpen && n >= 2) break;
  }
  if (!orphans) throw new Error("遺児家庭が1人も配られなかった（テストが成立していない）");
  ok(`遺児家庭 ${orphans}人ぶん：全員の19歳にAAIのトビラが出た（うち ${aaiOpen}人はカギが足りていた）`);
  if (aaiOpen === 0) throw new Error("AAIのカギに届いた人が1人もいない。req を下げること");
  if (!loanSeen) throw new Error("貸与型の奨学金を背負った人が出ず、残額の確認ができなかった");
  ok(`貸与型の奨学金 ${loanSeen}人ぶん：25歳でも没収されず、残額が結果発表に残る`);
  const domMix = Object.keys(dom).sort().map(k => `${k} ${dom[k].open}/${dom[k].all}`).join("　");
  console.log(`  ・国内大学（おかね150万）に手が届いた割合：${domMix}`);
  if (!univSeen) throw new Error("大学まで行けた人が出ず、大学院の確認ができなかった");
  ok(`大学に行けた ${univSeen}人ぶん：24歳の大学院が開いた（うちカギ★6も足りていた ${gradOpen}人）／行けなかった人には🔒で見えている`);
}

/* ============ 6. 話し合うマスと、じぶんの選択の記録 ============ */
async function talkAndMyChoicesTest() {
  console.log("[6] 22歳の「みんなで話す」マスと、本人だけが見られる選択の記録");
  let talkGames = 0;
  for (let round = 0; round < 4; round++) {
    const rm = room();
    const cs = await joinAll(rm, 4);
    /* 話し合いが何回起きたか・だれの番だったかを、立ちあがりの瞬間だけ数える */
    let talks = 0, talkAt = null, wasTalk = false, sharedBody = 0;
    cs.forEach((c, i) => {
      c.watch = cc => {
        const pd = cc.g && cc.g.pending;
        const isTalk = !!(pd && pd.type === "talk");
        if (isTalk && i === 0 && !wasTalk) {
          talks++;
          const me = cc.g.players.find(p => p.id === pd.for);
          talkAt = me ? me.pos : null;
        }
        if (isTalk && i === 0) wasTalk = true; else if (i === 0) wasTalk = false;
        /* 止まった本人でなくても、話し合いのお題が届いていること */
        if (isTalk && pd.for !== cc.pid && pd.note && pd.body) sharedBody++;
      };
    });
    cs[0].send({ t: "setmode", mode: "short" }); cs[0].send({ t: "start", heavyOn: true });
    await waitFor(cs[0], g => g.phase === "cards", "配りはじめ");
    cs.forEach(c => c.send({ t: "seen" }));
    await waitFor(cs[0], g => g.phase === "play", "プレイ開始");
    cs.forEach(c => { c.auto = autoPlay(rand); c.auto(c); });
    await waitFor(cs[0], g => g.phase === "result", "結果発表", 60000);
    cs.forEach(c => c.auto = null);

    if (talks !== 1) throw new Error(`話し合いマスが1ゲームに ${talks} 回起きた（1回でなければならない）`);
    if (talkAt !== 16) throw new Error(`話し合いマスで止まった位置が ${talkAt}（16マス目のはず）`);
    if (!sharedBody) throw new Error("止まった人以外に、話し合いのお題が届いていない");
    talkGames++;

    /* じぶんの選択の記録：えらんだものと一致し、えらばなかったものは1件も入っていない */
    for (const c of cs) {
      const pub = c.g.players.find(p => p.id === c.pid);
      const chosen = (pub.doorLog || []).filter(e => e.chosen != null);
      const mine = (c.you && c.you.myChoices) || [];
      if (mine.length !== chosen.length)
        throw new Error(`${c.name}: 記録が ${mine.length}件、実際にえらんだのは ${chosen.length}件`);
      chosen.forEach((e, k) => {
        const want = e.opts[e.chosen].t.ja;
        if (mine[k].t.ja !== want)
          throw new Error(`${c.name}: ${k + 1}件目が「${mine[k].t.ja}」、えらんだのは「${want}」`);
      });
      /* ネタバレ検査：一度もえらんでいない選択肢の文言が、本人あてのデータに出てこないこと。
         まなびのトビラのように同じ選択肢が何度も出るので、「えらんだ文言」は除いて見る */
      const leaked = [];
      const blob = JSON.stringify(c.you);
      const picked = new Set(chosen.map(e => e.opts[e.chosen].t.ja));
      (pub.doorLog || []).forEach(e => e.opts.forEach(o => {
        if (picked.has(o.t.ja)) return;
        if (blob.includes(o.t.ja)) leaked.push(o.t.ja);
      }));
      if (leaked.length)
        throw new Error(`${c.name}: えらんでいない選択肢が本人に届いていた [${leaked.join("、")}]`);
    }
    cs.forEach(c => c.close());
  }
  ok(`4人 × ${talkGames}ゲーム：話し合いマスはちょうど1回・16マス目で起き、ほかの人は通りすぎる`);
  ok(`4人 × ${talkGames}ゲーム：じぶんの選択の記録はえらんだものと一致し、？？？の中身はもれていない`);
}

try {
  await dealTest();
  await soloTest();
  await playAndCheck(8);
  await talkAndMyChoicesTest();
  console.log(`\nOK — ${passed} checks passed`);
  process.exit(0);
} catch (e) {
  console.log("\nFAILED:", e.message);
  process.exit(1);
}
