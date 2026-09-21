/* 「ぜんぶ」（6〜35歳・36マス・2〜6人）の盤面だけの自動テスト。
   ここで守るのは、ショート版のUIを本番に持ちこむときに壊れやすい4つ:
     1. 35歳のゴールで、のこった奨学金がきちんと一括清算される（ショート版は清算しない）
     2. AAI が「留学のトビラ」（26歳）に出て、カギは★5のまま
     3. 24歳のしごとのトビラに「大学院」が出ない（大学のトビラが盤面に無いので、
        出すとだれも開けられない🔒がひとつ並ぶだけになる）
     4. 2〜6人で、ロビーからゴール・結果発表まで完走できる
   使い方: HOST=ws://localhost:8787 node test/full.mjs */
import * as R from "../public/rules.js";

const HOST = process.env.HOST || "ws://localhost:8787";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, fatal = null;
const ok = label => { passed++; console.log("  ok　" + label); };
const room = () => "F" + Math.random().toString(36).slice(2, 7).toUpperCase();

function mk(rm, pid, name) {
  const c = { pid, name, g: null, you: null, auto: null, watch: null };
  c.ws = new WebSocket(`${HOST}/ws?room=${rm}&pid=${pid}&name=${name}`);
  c.ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t !== "state") return;
    c.g = m.g; c.you = m.you;
    try { if (c.watch) c.watch(c); if (c.auto) c.auto(c); }
    catch (e) { fatal = fatal || e; }
  };
  c.ws.onerror = () => { if (!c.dead) fatal = fatal || new Error("ws error " + pid); };
  c.send = m => { try { c.ws.send(JSON.stringify(m)); } catch {} };
  c.close = () => { c.dead = true; try { c.ws.onmessage = null; c.ws.onerror = null; c.ws.close(); } catch {} };
  return c;
}
async function waitFor(c, fn, label, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fatal) throw fatal;
    if (c.g && fn(c.g)) return c.g;
    await sleep(20);
  }
  throw new Error("TIMEOUT: " + label + " / phase=" + (c.g && c.g.phase));
}
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
/* 貸与型の奨学金をできるだけ引き受けて、ゴール時に残額がある状態を作る */
const seekLoan = (pd, open) => {
  const loan = open.find(i => pd.opts[i].special === "shogakukin");
  if (loan != null) return loan;
  return open[Math.floor(Math.random() * open.length)];
};
/* ロビーの盤面を「ぜんぶ」にしてから始める（既定だが、念のため明示する） */
async function startFull(cs, n) {
  cs[0].send({ t: "setmode", mode: "full" });
  await waitFor(cs[0], g => (g.mode || "full") === "full", "盤面が「ぜんぶ」になる");
  cs[0].send({ t: "start", heavyOn: true });
  await waitFor(cs[0], g => g.phase === "cards", "カード確認へ");
  cs.forEach(c => c.send({ t: "seen" }));
  await waitFor(cs[0], g => g.phase === "play", "プレイ開始");
}

/* ============ 1. 盤面そのもの ============ */
function boardTest() {
  console.log("[1] 盤面が36マス・6章・6歳〜35歳になっている");
  const M = R.mode("full");
  if (M.SQUARES.length !== 36) throw new Error("マス数が36でない: " + M.SQUARES.length);
  if (M.AGES.length !== 36) throw new Error("年齢の数がマス数と合わない: " + M.AGES.length);
  if (M.CHAPTERS.length !== 6) throw new Error("章が6でない: " + M.CHAPTERS.length);
  if (M.AGES[0] !== 6 || M.AGES[35] !== 35) throw new Error("6歳→35歳でない");
  /* 1章＝6マス（章ラベルの位置決めがこれに依存している） */
  if (M.SQUARES.length !== M.CHAPTERS.length * 6) throw new Error("1章＝6マスになっていない");
  ok("36マス・6章・6歳→35歳・1章＝6マス");

  const keys = M.SQUARES.filter(s => s.t === "choice").map(s => s.key);
  const want = ["shinro","kurashi","machi","ginou","shigoto","kaigai","manabinaoshi","chousen","yume"];
  if (keys.join(",") !== want.join(",")) throw new Error("トビラの並びがちがう: " + keys.join(","));
  if (M.SQUARES.some(s => s.t === "talk")) throw new Error("「みんなで話す」マスは本番の盤面には無いはず");
  ok("トビラ9枚が本番の並びのまま／「みんなで話す」マスは無い");
}

