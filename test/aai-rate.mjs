/* 「ぜんぶ」(36マス)で、遺児家庭の人が留学(AAI)のトビラに出会えない割合を測る。
   トビラのマスに stop:true が無いので、サイコロで飛びこされることがある。 */
const HOST = process.env.HOST || "ws://localhost:8787";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fatal = null;
const room = () => "A" + Math.random().toString(36).slice(2, 7).toUpperCase();

function mk(rm, pid, name) {
  const c = { pid, name, g: null, you: null, auto: null };
  c.ws = new WebSocket(`${HOST}/ws?room=${rm}&pid=${pid}&name=${name}`);
  c.ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t !== "state") return;
    c.g = m.g; c.you = m.you;
    try { if (c.auto) c.auto(c); } catch (e) { fatal = fatal || e; }
  };
  c.ws.onerror = () => { if (!c.dead) fatal = fatal || new Error("ws " + pid); };
  c.send = m => { try { c.ws.send(JSON.stringify(m)); } catch {} };
  c.close = () => { c.dead = true; try { c.ws.onmessage=null; c.ws.onerror=null; c.ws.close(); } catch {} };
  return c;
}
async function waitFor(c, fn, label, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fatal) throw fatal;
    if (c.g && fn(c.g)) return c.g;
    await sleep(15);
  }
  throw new Error("TIMEOUT " + label);
}
const auto = c => {
  const g = c.g;
  if (!g || g.phase !== "play") return;
  const cur = g.players[g.turn];
  if (!cur || cur.id !== c.pid) return;
  const pd = g.pending;
  if (!pd) return c.send({ t: "roll" });
  if (pd.kind === "choice") {
    const open = pd.states.map((s,i) => s === "open" ? i : -1).filter(i => i >= 0);
    return c.send({ t: "choose", i: open[Math.floor(Math.random()*open.length)] });
  }
  c.send({ t: "ok" });
};

const GAMES = Number(process.env.GAMES || 40), N = 4;
let tally = {};   /* 家庭ごと: {met, total} */
let doorCount = [], turnsAll = [];
for (let r = 0; r < GAMES; r++) {
  const rm = room(), cs = [];
  for (let i = 0; i < N; i++) {
    const c = mk(rm, "p"+i, "P"+i);
    await waitFor(c, g => g.players.some(p => p.id === c.pid), "join");
    cs.push(c);
  }
  await waitFor(cs[0], g => g.players.length === N, "そろう");
  cs.forEach(c => { c.auto = auto; });
  cs[0].send({ t: "setmode", mode: "full" });
  await waitFor(cs[0], g => (g.mode||"full") === "full", "mode");
  cs[0].send({ t: "start", heavyOn: false });
  await waitFor(cs[0], g => g.phase === "cards", "cards");
  cs.forEach(c => c.send({ t: "seen" }));
  await waitFor(cs[0], g => g.phase === "play", "play");
  await waitFor(cs[0], g => g.phase === "result", "result", 60000);
  /* 結果発表では、全員の doorLog が g.players に乗って公開される */
  for (const pl of cs[0].g.players) {
    const fam = pl.fam.id;
    const titles = (pl.doorLog || []).map(d => (d.title && d.title.ja) || "");
    const met = titles.includes("留学のトビラ");
    tally[fam] = tally[fam] || { met: 0, total: 0 };
    tally[fam].total++; if (met) tally[fam].met++;
    doorCount.push(titles.filter(t => t.endsWith("のトビラ")).length);
    turnsAll.push((pl.doorLog||[]).length);
  }
  cs.forEach(c => c.close());
}
console.log(`\n「ぜんぶ」36マス・4人×${GAMES}ゲーム＝${GAMES*N}人ぶん\n`);
console.log("留学（AAI）のトビラに出会えた割合:");
const order = ["w1","w2","w3","w4","w5","w6"];
const nm = {w1:"欧米", w2:"日本", w3:"ウガンダ両親あり", w4:"ウガンダ駐在", w5:"遺児(支援あり)", w6:"遺児(支援なし)"};
for (const k of order) {
  const t = tally[k]; if (!t) continue;
  const pc = (t.met/t.total*100).toFixed(0);
  console.log(`  ${nm[k].padEnd(18,"　")} ${String(t.met).padStart(3)}/${String(t.total).padStart(3)}人 = ${pc}%`);
}
const orph = ["w5","w6"].reduce((a,k) => tally[k] ? {met:a.met+tally[k].met, total:a.total+tally[k].total} : a, {met:0,total:0});
console.log(`\n  遺児家庭(w5+w6)だけ: ${orph.met}/${orph.total}人 = ${(orph.met/orph.total*100).toFixed(0)}%`);
console.log(`  → 遺児家庭の ${(100-orph.met/orph.total*100).toFixed(0)}% は、AAIのトビラに一度も出会わないまま35歳になる`);
const avg = (doorCount.reduce((a,b)=>a+b,0)/doorCount.length).toFixed(1);
console.log(`止まったマスの数（手番の目安）: 平均${(turnsAll.reduce((a,b)=>a+b,0)/turnsAll.length).toFixed(1)}回`);
console.log(`\n出会ったトビラの数（9枚のうち）: 平均${avg}枚 / 最少${Math.min(...doorCount)}枚 / 最多${Math.max(...doorCount)}枚`);
process.exit(0);
