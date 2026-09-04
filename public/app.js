/* ===== トビラ せかい版 オンライン — クライアント =====
   判定はすべてサーバー(Durable Object)が行う。ここは表示と入力だけを担当する。 ===== */
import * as R from "./rules.js";

/* ---------- i18n ---------- */
let lang = localStorage.getItem("tobira-lang") || "ja";
const L = v => (v && typeof v === "object" && v.ja !== undefined) ? v[lang] : v;
const fm = n => lang === "ja" ? `${n}万` : `${n < 0 ? "-" : ""}¥${(Math.abs(n) * 10).toLocaleString("en-US")}k`;
const fage = n => lang === "ja" ? `${n}歳` : `Age ${n}`;
const ja = () => lang === "ja";
const $ = id => document.getElementById(id);

/* ---------- 通信 ---------- */
let ws = null, G = null, YOU = null, MYPID = null, ROOM = null, retry = 0;
let shown = {};            /* コマの表示位置（1マスずつ動かすため） */
let lastKey = "";          /* 同じモーダルを描き直さないための署名 */
let animTimer = null;

function myId() {
  /* 同じ端末の別タブでも別プレイヤーになれるよう、まずタブ内(sessionStorage)を見る。
     ?pid= を付けると固定できる（同じ端末で複数人が遊ぶとき・テスト用） */
  const forced = new URLSearchParams(location.search).get("pid");
  if (forced) { sessionStorage.setItem("tobira-pid", forced); return forced; }
  let id = sessionStorage.getItem("tobira-pid") || localStorage.getItem("tobira-pid");
  if (!id) id = crypto.randomUUID();
  sessionStorage.setItem("tobira-pid", id);
  localStorage.setItem("tobira-pid", id);
  return id;
}
function connect(code, name) {
  ROOM = code;
  localStorage.setItem("tobira-room", code);
  localStorage.setItem("tobira-name", name);
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws?room=${encodeURIComponent(code)}&pid=${encodeURIComponent(myId())}&name=${encodeURIComponent(name)}`);
  ws.onopen = () => { retry = 0; $("connMsg").textContent = ""; };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === "state") { MYPID = m.pid; G = m.g; YOU = m.you; window.__tobira.msgs++; render(); }
  };
  ws.onclose = () => {
    if (!ROOM) return;
    $("connMsg").textContent = ja() ? "接続が切れました。つなぎ直しています…" : "Disconnected. Reconnecting…";
    setTimeout(() => connect(code, name), Math.min(1000 * ++retry, 5000));
  };
  ws.onerror = () => {};
}
const send = m => { try { ws && ws.readyState === 1 && ws.send(JSON.stringify(m)); } catch {} };

/* ---------- 画面切り替え ---------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}
function openModal(html, watching) {
  $("modalBox").className = "modal" + (watching ? " watching" : "");
  $("modalBox").innerHTML = html;
  $("overlay").classList.add("open");
  $("modalBox").scrollTop = 0;
}
function closeModal() { $("overlay").classList.remove("open"); $("modalBox").innerHTML = ""; lastKey = ""; }
const isOpen = () => $("overlay").classList.contains("open");

/* ---------- ロビー ---------- */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   /* まぎらわしい文字は除く */
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
const nameOf = () => ($("nameInput").value.trim() || (ja() ? "プレイヤー" : "Player")).slice(0, 12);

$("createBtn").onclick = () => connect(newCode(), nameOf());
$("joinBtn").onclick = () => {
  const c = $("codeInput").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(c)) { $("connMsg").textContent = ja() ? "コードを入れてください" : "Enter a room code"; return; }
  connect(c, nameOf());
};
$("startBtn").onclick = () => send({ t: "start", heavyOn: $("heavyToggle").checked });
$("againBtn").onclick = () => send({ t: "again" });
$("diceBtn").onclick = () => send({ t: "roll" });
$("cardBtn").onclick = () => { if (!isOpen() && YOU) showCard(true); };
$("helpBtnGame").onclick = () => { if (!isOpen()) renderRules(0); };
$("hostBtn").onclick = () => { if (hostOpen()) closeHost(); else renderHostPanel(); };
$("claimBtn").onclick = () => send({ t: "claimHost" });

/* ---------- 言語 ---------- */
function applyLang() {
  document.documentElement.lang = ja() ? "ja" : "en";
  document.title = ja() ? "トビラ せかい版 オンライン" : "TOBIRA World Online";
  $("langJa").classList.toggle("on", ja());
  $("langEn").classList.toggle("on", !ja());
  $("gameSub").textContent = ja() ? "🌍 せかい版 オンライン ─ みんなの端末で遊ぶ（2〜6人）" : "🌍 World Edition Online — play on your own devices (2–6)";
  $("nameInput").placeholder = ja() ? "なまえ" : "Your name";
  $("createBtn").textContent = ja() ? "ルームをつくる" : "Create a room";
  $("joinNote").textContent = ja() ? "または、進行役から聞いたコードで参加：" : "Or join with the code from your host:";
  $("joinBtn").textContent = ja() ? "ルームに参加" : "Join room";
  $("lobbyNote").innerHTML = ja()
    ? "1台ずつ、自分の端末で開いてください。<br><b>家庭カードは、自分にしか見えません。</b>"
    : "Open this on your own device.<br><b>Your family card is visible only to you.</b>";
  $("waitTitle").textContent = ja() ? "まっています" : "Waiting";
  $("codeLabel").textContent = ja() ? "あいことば" : "Room code";
  $("shareNote").textContent = ja() ? "このコードを、いっしょに遊ぶ人に伝えてください。" : "Share this code with the other players.";
  $("heavyLabel").innerHTML = ja()
    ? "⚠️ 死別・干ばつなどのライフイベントを含める<br><small>ファシリテーター向け設定。参加者の状況にあわせてONにしてください。</small>"
    : "⚠️ Include loss & disaster life events<br><small>For facilitators. Turn on when it suits your group.</small>";
  $("startBtn").textContent = ja() ? "ゲーム開始" : "Start game";
  $("cardBtnLabel").textContent = ja() ? "カード" : "Card";
  $("cardBtn").setAttribute("aria-label", ja() ? "自分の家庭カードを見る" : "See my family card");
  $("logoTxt").textContent = ja() ? "🌍 トビラ" : "🌍 TOBIRA";
  $("resTitle").textContent = ja() ? "🎉 けっか はっぴょう" : "🎉 Results";
  $("resSub").textContent = ja()
    ? "6歳から35歳、29年間のけっか。順位は「ハッピー」の数で決まります — そして、家庭カードの公開"
    : "29 years, from age 6 to 35. Ranking is decided by ♥ Happiness — and the Family Cards are revealed";
  $("allDoorsBtn").textContent = ja() ? "🚪 29年間のトビラ一覧を見る" : "🚪 See all doors of the 29 years";
  $("againBtn").textContent = ja() ? "もういちど遊ぶ" : "Play again";
  if (G) render();
}
$("langJa").onclick = () => { lang = "ja"; localStorage.setItem("tobira-lang", lang); applyLang(); };
$("langEn").onclick = () => { lang = "en"; localStorage.setItem("tobira-lang", lang); applyLang(); };

/* ---------- 盤面 ---------- */
const mqMobile = window.matchMedia("(max-width:640px)");
const boardCols = () => mqMobile.matches ? 3 : 6;
function gridPos(i) {
  const cols = boardCols();
  const row = Math.floor(i / cols);
  return { row, col: (row % 2 === 0) ? (i % cols) : (cols - 1 - (i % cols)) };
}
function renderBoard() {
  const b = $("board");
  b.innerHTML = "";
  const cols = boardCols(), rpc = 6 / cols;
  b.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  R.CHAPTERS.forEach((c, r) => {
    const lab = document.createElement("div");
    lab.className = "chapter";
    lab.style.gridRow = r * (rpc + 1) + 1;
    lab.style.gridColumn = "1 / -1";
    lab.innerHTML = L(c.t) + (c.note ? `<span class="ch-note">${L(c.note)}</span>` : "")
      + `<span class="ch-dir">${r % 2 === 0 ? (ja() ? "みぎへ ▶" : "RIGHT ▶") : (ja() ? "◀ ひだりへ" : "◀ LEFT")}</span>`;
    b.appendChild(lab);
  });
  R.SQUARES.forEach((sq, i) => {
    const m = R.TYPE_META[sq.t];
    const el = document.createElement("div");
    el.className = `sq t-${sq.t}`;
    el.id = `sq-${i}`;
    const { row, col } = gridPos(i);
    const chap = Math.floor(i / 6);
    el.style.gridRow = chap * (rpc + 1) + (row - chap * rpc) + 2;
    el.style.gridColumn = col + 1;
    const age = (sq.t === "choice" || sq.t === "start" || sq.t === "goal") ? `<span class="num">${ja() ? R.AGES[i] + "歳" : R.AGES[i]}</span>` : "";
    el.innerHTML = `${age}<span class="ic">${m.ic}</span><span>${L(sq.name) || L(m.label)}</span><div class="tokens"></div>`;
    b.appendChild(el);
  });
}
mqMobile.addEventListener("change", () => { renderBoard(); renderTokens(); });

function renderTokens() {
  document.querySelectorAll(".sq .tokens").forEach(t => t.innerHTML = "");
  if (!G) return;
  G.players.forEach((p, idx) => {
    const pos = shown[p.id] != null ? shown[p.id] : p.pos;
    const holder = document.querySelector(`#sq-${pos} .tokens`);
    if (!holder) return;
    const tk = document.createElement("span");
    tk.className = "tok" + (idx === G.turn && !p.done ? " now" : "");
    tk.id = `tok-${p.id}`;
    tk.innerHTML = `<svg viewBox="0 0 24 26">
      <circle cx="12" cy="7" r="5.5" fill="${p.color}" stroke="#4A3A30" stroke-width="2"/>
      <path d="M12 13.5c-5.2 0-8.5 3.6-8.5 8.5V24h17v-2c0-4.9-3.3-8.5-8.5-8.5z" fill="${p.color}" stroke="#4A3A30" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
    holder.appendChild(tk);
  });
}
/* サーバーが決めた位置まで、1マスずつ歩かせる。
   表示が失敗しても進行を止めないよう、必ず終了して次のモーダルを出す */
function stepAnim() {
  if (animTimer || !G) return;
  const behind = () => G.players.some(p => (shown[p.id] == null ? p.pos : shown[p.id]) !== p.pos);
  if (!behind()) return;
  let guard = 0;
  animTimer = setInterval(() => {
    try {
      guard++;
      G.players.forEach(p => {
        if (shown[p.id] == null) shown[p.id] = p.pos;
        if (shown[p.id] < p.pos) shown[p.id]++;
        else if (shown[p.id] > p.pos) shown[p.id] = p.pos;
      });
      renderTokens();
      const cur = G.players[G.turn];
      if (cur && shown[cur.id] != null) focusSquare(shown[cur.id]);
    } catch (e) {
      console.log("anim error", e);
    } finally {
      if (!behind() || guard > 40) {
        clearInterval(animTimer); animTimer = null;
        renderPending();
      }
    }
  }, 200);
}
function focusSquare(pos) {
  const el = $(`sq-${pos}`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const wrap = document.querySelector(".board-wrap");
  if (wrap) {
    const wr = wrap.getBoundingClientRect();
    wrap.scrollTo({ left: Math.max(0, wrap.scrollLeft + (r.left - wr.left) - (wrap.clientWidth - r.width) / 2), behavior: "auto" });
  }
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - (window.innerHeight - r.height) / 2), behavior: "smooth" });
}

function renderStrip() {
  const s = $("playersStrip");
  s.innerHTML = "";
  G.players.forEach((p, i) => {
    const c = document.createElement("div");
    c.className = "pcard" + (i === G.turn ? " now" : "") + (p.done ? " done" : "")
      + (p.connected ? "" : " off") + (p.left ? " left" : "");
    c.innerHTML = `
      <div class="nm"><span class="p-dot" style="background:${p.color}"></span>${p.name}${p.id === MYPID ? `<span class="mine-badge">${ja() ? "あなた" : "you"}</span>` : ""}${p.left ? " 🚪" : (p.done ? " 🏁" : "")}<span class="age">${fage(R.AGES[p.pos])}</span></div>
      <div class="stat"><span>${ja() ? "おかね" : "Money"}</span><b class="${p.money < 0 ? "neg" : ""}">${fm(p.money)}</b></div>
      <div class="stat"><span>${ja() ? "まなび" : "Learn"}</span><b>${"★".repeat(Math.min(p.learn, 8))}${p.learn > 8 ? "+" : ""}</b></div>
      <div class="stat"><span>${ja() ? "ハッピー" : "Happy"}</span><b>♥${p.happy}</b></div>`;
    s.appendChild(c);
  });
}

/* ---------- 進行役パネル ----------
   ゲームのモーダルとは別のオーバーレイを使う（できごとの表示と取り合わない） */
function openHost(html) {
  $("hostBox").innerHTML = html;
  $("hostOverlay").classList.add("open");
  document.body.classList.add("host-open");
}
function closeHost() {
  $("hostOverlay").classList.remove("open");
  $("hostBox").innerHTML = "";
  document.body.classList.remove("host-open");
}
const hostOpen = () => $("hostOverlay").classList.contains("open");
const iAmHost = () => !!G && MYPID === G.hostId;
const ask = t => window.confirm(L(t));

function renderHostPanel() {
  if (!G || !iAmHost()) { closeHost(); return; }
  const cur = G.phase === "play" ? G.players[G.turn] : null;
  const rows = G.players.map(p => {
    const tags = [];
    if (p.id === G.hostId) tags.push(ja() ? "👑 進行役" : "👑 host");
    if (cur && p.id === cur.id) tags.push(ja() ? "🎲 いまの手番" : "🎲 current turn");
    if (p.left) tags.push(ja() ? "🚪 退出" : "🚪 left");
    else if (p.done) tags.push("🏁");
    return `<div class="host-row${p.connected ? "" : " off"}">
      <span class="hn"><span class="p-dot" style="background:${p.color}"></span>${p.name}
        <span class="st">${p.connected ? "🟢" : (ja() ? "⚪️ 切断中" : "⚪️ offline")}</span></span>
      ${tags.map(t => `<span class="tag">${t}</span>`).join("")}
      ${p.id === MYPID || p.left ? "" : `<button class="host-act" data-pass="${p.id}">${ja() ? "👑 ゆずる" : "👑 make host"}</button>
      <button class="host-act danger" data-kick="${p.id}">${ja() ? "外す" : "Remove"}</button>`}
    </div>`;
  }).join("");

  const btns = [];
  if (G.phase === "cards") btns.push(`<button class="host-act" id="hForce">${ja()
    ? "▶ まだの人を待たずに始める" : "▶ Start without the ones still looking"}</button>`);
  if (G.phase === "play" && cur) btns.push(`<button class="host-act" id="hSkip">${ja()
    ? `⏭ ${cur.name} さんの番をとばす` : `⏭ Skip ${cur.name}'s turn`}</button>`);
  btns.push(`<button class="host-act danger" id="hReset">${ja()
    ? "↩ ロビーにもどす" : "↩ Back to the lobby"}</button>`);

  openHost(`<div class="rule-page">
    <button class="rule-close" id="hClose">✕</button>
    <span class="m-tag" style="background:var(--brown)">🛠 ${ja() ? "進行役メニュー" : "Host tools"}</span>
    <h2>${ja() ? "進行がとまったとき" : "When the game gets stuck"}</h2>
    <div class="host-note">${ja()
      ? "端末が落ちた・席を外した・まちがえて入った——そんなときだけ使ってください。<br>ゲームの中身は変わりません。"
      : "Only for when a device dies, someone steps out, or joins by mistake.<br>None of this changes the game itself."}</div>
    <div class="host-list">${rows}</div>
    <div class="host-btns">${btns.join("")}</div>
  </div>`);

  $("hClose").onclick = closeHost;
  $("hostBox").querySelectorAll("[data-kick]").forEach(b => b.onclick = () => {
    const p = G.players.find(x => x.id === b.dataset.kick) || { name: "" };
    if (!ask(G.phase === "lobby"
      ? { ja: `${p.name} さんを名簿から外します。よろしいですか？`, en: `Remove ${p.name} from the room. Are you sure?` }
      : { ja: `${p.name} さんを、ここから先の進行から外します（けっか発表にも出ません）。よろしいですか？`,
          en: `${p.name} will be dropped from the rest of the game (and from the results). Are you sure?` })) return;
    send({ t: "kick", id: b.dataset.kick });
  });
  $("hostBox").querySelectorAll("[data-pass]").forEach(b => b.onclick = () => {
    const p = G.players.find(x => x.id === b.dataset.pass) || { name: "" };
    if (!ask({ ja: `進行役を ${p.name} さんにゆずります。よろしいですか？`, en: `Hand the host role to ${p.name}. Are you sure?` })) return;
    send({ t: "passHost", id: b.dataset.pass });
  });
  if ($("hForce")) $("hForce").onclick = () => {
    const left = G.players.filter(p => !p.seen).map(p => p.name).join(ja() ? "、" : ", ");
    if (!ask({ ja: `まだカードを見ていない人（${left}）を待たずに始めます。よろしいですか？`,
               en: `Start without those who haven't opened their card (${left}). Are you sure?` })) return;
    send({ t: "forceCards" }); closeHost();
  };
  if ($("hSkip")) $("hSkip").onclick = () => {
    if (!ask({ ja: `${cur.name} さんの番をとばして、次の人にすすみます。よろしいですか？`,
               en: `Skip ${cur.name}'s turn and move on. Are you sure?` })) return;
    send({ t: "skipTurn" }); closeHost();
  };
  $("hReset").onclick = () => {
    if (!ask({ ja: "いまのゲームをやめて、ロビーにもどります。とちゅうの結果は消えます。よろしいですか？",
               en: "End this game and return to the lobby. Progress will be lost. Are you sure?" })) return;
    send({ t: "reset" }); closeHost();
  };
}