/* ============ 2. AAI と 大学院 ============ */
function doorTest() {
  console.log("[2] 留学のトビラ（26歳）のAAIは★5／大学院は出ない");
  const M = R.mode("full");
  const fam = R.FAMILIES.find(f => f.id === "w5");
  const orphan = { fam, perk: "shienPro", hidden: [], learn: 5, money: 100, univ: false };
  const kaigai = R.choiceDef("kaigai", orphan, M);
  const aai = kaigai.opts.find(o => o.special === "aai");
  if (!aai) throw new Error("遺児家庭の留学のトビラにAAIが無い");
  if (aai.req.learn !== 5) throw new Error("AAIのカギが★5でない: ★" + aai.req.learn);
  if (kaigai.title.ja !== "留学のトビラ") throw new Error("扉の名前が「留学のトビラ」でない: " + kaigai.title.ja);
  ok(`遺児家庭の留学のトビラにAAIが出る／カギは★${aai.req.learn}`);

  const other = { fam: R.FAMILIES.find(f => f.id === "w1"), perk: "kinben", hidden: [], learn: 5, money: 100 };
  const plain = R.choiceDef("kaigai", other, M);
  if (plain.opts.some(o => o.special === "aai")) throw new Error("遺児家庭いがいにAAIが出ている");
  if (!plain.variant) throw new Error("遺児家庭いがいの版に variant が無い（トビラ一覧で同名が2つ並ぶ）");
  ok("遺児家庭いがいにはAAIが出ない／一覧で見分ける variant がある");

  for (const p of [orphan, other]) {
    const shigoto = R.choiceDef("shigoto", p, M);
    if (shigoto.opts.some(o => o.req && o.req.univ)) throw new Error("本番の盤面に大学院が出ている");
  }
  ok("24歳のしごとのトビラに大学院が出ない");

  /* chiiki は 挑戦・大きな夢 が受けもつ。まちのトビラに助け合いの輪を足していない */
  const machi = R.choiceDef("machi", other, M);
  if (machi.opts.some(o => o.tag === "chiiki")) throw new Error("まちのトビラに助け合いの輪が出ている（本番では挑戦・大きな夢が受けもつ）");
  const chiikiDoors = M.SQUARES.filter(s => s.t === "choice")
    .filter(s => R.choiceDef(s.key, other, M).opts.some(o => o.tag === "chiiki"));
  if (!chiikiDoors.length) throw new Error("chiiki タグの選択肢が盤面にひとつも無い（？？？に一度も出会えない）");
  ok(`助け合い（chiiki）は ${chiikiDoors.map(s => s.name.ja).join("・")} が受けもつ`);
}

/* ============ 3. 35歳ゴールでの奨学金の一括清算 ============ */
async function loanTest() {
  console.log("[3] 35歳のゴールで、のこった奨学金が一括清算される");
  /* 貸与型の奨学金を引き受けられるのは、15歳の時点で shien が見えていて
     おかねが150万以下の人だけ（＝ほぼ w5「支援と出会えた遺児家庭」か、
     とちゅうで支援と出会えた人）。だれが配られるかは毎回変わるので、
     2人ぶん見つかるまで回して、見つからなければ落とす。 */
  let settled = 0, withLoan = 0;
  for (let r = 0; r < 10 && withLoan < 2; r++) {
    const rm = room();
    const cs = await joinAll(rm, 3);
    /* ゴールの直前の持ちものを覚えておく（清算のぶんが引かれる前） */
    const before = {};
    cs.forEach(c => {
      c.watch = cc => {
        const pd = cc.g && cc.g.pending;
        if (pd && pd.kind === "goal" && pd.for === cc.pid && before[cc.pid] == null) {
          const me = cc.g.players.find(p => p.id === cc.pid);
          before[cc.pid] = { money: me.money, loan: pd.loan };
        }
      };
      c.auto = autoPlay(seekLoan);
    });
    await startFull(cs, 3);
    await waitFor(cs[0], g => g.phase === "result", "結果発表まで完走", 60000);
    for (const c of cs) {
      const me = cs[0].g.players.find(p => p.id === c.pid);
      const b = before[c.pid];
      if (!b) throw new Error("ゴールの直前をつかめなかった");
      if (b.loan > 0) {
        withLoan++;
        if (me.loan !== 0) throw new Error(`${me.name}: 清算後も残額がある（${me.loan}万）`);
        if (me.money !== b.money - b.loan)
          throw new Error(`${me.name}: 清算の額が合わない（ゴール前${b.money}万 − 残債${b.loan}万 ≠ ${me.money}万）`);
        settled++;
      } else if (me.loan !== 0) {
        throw new Error(`${me.name}: 借りていないのに残額がある`);
      }
    }
    cs.forEach(c => c.close());
  }
  if (withLoan < 2) throw new Error(`奨学金を借りた人が${withLoan}人しか出ず、清算を確かめきれなかった`);
  ok(`奨学金を借りた ${withLoan}人ぶん：35歳でおかねから残額が引かれ、残債0になった`);
}

/* ============ 4. 2〜6人で完走 ============ */
async function playTest() {
  console.log("[4] 2〜6人で、ロビーから結果発表まで完走する");
  for (const n of [2, 4, 6]) {
    const rm = room();
    const cs = await joinAll(rm, n);
    cs.forEach(c => { c.auto = autoPlay(null); });
    await startFull(cs, n);
    const g = await waitFor(cs[0], gg => gg.phase === "result", n + "人で完走", 60000);
    const ages = g.players.map(p => R.mode("full").AGES[p.pos]);
    if (ages.some(a => a !== 35)) throw new Error("35歳でゴールしていない人がいる: " + ages.join(","));
    ok(`${n}人：全員が35歳までたどり着いた（♥ ${g.players.map(p => p.happy).join("/")}）`);
    cs.forEach(c => c.close());
  }
  /* 上限をこえて入れないこと */
  const rm = room();
  const cs = await joinAll(rm, 6);
  const extra = mk(rm, "p6", "P6");
  await sleep(400);
  if (cs[0].g.players.length !== 6) throw new Error("7人目が入ってしまった");
  ok("7人目は入れない（上限6人）");
  extra.close(); cs.forEach(c => c.close());
}

(async () => {
  try {
    boardTest();
    doorTest();
    await loanTest();
    await playTest();
    console.log(`\nOK — ${passed} checks passed`);
    process.exit(0);
  } catch (e) {
    console.log("\nFAILED: " + (e && e.message));
    process.exit(1);
  }
})();