/* ---------- モーダル部品 ---------- */
function fxChips(fx) {
  const parts = [];
  if (fx.money) parts.push(`<span class="fx" style="color:${fx.money > 0 ? "#5a9114" : "#d24a3c"}">${fx.money > 0 ? "+" : ""}${fm(fx.money)}</span>`);
  if (fx.learn) parts.push(`<span class="fx" style="color:#00A3BD">${ja() ? "まなび" : "Learn"} +${fx.learn}</span>`);
  if (fx.happy) parts.push(`<span class="fx" style="color:#F291B5">♥ +${fx.happy}</span>`);
  if (!parts.length) parts.push(`<span class="fx">${ja() ? "変化なし" : "No change"}</span>`);
  return `<div class="fx-line">${parts.join("")}</div>`;
}
function reqLabel(p, o) {
  const parts = [];
  const em = R.effectiveMoneyReq(p, o), el = R.effectiveLearnReq(p, o);
  if (o.req.money) {
    const memo = [];
    if (p.shienDiscount && (o.tag === "shien" || o.tag === "manabi")) memo.push(ja() ? "🎗支援サポートで−50万" : `🎗aid support −${fm(50)}`);
    if (p.perk === "kokusai" && o.tag === "global") memo.push(ja() ? "🌏国際感覚で−50万" : `🌏global sense −${fm(50)}`);
    parts.push(`${ja() ? "おかね" : "Money"} ${fm(em)}` + (memo.length ? `（${memo.join("・")}）` : ""));
  }
  if (o.req.learn) parts.push(`${ja() ? "まなび" : "Learn"} ★${el}` + (el < o.req.learn ? (ja() ? "（🗣英語ネイティブで−2）" : "（🗣native English −2）") : ""));
  if (o.req.maxMoney != null) parts.push(ja() ? `所得制限 おかね${fm(o.req.maxMoney)}未満` : `Income limit: under ${fm(o.req.maxMoney)}`);
  return parts.join(" ＋ ");
}
const waitingNote = who => `<div class="waiting-note">⏳ ${ja() ? `${who} さんが かくにん中…` : `Waiting for ${who}…`}</div>`;
/* 見ているだけのときは、自分の番とはっきり見た目を変える */
const watchHead = a => `<div class="watch-head"><span class="p-dot" style="background:${a.color}"></span>${
  ja() ? `${a.name} さんの番を見ています` : `Watching ${a.name}'s turn`}</div>`;
const privNote = v => (v && (!Array.isArray(v) || v.length))
  ? `<div class="m-note priv">${(Array.isArray(v) ? v.map(L).join("<br>") : L(v))}</div>` : "";

/* ---------- 保留中のできごと（サーバーから来る） ---------- */
function renderPending() {
  const pd = G.pending;
  if (!pd) { if (isOpen() && lastKey) closeModal(); return; }
  if (animTimer) return;                       /* コマが動き終わってから出す */
  const key = JSON.stringify(pd);
  if (key === lastKey && isOpen()) return;
  lastKey = key;
  const mine = pd.for === MYPID;
  const actor = G.players.find(p => p.id === pd.for) || { name: "?" };
  const m = R.TYPE_META[pd.type === "learn" ? "learn" : (pd.type === "heavy" ? "heavy" : (pd.type === "event" ? "event" : "choice"))];

  if (pd.kind === "info") {
    const mm = R.TYPE_META[pd.type] || m;
    openModal(`${mine ? "" : watchHead(actor)}
      <span class="m-tag" style="background:${mm.tag}">${mm.ic} ${L(mm.label)}</span>
      <h2>${L(pd.title)}</h2>
      <p class="m-body">${L(pd.body)}</p>
      ${pd.note ? `<div class="m-note">${L(pd.note)}</div>` : ""}
      ${privNote(pd.pnote)}
      ${fxChips(pd.fx)}
      ${mine ? `<button class="m-btn" id="mOk">OK</button>` : waitingNote(actor.name)}`, !mine);
    if (mine) $("mOk").onclick = () => { send({ t: "ok" }); };
  }
  else if (pd.kind === "result") {
    openModal(`${mine ? "" : watchHead(actor)}
      <span class="m-tag" style="background:${m.tag}">${m.ic} ${mine
        ? (ja() ? "えらんだ！" : "Chosen!")
        : (ja() ? `${actor.name} さんが えらんだ` : `${actor.name} chose`)}</span>
      <h2>${L(pd.title)}</h2>
      <p class="m-body">${L(pd.body)}${ja() ? "。" : "."}</p>
      ${pd.notes && pd.notes.length ? `<div class="m-note">${pd.notes.map(L).join("<br>")}</div>` : ""}
      ${privNote(pd.pnotes)}
      ${fxChips(pd.fx)}
      ${mine ? `<button class="m-btn" id="mOk">OK</button>` : waitingNote(actor.name)}`, !mine);
    if (mine) $("mOk").onclick = () => { send({ t: "ok" }); };
  }
  else if (pd.kind === "choice" && !mine) {
    /* 何が見えていて何が見えていないかは、その人だけのもの。
       ほかの人には、トビラの名前（盤面に出ているもの）と「待っている」ことだけを見せる */
    openModal(`${watchHead(actor)}
      <div class="watch-body">
        <p class="watch-lead">${ja() ? "いま、このトビラの前に立っています。" : "Standing in front of this door."}</p>
        <div class="watch-door">${pd.def.heavy ? "⚠️" : "🚪"} ${L(pd.def.title)}</div>
        <div class="watch-wait">⏳ ${ja() ? `${actor.name} さんが えらんでいます…` : `${actor.name} is choosing…`}</div>
        <p class="watch-lead">${ja() ? "えらび終わったら、みんなに結果が出ます。" : "The result appears for everyone once they choose."}</p>
      </div>`, true);
  }
  else if (pd.kind === "choice") {
    const p = pd.actor;
    const doors = R.shuffle(pd.opts.map((_, i) => i)).map(i => {
      const o = pd.opts[i], st = pd.states[i];
      if (st === "unseen") return `<button class="door unseen" disabled>
        <span class="d-icon">❓</span><span class="d-main">
          <span class="d-title">？？？</span>
          <span class="d-desc">${ja() ? "この選択肢は、見えない。" : "You can't see this option."}</span></span></button>`;
      const key2 = reqLabel(p, o), ok = st === "open";
      const em = R.effectiveMoneyReq(p, o), raw = o.fx.money || 0, efx = R.effectiveMoneyFx(p, o);
      const cut = efx !== raw, redundant = o.req.money && efx === -em;
      const loan = o.special === "shogakukin" && !(p.shienDiscount || p.perk === "shienPro");
      const cost = ((efx || cut) && !redundant)
        ? `<span class="d-key d-cost ${efx < 0 ? "minus" : "plus"}">${cut ? "🎗" : (efx < 0 ? "💸" : "💰")} ${ja() ? "おかね" : "Money"} ${cut ? `<s>${fm(raw)}</s>→` : ""}${efx > 0 ? "+" : ""}${fm(efx)}${loan ? (ja() ? "＋返済" : " + repayment") : ""}</span>` : "";
      const short = o.req.maxMoney != null && p.money >= o.req.maxMoney
        ? (ja() ? "（対象外…）" : " (not eligible…)") : (ja() ? "（たりない…）" : " (not enough…)");
      return `<button class="door" data-i="${i}" ${ok && mine ? "" : "disabled"}>
        <span class="d-icon">${ok ? "🚪" : "🔒"}</span>
        <span class="d-main">
          <span class="d-title">${L(o.t)}</span>
          <span class="d-desc">${L(o.d)}</span>
          ${key2 ? `<span class="d-key">${ja() ? "カギ：" : "Key: "}${key2}${ok ? "" : short}</span>` : ""}${cost}
        </span></button>`;
    }).join("");
    const stuck = !(pd.states || []).includes("open");
    openModal(`
      <span class="m-tag" style="background:${m.tag}">${m.ic} ${pd.def.heavy ? L(R.TYPE_META.heavy.label) : L(m.label)}</span>
      <h2>${L(pd.def.title)}</h2>
      <p class="m-body">${L(pd.def.body)}<br>${ja()
        ? `<b>${p.name}</b> さん（${R.AGES[p.pos]}歳）：おかね ${fm(p.money)} ／ まなび ★${p.learn}`
        : `<b>${p.name}</b> (Age ${R.AGES[p.pos]}): Money ${fm(p.money)} / Learn ★${p.learn}`}</p>
      <div class="door-list">${doors}</div>
      ${stuck && mine ? `<div class="m-note" style="margin-top:14px">${ja() ? "開けられるトビラが、ひとつもなかった…。" : "Not a single door would open…"}</div>
        <button class="m-btn" id="mPass">${ja() ? "今回は見送る" : "Pass this time"}</button>` : ""}
      ${mine ? "" : waitingNote(actor.name)}`);
    if (stuck && mine && $("mPass")) $("mPass").onclick = () => send({ t: "choose", i: -1, pass: true });
    if (mine) document.querySelectorAll("#modalBox .door:not(:disabled)").forEach(b => {
      b.onclick = () => send({ t: "choose", i: +b.dataset.i });
    });
  }
  else if (pd.kind === "goal") {
    const loanNote = pd.loan > 0
      ? `<div class="m-note">${ja() ? `🎓 のこっていた奨学金 <b>${fm(pd.loan)}</b> をここで清算。<br>35歳——ようやく、返しおえた。`
        : `🎓 The remaining scholarship (<b>${fm(pd.loan)}</b>) is settled here.<br>Age 35 — finally paid off.`}</div>` : "";
    openModal(`${mine ? "" : watchHead(actor)}
      <span class="m-tag" style="background:#4A3A30">🏁 ${L(R.TYPE_META.goal.label)}</span>
      <h2>${ja() ? `${actor.name} さん、35歳でゴール！` : `${actor.name} reached the goal at 35!`}</h2>
      <p class="m-body">${ja() ? `6歳からの29年間、おつかれさま！ ${pd.rankAt}番目のゴールです。` : `29 years from age 6 — well done! Finished #${pd.rankAt}.`}</p>
      ${loanNote}${fxChips(pd.fx)}
      ${mine ? `<button class="m-btn" id="mOk">OK</button>` : waitingNote(actor.name)}`, !mine);
    if (mine) $("mOk").onclick = () => send({ t: "ok" });
  }
}

/* ---------- 家庭カード（自分のぶんだけ） ---------- */
function showCard(review) {
  if (!YOU) return;
  const p = YOU, hiddenN = p.hidden.length;
  const me = G.players.find(x => x.id === MYPID) || { money: p.fam.money, name: "" };
  lastKey = "card";
  openModal(`
    <span class="m-tag" style="background:${R.TYPE_META.fam.tag}">🏠 ${L(R.TYPE_META.fam.label)}</span>
    <div class="fam-card">
      <div class="f-name">${L(p.fam.name)}</div>
      <div class="f-story">${L(p.fam.story)}</div>
      <div class="f-story f-asa">🌅 <b>${ja() ? "あなたの朝" : "Your morning"}</b>：${L(p.fam.asa)}</div>
      <div class="f-stats">
        <span class="fs-money">💰 ${ja() ? "いまのおかね" : "Money now"}：<b>${fm(me.money)}</b></span>
        <span class="fs-daily">🍚 ${ja() ? "1日の生活費" : "Daily living cost"}：<b>${L(p.fam.daily)}</b>${p.fam.dailyNote ? "（" + L(p.fam.dailyNote) + "）" : ""}</span>
        <span class="fs-wage">💼 ${ja() ? "おしごとの基本給" : "Base pay"}：<b>${fm(p.fam.wage)}</b>（${ja() ? "＋まなび×" : "＋Learn×"}<b>${fm(p.mult)}</b>）</span>
        <span class="fs-allow">📮 ${ja() ? "仕送り" : "Allowance"}：<b>${p.allow > 0 ? (ja() ? "毎回のかせぎ +" + fm(p.allow) : "+" + fm(p.allow) + " per payday") : (ja() ? "なし" : "none")}</b></span>
        <span class="fs-region">🌍 ${ja() ? "生まれた場所" : "Born in"}：<b>${L(p.fam.region)}</b></span>
        <span class="fs-hidden">👁 ${ja() ? "まだ見えていない選択肢" : "Options you can't see yet"}：<b>${hiddenN}${ja() ? "個" : ""}</b>${hiddenN > 0 ? (ja() ? "（そのマスでは「？？？」と表示されます）" : " (shown as ？？？ on those squares)") : ""}</span>
        <span class="fs-perk">✨ ${ja() ? "とくい" : "Strength"}：<b>${L(p.fam.perkText)}</b></span>
      </div>
    </div>
    <p class="m-body" style="font-size:13px; opacity:.8">${ja() ? "🔒 このカードは、あなたの端末にしか表示されません。" : "🔒 This card is shown only on your device."}</p>
    <button class="m-btn" id="mCard">${review ? (ja() ? "とじる" : "Close") : (ja() ? "OK、覚えた" : "Got it")}</button>`);
  $("mCard").onclick = () => { closeModal(); if (!review) send({ t: "seen" }); };
}

/* ---------- 描画のふりわけ ---------- */
function render() {
  if (!G) return;
  if (G.phase === "lobby") {
    showScreen("wait");
    $("roomCode").textContent = ROOM || "------";
    const host = MYPID === G.hostId;
    $("heavyWrap").style.display = host ? "" : "none";
    $("startBtn").style.display = host ? "" : "none";
    $("waitNote").textContent = host
      ? (G.players.length < 2 ? (ja() ? "あと1人以上の参加を待っています" : "Waiting for at least one more player") : (ja() ? "全員そろったら開始してください" : "Start when everyone is in"))
      : (ja() ? "進行役が開始するのを待っています…" : "Waiting for the host to start…");
    $("waitList").innerHTML = G.players.map(p =>
      `<div class="p-row wait-row"><span class="p-dot" style="background:${p.color}"></span>
       <span style="flex:1; font-weight:700">${p.name}${p.id === MYPID ? `<span class="mine-badge">${ja() ? "あなた" : "you"}</span>` : ""}${p.id === G.hostId ? " 👑" : ""}</span>
       <span class="st">${p.connected ? "🟢" : "⚪️"}</span>
       ${host && p.id !== MYPID ? `<button class="rm" data-kick="${p.id}" aria-label="remove">✕</button>` : ""}</div>`).join("");
    $("waitList").querySelectorAll("[data-kick]").forEach(b => b.onclick = () => {
      const p = G.players.find(x => x.id === b.dataset.kick) || { name: "" };
      if (!ask({ ja: `${p.name} さんを名簿から外します。よろしいですか？`, en: `Remove ${p.name} from the room. Are you sure?` })) return;
      send({ t: "kick", id: b.dataset.kick });
    });
    /* 進行役の端末が落ちて戻ってこないとき、残った人が引きつげる */
    const hostP = G.players.find(p => p.id === G.hostId);
    $("claimWrap").style.display = (!host && hostP && !hostP.connected) ? "" : "none";
    $("claimBtn").textContent = ja() ? `👑 進行役を引きつぐ（${hostP ? hostP.name : ""} さんが切断中）` : `👑 Take over as host (${hostP ? hostP.name : ""} is offline)`;
    closeModal(); closeHost();
  }
  else if (G.phase === "cards") {
    showScreen("game");
    hostTools();
    renderBoard(); renderStrip(); shown = {}; renderTokens();
    $("turnPill").innerHTML = `<span class="tp-txt">${ja() ? "🏠 家庭カードをかくにん中" : "🏠 Checking family cards"}</span>`;
    $("diceBtn").disabled = true;
    $("diceLabel").textContent = ja() ? "まっています" : "Waiting";
    $("diceFace").style.display = "none";
    if (YOU && !YOU.seen) { if (lastKey !== "card") showCard(false); }
    else {
      const yet = G.players.filter(p => !p.seen);
      const names = yet.map(p => p.name + (p.connected ? "" : ja() ? "（切断中）" : " (offline)")).join(ja() ? "、" : ", ");
      lastKey = "waitcards";
      openModal(`<span class="m-tag" style="background:${R.TYPE_META.fam.tag}">🏠 ${L(R.TYPE_META.fam.label)}</span>
        <h2>${ja() ? "みんながカードを見ています" : "Everyone is checking their card"}</h2>
        <p class="m-body">${ja() ? `まだの人：<b>${names}</b>` : `Still looking: <b>${names}</b>`}</p>
        <button class="chip-btn" id="mAgainCard" style="display:block;margin:0 auto">${ja() ? "自分のカードをもう一度見る" : "See my card again"}</button>
        ${iAmHost() ? `<button class="chip-btn" id="mForce" style="display:block;margin:10px auto 0">${ja()
          ? "▶ 待たずに始める（進行役）" : "▶ Start without them (host)"}</button>` : ""}`);
      $("mAgainCard").onclick = () => showCard(true);
      if ($("mForce")) $("mForce").onclick = () => {
        if (!ask({ ja: `まだカードを見ていない人（${names}）を待たずに始めます。よろしいですか？`,
                   en: `Start without those who haven't opened their card (${names}). Are you sure?` })) return;
        send({ t: "forceCards" });
      };
    }
  }
  else if (G.phase === "play") {
    showScreen("game");
    hostTools();
    if (!$("board").children.length) renderBoard();
    renderStrip();
    G.players.forEach(p => { if (shown[p.id] == null) shown[p.id] = p.pos; });
    renderTokens();
    stepAnim();
    const cur = G.players[G.turn];
    const mine = cur && cur.id === MYPID;
    $("turnPill").innerHTML = `<span class="p-dot" style="background:${cur.color}"></span>`
      + `<span class="tp-txt">${ja() ? `${cur.name} さんの番・${R.AGES[cur.pos]}歳` : `${cur.name}'s turn · Age ${R.AGES[cur.pos]}`}</span>`
      + (cur.connected ? "" : `<span class="tp-off">${ja() ? "⚠️ 切断中" : "⚠️ offline"}</span>`);
    const child = cur.pos < 4;
    $("diceFace").style.display = child ? "none" : "grid";
    $("diceFace").textContent = G.dice || "?";
    $("diceBtn").disabled = !(mine && !G.pending);
    $("diceLabel").textContent = mine
      ? (child ? (ja() ? "🧒 一歩すすむ" : "🧒 Step forward") : (ja() ? "サイコロを回す" : "Roll the dice"))
      : (ja() ? `${cur.name} さんの番` : `${cur.name}'s turn`);
    renderPending();
  }
  else if (G.phase === "result") { showScreen("result"); closeModal(); closeHost(); showResult(); }
}

/* 進行役だけに🛠を出し、パネルを開いたままなら中身を最新にする */
function hostTools() {
  $("hostBtn").style.display = iAmHost() ? "" : "none";
  if (hostOpen()) renderHostPanel();
}

/* ---------- 結果発表 ---------- */
function showResult() {
  const playing = G.players.filter(p => !p.left);
  const gone = G.players.filter(p => p.left);
  const sorted = [...playing].sort((a, b) => b.happy - a.happy || b.money - a.money);
  const list = $("resultList");
  list.innerHTML = "";
  sorted.forEach((p, i) => {
    const total = p.open + p.locked + p.unseen;
    const pct = n => total ? Math.round(n / total * 100) : 0;
    const diff = p.money - p.initMoney;
    const card = document.createElement("div");
    card.className = "res-card";
    card.innerHTML = `
      <span class="rank">${ja() ? `${i + 1}位` : `#${i + 1}`}</span>
      <div class="r-name"><span class="p-dot" style="background:${p.color}"></span>${p.name}
        <span class="r-fam">🏠 ${L(p.fam.name)}</span></div>
      <div class="r-story">${L(p.fam.story)}</div>
      <div class="r-stats">
        <span class="fx" style="color:#F291B5">♥ ${p.happy}</span>
        <span class="fx">${ja() ? `残金 ${fm(p.money)}（スタート比 ${diff >= 0 ? "+" : ""}${fm(diff)}）` : `Left: ${fm(p.money)} (${diff >= 0 ? "+" : ""}${fm(diff)} vs start)`}</span>
        <span class="fx" style="color:#00A3BD">${ja() ? "まなび" : "Learn"} ★${p.learn}</span>
      </div>
      <div class="r-ending">🌅 <b>${ja() ? "35歳のいま" : "Life at 35"}</b>：${L(R.endingText(p))}</div>
      <div class="doorbar">
        <div class="seg-open" style="width:${pct(p.open)}%"></div>
        <div class="seg-lock" style="width:${pct(p.locked)}%"></div>
        <div class="seg-unseen" style="width:${pct(p.unseen)}%"></div>
      </div>
      <div class="doorbar-label">${ja()
        ? `出会ったトビラ ${total}枚 ── 🚪 開けられた <b>${p.open}</b>／🔒 カギが足りなかった <b>${p.locked}</b>／👁 見えていなかった <b>${p.unseen}</b>`
        : `${total} doors met ── 🚪 opened <b>${p.open}</b> / 🔒 short of keys <b>${p.locked}</b> / 👁 never saw <b>${p.unseen}</b>`}</div>
      <button class="chip-btn rv-btn" data-p="${p.id}">${ja() ? "🚪 トビラのネタバラシを見る" : "🚪 See this player's door reveal"}</button>`;
    list.appendChild(card);
  });
  list.querySelectorAll(".rv-btn").forEach(b => b.onclick = () => showRevealModal(b.dataset.p));
  $("resLeftNote").innerHTML = gone.length
    ? (ja() ? `🚪 とちゅうで抜けた人：${gone.map(p => p.name).join("、")}` : `🚪 Left partway: ${gone.map(p => p.name).join(", ")}`)
    : "";
  const totalUnseen = playing.reduce((s, p) => s + p.unseen, 0);
  $("insightBox").innerHTML = ja() ? `
    <b>■ ふりかえりタイム</b><br>
    順位を決めたのは、お金の多さじゃなくて <b>♥ハッピー</b>。<br>
    ♥が多いということは——<b>人生の選択肢をたくさん持ち、じぶんの意思で選べた</b>ということ。<br>
    でも、♥を生むトビラのカギは、<b>生まれた場所</b>によってぜんぜん違った。<br><br>
    このテーブル全体で、<b>${totalUnseen}枚のトビラが「見えてすら いなかった」</b>。<br>
    それはウガンダの家庭だけの話じゃない——<b>支え合いのトビラ</b>は、めぐまれた家庭からこそ見えなかったはず。<br>
    カギが足りないのと、扉があることを知らないのは、ぜんぜん違う。<br><br>
    🚪 それぞれのカードの<b>「ネタバラシ」ボタン</b>で、？？？の中身をのぞいてみよう。<br><br>
    🗣 話してみよう：<br>
    ・同じ「おしごとマス」・同じ★の数なのに、かせぎがぜんぜんちがった。それは本人の努力のちがいだろうか？<br>
    ・ウガンダ育ちは、★を増やすだけではかせぎが伸びなかった。「まなび」が実るために必要だった<b>もうひとつのカギ</b>は何だった？<br>
    ・あなたの家庭カードから見えなかったのは、どんなトビラだった？　逆に、見えていた強みは？<br>
    ・親を亡くしたウガンダの子には、何が「見えて」いた？　それはなぜだろう？<br>
    ・AAIの扉は「ずるい」？——その扉を開けた人の「大きな夢」は、どうなっていた？<br>
    ・今日あなたが学校に持ってきたもの——スマホ、無料の教科書、給食。それは、どの家庭カードの世界のものだった？<br>
    ・日本にいる私たちが、世界の遺児にわたせる「カギ」って、何だろう？` : `
    <b>■ Reflection time</b><br>
    The ranking wasn't decided by money, but by <b>♥ Happiness</b>.<br>
    More ♥ means you <b>held more of life's options — and chose with your own will</b>.<br>
    But the keys to the ♥ doors were completely different depending on <b>where you were born</b>.<br><br>
    Across this table, <b>${totalUnseen} doors were never even visible</b>.<br>
    And that's not only about the Ugandan families — the <b>doors of community support</b> were invisible to the well-off families.<br>
    Lacking a key, and not knowing a door exists, are very different things.<br><br>
    🚪 Use each player's <b>Reveal button</b> to peek inside the ？？？.<br><br>
    🗣 Talk about it:<br>
    · Same work square, same ★ — completely different pay. Was that about effort?<br>
    · For those raised in Uganda, more ★ alone didn't raise pay. What was <b>the other key</b> that made learning bear fruit?<br>
    · Which doors were invisible from your Family Card? And what strengths could you see?<br>
    · What could the orphan in Uganda "see"? Why?<br>
    · Was the AAI door "unfair"? — And what happened to that player's "big dream"?<br>
    · The things you brought to school today — a phone, free textbooks, school lunch. Which family card's world do they belong to?<br>
    · What "keys" could we hand to orphans around the world?`;
}

/* ---------- ネタバラシ ---------- */
function rawReqLabel(o) {
  const parts = [];
  if (o.req.money) parts.push(`${ja() ? "おかね" : "Money "}${fm(o.req.money)}`);
  if (o.req.learn) parts.push(`★${o.req.learn}`);
  if (o.req.maxMoney != null) parts.push(ja() ? `所得制限おかね${fm(o.req.maxMoney)}未満` : `income limit: under ${fm(o.req.maxMoney)}`);
  return parts.join("＋");
}
function fxInline(fx) {
  const parts = [];
  if (fx.money) parts.push(`💰${fx.money > 0 ? "+" : ""}${fm(fx.money)}`);
  if (fx.learn) parts.push(`★+${fx.learn}`);
  if (fx.happy) parts.push(`♥+${fx.happy}`);
  return parts.join(" ");
}
const RV_META = {
  chosen: ["✅", { ja: "えらんだ", en: "Chosen" }], open: ["🚪", { ja: "開けられた", en: "Could open" }],
  locked: ["🔒", { ja: "カギ不足", en: "Short of keys" }], unseen: ["👁", { ja: "見えてなかった！", en: "Never saw it!" }],
};
function showRevealModal(pid) {
  const p = G.players.find(x => x.id === pid);
  const secs = (p.doorLog || []).map(e => {
    const rows = e.opts.map((o, i) => {
      const st = e.chosen === i ? "chosen" : e.states[i];
      const [ic, label] = RV_META[st];
      const key = rawReqLabel(o), fx = fxInline(o.fx);
      return `<div class="rv-opt ${st}"><span class="rv-ic">${ic}</span>
        <span class="rv-main"><span class="rv-t">${L(o.t)}</span><span class="rv-d">${L(o.d)}</span>
        <span class="rv-meta">🔑 ${key || (ja() ? "カギなし" : "No key")}${fx ? `　→ ${fx}` : ""}</span></span>
        <span class="rv-st">${L(label)}</span></div>`;
    }).join("");
    return `<div class="rv-door"><div class="rv-title">${e.age != null ? fage(e.age) + " ── " : ""}${L(e.title)}${e.variant ? `（${L(e.variant)}）` : ""}</div>${rows}</div>`;
  }).join("");
  openModal(`<div class="rule-page">
      <button class="rule-close" id="rvClose">✕</button>
      <span class="m-tag" style="background:var(--brown)">🚪 ${ja() ? "ネタバラシ" : "The Reveal"}</span>
      <h2>${ja() ? `${p.name} さんが出会ったトビラ、ぜんぶ` : `Every door ${p.name} met`}</h2>
      <p class="m-body">${ja() ? "👁は、ゲーム中「？？？」で中身が見えなかったトビラ。<br>ほんとうは、こんな選択肢だった——" : "👁 marks options hidden as ？？？ during the game.<br>Here's what they really were —"}</p>
      <div class="rv-list">${secs || `<p class='m-body'>${ja() ? "トビラには出会わなかったみたい。" : "No doors were met."}</p>`}</div>
      <button class="m-btn" id="rvOk">${ja() ? "とじる" : "Close"}</button></div>`);
  $("rvClose").onclick = closeModal; $("rvOk").onclick = closeModal;
}
const whoChips = list => list.map(p => `<span class="who"><span class="p-dot" style="background:${p.color}"></span>${p.name}</span>`).join("");
function showAllDoorsModal() {
  const kt = v => v == null ? "" : (v.ja !== undefined ? v.ja : v);
  const map = new Map();
  G.players.filter(p => !p.left).forEach(p => (p.doorLog || []).forEach(e => {
    const key = `${e.age}|${kt(e.title)}|${kt(e.variant)}`;
    if (!map.has(key)) map.set(key, { age: e.age, title: e.title, variant: e.variant, opts: e.opts, perOpt: e.opts.map(() => ({ chosen: [], locked: [], unseen: [] })) });
    const g = map.get(key);
    e.opts.forEach((o, i) => {
      if (!g.perOpt[i]) g.perOpt[i] = { chosen: [], locked: [], unseen: [] };
      if (e.chosen === i) g.perOpt[i].chosen.push(p);
      else if (e.states[i] === "unseen") g.perOpt[i].unseen.push(p);
      else if (e.states[i] === "locked") g.perOpt[i].locked.push(p);
    });
  }));
  R.SQUARES.forEach((sq, i) => {
    if (sq.t !== "choice") return;
    ((sq.key === "machi" || sq.key === "kurashi") ? [true, false] : [true]).forEach(rural => {
      const dummy = { fam: { rural }, perk: null, money: 0, learn: 0, shienDiscount: false, name: "", hidden: [] };
      const def = R.choiceDef(sq.key, dummy);
      const key = `${R.AGES[i]}|${kt(def.title)}|${kt(def.variant)}`;
      if (!map.has(key)) map.set(key, { age: R.AGES[i], title: def.title, variant: def.variant, opts: def.opts, perOpt: def.opts.map(() => ({ chosen: [], locked: [], unseen: [] })), untrodden: true });
    });
  });
  const secs = [...map.values()].sort((a, b) => a.age - b.age).map(g => {
    const rows = g.opts.map((o, i) => {
      const st = g.perOpt[i], key = rawReqLabel(o), fx = fxInline(o.fx), lines = [];
      if (st.chosen.length) lines.push(`<div class="rv-who">✅ ${ja() ? "えらんだ" : "Chose"}：${whoChips(st.chosen)}</div>`);
      if (st.locked.length) lines.push(`<div class="rv-who">🔒 ${ja() ? "カギ不足" : "Short of keys"}：${whoChips(st.locked)}</div>`);
      if (st.unseen.length) lines.push(`<div class="rv-who" style="color:#c77f00">👁 ${ja() ? "見えなかった" : "Couldn't see"}：${whoChips(st.unseen)}</div>`);
      return `<div class="rv-opt ${st.unseen.length ? "unseen" : ""}"><span class="rv-main">
        <span class="rv-t">${L(o.t)}</span><span class="rv-d">${L(o.d)}</span>
        <span class="rv-meta">🔑 ${key || (ja() ? "カギなし" : "No key")}${fx ? `　→ ${fx}` : ""}</span>${lines.join("")}</span></div>`;
    }).join("");
    return `<div class="rv-door"${g.untrodden ? ' style="opacity:.75"' : ""}>
      <div class="rv-title">🚪 ${fage(g.age)} ── ${L(g.title)}${g.variant ? `（${L(g.variant)}）` : ""}${g.untrodden ? `<span class="rv-untrod">🚶 ${ja() ? "だれも通らなかった" : "no one passed here"}</span>` : ""}</div>${rows}</div>`;
  }).join("");
  openModal(`<div class="rule-page">
      <button class="rule-close" id="adClose">✕</button>
      <span class="m-tag" style="background:var(--brown)">🚪 ${ja() ? "トビラ一覧" : "All Doors"}</span>
      <h2>${ja() ? "29年間に、こんなトビラがあった" : "The doors of these 29 years"}</h2>
      <div class="rv-list">${secs}</div>
      <button class="m-btn" id="adOk">${ja() ? "とじる" : "Close"}</button></div>`);
  $("adClose").onclick = closeModal; $("adOk").onclick = closeModal;
}
$("allDoorsBtn").onclick = showAllDoorsModal;

/* ---------- あそびかた ---------- */
const RULE_PAGES = [
  {tag:{ja:"🌍 このゲームは",en:"🌍 This game"}, title:{ja:"世界のどこかに、生まれる",en:"Born somewhere in the world"}, items:[
    ["🌍",{ja:"あなたは、世界のどこかの家庭に生まれます。<b>生まれる場所は、選べません</b>。",en:"You are born into a family somewhere in the world. <b>You don't choose where.</b>"}],
    ["🎲",{ja:"サイコロも盤面も、みんなおなじ。でも、<b>見える景色</b>は人によってちがう——それがこのゲームです。",en:"Same dice, same board for everyone. But <b>what you can see</b> is different — that's this game."}],
    ["🚪",{ja:"同じマスに止まっても、開けられるトビラ・見えるトビラがちがうかも。理由は、遊びおわってから分かります。",en:"On the same square, the doors you can open — or even see — may differ. You'll learn why after the game."}],
  ]},
  {tag:{ja:"🏁 めざすもの",en:"🏁 The goal"}, title:{ja:"順位を決めるのは ♥ハッピー",en:"Ranking is decided by ♥ Happiness"}, items:[
    ["🎲",{ja:"これは<b>6歳から35歳までの29年間</b>をたどる人生すごろく。サイコロを回して、みんなでゴールをめざそう。",en:"This board traces <b>29 years, from age 6 to 35</b>. Roll the dice and head for the goal together."}],
    ["🧒",{ja:"<b>子ども時代（6〜15歳）はサイコロを使わず、1マスずつ</b>進む。人生の土台をつくる時間だ。",en:"<b>In childhood (6–15) there's no dice — one square at a time.</b> These years build your base."}],
    ["♥",{ja:"最後の順位は、おかねの多さじゃなく <b>♥ハッピーの数</b>で決まる！",en:"The final ranking isn't about money — it's the number of <b>♥ Happiness</b>!"}],
    ["🚪",{ja:"♥は、人生の選択「<b>トビラ</b>」を開けるともらえる。<b>♥の数＝じぶんの意思で選べた数</b>だ。",en:"You earn ♥ by opening life's <b>Doors</b>. <b>♥ = how often you chose with your own will.</b>"}],
  ]},
  {tag:{ja:"🚪 トビラとカギ",en:"🚪 Doors & keys"}, title:{ja:"いい選択には「カギ」がいる",en:"Good choices need keys"}, items:[
    ["🚪",{ja:"<b>光るトビラのマス</b>に止まると、人生の選択がやってくる。",en:"Land on a <b>glowing Door square</b> and a life choice arrives."}],
    ["🔑",{ja:"選択肢には<b>カギ</b>（必要な💰おかね・★まなび）があるものも。",en:"Some options have <b>keys</b> — 💰money or ★learning you must have."}],
    ["🔒",{ja:"カギが足りないと、そのトビラは開けられない…！",en:"Without the keys, that door won't open…!"}],
    ["🗣",{ja:"えらぶ前に、<b>「なぜそれを選ぶのか」をひとこと</b>みんなに話してから決めよう。",en:"Before you choose, <b>say out loud why</b> you're choosing it."}],
  ]},
  {tag:{ja:"📚 まなびとおかね",en:"📚 Learning & money"}, title:{ja:"★まなびは、未来のカギ",en:"★ Learning is a future key"}, items:[
    ["📚",{ja:"<b>まなびマス</b>やトビラ、🎴できごとで★まなびが貯まる。",en:"Collect ★ from <b>Learning squares</b>, doors, and 🎴 events."}],
    ["💰",{ja:"かせぎは「<b>基本給＋★×掛け率</b>」。基本給も、★がかせぎになる度合いも、生まれた場所でちがう…！",en:"Pay = <b>base + ★ × rate</b>. Both base pay and how much ★ turns into pay depend on where you were born…!"}],
    ["🎴",{ja:"<b>できごとマス</b>では、ラッキーもアクシデントも起こる。",en:"<b>Event squares</b> bring both luck and accidents."}],
  ]},
  {tag:{ja:"🏠 家庭カード",en:"🏠 Family Cards"}, title:{ja:"スタート地点は、国によってちがう",en:"Your start depends on where you're born"}, items:[
    ["🏠",{ja:"はじめに引く<b>家庭カード</b>で、生まれる国・持ちもの・基本給が変わる。",en:"The <b>Family Card</b> you draw sets your country, belongings, and base pay."}],
    ["👁",{ja:"とちゅうで「？？？」の選択肢に出会うかも。それが何なのかは——遊びおわってからのお楽しみ。",en:"You may meet ？？？ options along the way. What they are — you'll find out after the game."}],
    ["🗣",{ja:"全員ゴールしたら<b>ふりかえりタイム</b>。感じたことを話してみよう。",en:"When everyone finishes: <b>reflection time</b>. Talk about what you felt."}],
  ]},
  {tag:{ja:"🇺🇬 なぜウガンダ？",en:"🇺🇬 Why Uganda?"}, title:{ja:"実在する場所と、実在する支え",en:"A real place, and real support"}, items:[
    ["🗺",{ja:"このゲームの舞台のひとつ、ウガンダは実在の国。病気や紛争で親を亡くした子どもたちが、たくさん暮らしています。",en:"Uganda, one of this game's settings, is a real country — home to many children who lost parents to illness or conflict."}],
    ["🎗",{ja:"あしなが育英会は<b>「あしながウガンダ」</b>で、現地の遺児の教育を実際に支えています。ゲームに出てくる「支援団体」のモデルです。",en:"The Ashinaga Foundation really supports orphans' education there through <b>Ashinaga Uganda</b> — the model for the \"aid groups\" in this game."}],
    ["🎓",{ja:"あしながの<b>AAI</b>は、アフリカの遺児を海外の大学へ送り出す奨学金。ただの援助ではなく、<b>志をもって祖国に貢献するリーダーを育てる「約束」</b>の仕組みです。",en:"Ashinaga's <b>AAI</b> sends African orphans to universities abroad — not simple charity, but a \"promise\": raising <b>leaders who bring their talents home</b>."}],
    ["🤝",{ja:"ゲームの中で見えた「支え」は、現実の世界にもある。ふりかえりで、日本にいる私たちにできることを話してみよう。",en:"The support you saw in the game exists in the real world too. In reflection time, talk about what we can do."}],
  ]},
];
function renderRules(page) {
  const pg = RULE_PAGES[page];
  const items = pg.items.map(([ic, tx]) => `<div class="rule-item"><span class="r-ic">${ic}</span><span>${L(tx)}</span></div>`).join("");
  const dots = RULE_PAGES.map((_, i) => `<span class="${i === page ? "on" : ""}"></span>`).join("");
  const last = page === RULE_PAGES.length - 1;
  lastKey = "rules" + page;
  openModal(`<div class="rule-page">
      <button class="rule-close" id="ruleClose">✕</button>
      <span class="m-tag" style="background:var(--teal)">${L(pg.tag)}</span>
      <h2>${L(pg.title)}</h2>
      <div class="rule-list">${items}</div>
      <div class="rule-dots">${dots}</div>
      <div class="rule-nav">
        ${page > 0 ? `<button class="m-btn ghost" id="rulePrev">${ja() ? "← まえ" : "← Back"}</button>` : ""}
        ${last ? `<button class="m-btn" id="ruleDone">${ja() ? "OK！" : "OK!"}</button>` : `<button class="m-btn" id="ruleNext">${ja() ? "つぎへ →" : "Next →"}</button>`}
      </div></div>`);
  $("ruleClose").onclick = () => { closeModal(); render(); };
  if ($("rulePrev")) $("rulePrev").onclick = () => renderRules(page - 1);
  if (last) $("ruleDone").onclick = () => { closeModal(); render(); };
  else $("ruleNext").onclick = () => renderRules(page + 1);
}

/* 開発用: ブラウザから内部状態をのぞくためのフック */
setInterval(() => {
  try {
    if (G && G.pending && !isOpen() && !animTimer) renderPending();
  } catch (e) {}
}, 1500);

window.__tobira = {
  get state(){ return G; }, get you(){ return YOU; }, get pid(){ return MYPID; },
  get anim(){ return animTimer; }, get lastKey(){ return lastKey; },
  get wsState(){ return ws && ws.readyState; }, get room(){ return ROOM; },
  msgs: 0,
};

/* ---------- 起動 ---------- */
$("nameInput").value = localStorage.getItem("tobira-name") || "";
const urlCode = new URLSearchParams(location.search).get("room");
if (urlCode) $("codeInput").value = urlCode.toUpperCase();
applyLang();
