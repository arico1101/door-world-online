/* ===== トビラ せかい版 オンライン — Worker + Durable Object =====
   ゲームの判定はすべてサーバー(Room)が行う。クライアントは表示と入力だけ。
   家庭カードは持ち主の接続にしか送らないので、他の参加者には最後まで見えない。 ===== */
import * as R from "../public/rules.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const code = (url.searchParams.get("room") || "").toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) return new Response("bad room code", { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

/* ---------- 表示用の文字列づくり（サーバーで日英どちらも作って送る） ---------- */
const fmJa = n => `${n}万`;
const fmEn = n => `${n < 0 ? "-" : ""}¥${(Math.abs(n) * 10).toLocaleString("en-US")}k`;
const bi = (ja, en) => ({ ja, en });
const join = (a, b) => a ? bi(a.ja + "<br>" + b.ja, a.en + "<br>" + b.en) : b;

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.g = null;
    state.blockConcurrencyWhile(async () => {
      this.g = (await state.storage.get("game")) || null;
    });
  }

  /* ---------- 接続 ---------- */
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const url = new URL(request.url);
    const pid = (url.searchParams.get("pid") || "").slice(0, 40) || crypto.randomUUID();
    const name = (url.searchParams.get("name") || "").slice(0, 12);
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ pid });
    this.join(pid, name);
    await this.save();
    this.broadcast();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const { pid } = ws.deserializeAttachment() || {};
    if (!pid || !this.g) return;
    try { this.handle(pid, m); } catch (e) { console.log("handle error", e && e.stack); }
    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws) {
    const { pid } = ws.deserializeAttachment() || {};
    const p = this.g && this.g.players.find(x => x.id === pid);
    if (p) p.connected = false;
    await this.save();
    this.broadcast();
  }

  save() { return this.state.storage.put("game", this.g); }
  cur() { return this.g.players[this.g.turn]; }
  isActor(pid) { const p = this.cur(); return p && p.id === pid; }

  join(pid, name) {
    if (!this.g) this.g = { phase: "lobby", hostId: pid, players: [], turn: 0, dice: null, pending: null, heavyOn: false, deck: [] };
    const found = this.g.players.find(p => p.id === pid);
    if (found) { found.connected = true; if (name) found.name = name; return; }
    if (this.g.phase !== "lobby") return;              /* 開始後は新規参加できない（再接続は上で拾う） */
    if (this.g.players.length >= 6) return;
    this.g.players.push({
      id: pid, name: name || `Player ${this.g.players.length + 1}`,
      color: R.PCOLORS[this.g.players.length % R.PCOLORS.length], connected: true,
      pos: 0, money: 0, learn: 0, happy: 0, done: false, rankAt: null, seen: false,
    });
    if (!this.g.players.some(p => p.id === this.g.hostId)) this.g.hostId = this.g.players[0].id;
  }

  /* ---------- 送信（家庭カードは本人にだけ） ---------- */
  publicPlayer(p, reveal) {
    const o = {
      id: p.id, name: p.name, color: p.color, connected: p.connected,
      pos: p.pos, money: p.money, learn: p.learn, happy: p.happy,
      done: p.done, rankAt: p.rankAt, seen: p.seen,
    };
    if (reveal) {                                       /* 結果発表で全公開 */
      o.fam = p.fam; o.perk = p.perk; o.mult = p.mult; o.aai = p.aai;
      o.hidden = p.hidden; o.deaiUsed = p.deaiUsed; o.initMoney = p.initMoney;
      o.open = p.open; o.locked = p.locked; o.unseen = p.unseen; o.doorLog = p.doorLog;
    }
    return o;
  }
  stateFor(pid) {
    const reveal = this.g.phase === "result";
    const me = this.g.players.find(p => p.id === pid);
    return {
      t: "state", pid,
      g: {
        phase: this.g.phase, hostId: this.g.hostId, turn: this.g.turn, dice: this.g.dice,
        pending: this.g.pending, heavyOn: this.g.heavyOn,
        players: this.g.players.map(p => this.publicPlayer(p, reveal)),
      },
      you: me && me.fam ? {
        fam: me.fam, hidden: me.hidden, perk: me.perk, mult: me.mult, allow: me.allow,
        loan: me.loan, aai: me.aai, shienDiscount: me.shienDiscount, seen: me.seen,
      } : null,
    };
  }
  broadcast() {
    for (const ws of this.state.getWebSockets()) {
      const { pid } = ws.deserializeAttachment() || {};
      try { ws.send(JSON.stringify(this.stateFor(pid))); } catch {}
    }
  }

  /* ---------- 受信 ---------- */
  handle(pid, m) {
    const g = this.g;
    if (m.t === "setName") {
      const p = g.players.find(x => x.id === pid);
      if (p && m.name) p.name = String(m.name).slice(0, 12);
    }
    else if (m.t === "start" && pid === g.hostId && g.phase === "lobby" && g.players.length >= 2) {
      this.deal(!!m.heavyOn);
    }
    else if (m.t === "seen" && g.phase === "cards") {
      const p = g.players.find(x => x.id === pid);
      if (p) p.seen = true;
      if (g.players.every(x => x.seen)) { g.phase = "play"; g.turn = 0; this.beginTurn(); }
    }
    else if (m.t === "roll" && g.phase === "play" && !g.pending && this.isActor(pid)) {
      this.roll();
    }
    else if (m.t === "choose" && g.pending && g.pending.kind === "choice" && this.isActor(pid)) {
      this.applyChoice(m.i | 0);
    }
    else if (m.t === "ok" && g.pending && this.isActor(pid)) {
      this.confirmPending();
    }
    else if (m.t === "again" && pid === g.hostId && g.phase === "result") {
      g.phase = "lobby"; g.turn = 0; g.dice = null; g.pending = null; g.deck = [];
      g.players.forEach(p => { p.seen = false; p.done = false; p.rankAt = null; delete p.fam; });
    }
  }

  /* ---------- 家庭カードを配る ---------- */
  deal(heavyOn) {
    const g = this.g;
    const famDeck = R.shuffle([...R.FAMILIES]);
    const dealN = Math.min(g.players.length, famDeck.length);
    /* どの人数でも、ウガンダの遺児家庭(w5/w6)が必ず1枚は配られる */
    if (!famDeck.slice(0, dealN).some(f => f.id === "w5" || f.id === "w6")) {
      const oi = famDeck.findIndex(f => f.id === "w5" || f.id === "w6");
      const ti = Math.floor(Math.random() * dealN);
      [famDeck[ti], famDeck[oi]] = [famDeck[oi], famDeck[ti]];
    }
    g.players.forEach((p, i) => {
      const fam = famDeck[i % famDeck.length];
      Object.assign(p, {
        fam, perk: fam.perk, hidden: [...fam.hide],
        pos: 0, money: fam.money, initMoney: fam.money, allow: fam.allow,
        learn: 1 + ((fam.perk === "kinben" || fam.perk === "kokusai") ? 1 : 0), happy: 0,
        mult: fam.rural ? 5 : 10, aai: false, loan: 0,
        open: 0, locked: 0, unseen: 0, doorLog: [],
        shienDiscount: false, shienUsed: false, deaiUsed: false,
        hadHeavy: false, disasterTurns: 0, letterIn: null,
        done: false, rankAt: null, seen: false,
      });
    });
    g.heavyOn = heavyOn;
    g.deck = [];
    g.phase = "cards";
  }

  /* ---------- ターンの流れ ---------- */
  beginTurn() {
    const g = this.g, p = this.cur();
    g.dice = null; g.pending = null;
    if (p.letterIn !== null && p.letterIn !== undefined) {
      p.letterIn--;
      if (p.letterIn <= 0) { p.letterIn = null; this.setChoice(R.letterDef(), "heavy", true); }
    }
  }
  roll() {
    const g = this.g, p = this.cur();
    const steps = p.pos < 4 ? 1 : 1 + Math.floor(Math.random() * 6);
    g.dice = p.pos < 4 ? null : steps;
    let target = Math.min(p.pos + steps, R.SQUARES.length - 1);
    for (let i = p.pos + 1; i < target; i++) if (R.SQUARES[i].stop) { target = i; break; }
    p.pos = target;
    this.resolveSquare();
  }
  endTurn() {
    const g = this.g, cur = this.cur();
    if (cur.disasterTurns > 0) cur.disasterTurns--;
    g.pending = null; g.dice = null;
    if (g.players.every(x => x.done)) { g.phase = "result"; return; }
    do { g.turn = (g.turn + 1) % g.players.length; } while (g.players[g.turn].done);
    this.beginTurn();
  }

  setInfo(type, title, body, fx, note) {
    this.g.pending = { kind: "info", for: this.cur().id, type, title, body, note: note || null, fx: fx || {} };
  }
  setChoice(def, type, skipCount) {
    const p = this.cur();
    const states = def.opts.map(o => {
      if (o.tag && p.hidden.includes(o.tag)) return "unseen";
      return R.meetsReq(p, o) ? "open" : "locked";
    });
    if (!skipCount) {
      states.forEach(s => { if (s === "unseen") p.unseen++; else if (s === "open") p.open++; else p.locked++; });
      p.doorLog.push({ title: def.title, variant: def.variant, age: R.AGES[p.pos], opts: def.opts, states, chosen: null });
      this.g.logged = true;
    } else this.g.logged = false;
    this.g.pending = {
      kind: "choice", for: p.id, type: type || "choice", def: { title: def.title, body: def.body, variant: def.variant, heavy: !!def.heavy },
      opts: def.opts, states,
      /* カギの表示計算に使う。ここに出る値はどれも選択画面で見えているもの */
      actor: { name: p.name, money: p.money, learn: p.learn, pos: p.pos, perk: p.perk, mult: p.mult, shienDiscount: p.shienDiscount },
    };
  }

  resolveSquare() {
    const g = this.g, p = this.cur(), sq = R.SQUARES[p.pos];
    if (sq.t === "income") {
      let amt, title, note = null;
      if (sq.fixed != null) {
        amt = sq.fixed;
        title = sq.name;
        note = bi("はじめての、自分のかせぎ！", "Your first money of your own!");
      } else {
        amt = p.fam.wage + p.learn * p.mult + p.allow;
        const job = R.jobTitle(p);
        title = bi(`${job.ic} ${R.AGES[p.pos]}歳・いまのしごと：${job.t.ja}`, `${job.ic} Age ${R.AGES[p.pos]} · Current job: ${job.t.en}`);
        note = bi(
          `かせぎは <b>基本給${fmJa(p.fam.wage)} ＋ まなび×${fmJa(p.mult)}${p.allow > 0 ? " ＋ 仕送り" + fmJa(p.allow) : ""}</b><br>まなびが増えると、しごともかせぎも変わっていく`,
          `Pay = <b>base ${fmEn(p.fam.wage)} + Learn × ${fmEn(p.mult)}${p.allow > 0 ? " + allowance " + fmEn(p.allow) : ""}</b><br>As learning grows, your job and pay change too`);
        if (p.fam.wage < 20) note = join(note, bi(
          `🌍 同じはたらきでも、生まれた場所で基本給はちがう——<br>じつは現実のウガンダの平均収入は、日本の<b>約20分の1</b>。このゲームでは、いっしょに遊べるように差をゆるめている。`,
          `🌍 Same work, different base pay — it depends on where you were born.<br>In reality, average income in Uganda is about <b>1/20th</b> of Japan's. This game softens the gap so everyone can play the same board.`));
        if (p.mult < 10) note = join(note, bi(
          `📉 いまの場所では、まなびがかせぎにつながりにくい（★×5万）。<b>スキルが活きる場</b>につながるトビラがあれば——`,
          `📉 Where you live, learning hardly turns into pay (★×${fmEn(5)}). If only a door led to <b>a place where skills matter</b>—`));
        if (p.disasterTurns > 0) {
          amt -= 10;
          note = join(note, bi(`⚠️ 災害の影響で −10万（あと${p.disasterTurns}ターン）`, `⚠️ Disaster: −${fmEn(10)} (${p.disasterTurns} turns left)`));
        }
        if (p.loan > 0) {
          const pay = Math.min(6, p.loan);
          p.loan -= pay; amt -= pay;
          note = join(note, bi(`🎓 奨学金の返済 −${pay}万（のこり${p.loan}万）`, `🎓 Scholarship repayment −${fmEn(pay)} (${fmEn(p.loan)} left)`));
        }
      }
      this.setInfo("income", title, note, { money: amt });
    }
    else if (sq.t === "cost") {
      this.setInfo("cost", sq.name, bi("生きているとお金はかかる。固定費、だいじ。", "Living costs money. Watch those fixed costs."), { money: -sq.amt });
    }
    else if (sq.t === "event") {
      if (g.heavyOn && !p.hadHeavy && p.pos >= 8 && Math.random() < 0.3) { this.setChoice(R.heavyDef(p), "heavy"); return; }
      this.drawEvent();
    }
    else if (sq.t === "learn") this.setChoice(R.choiceDef("learnSq", p), "learn");
    else if (sq.t === "choice") this.setChoice(R.choiceDef(sq.key, p), "choice");
    else if (sq.t === "goal") {
      p.done = true;
      p.rankAt = g.players.filter(x => x.done).length;
      g.pending = { kind: "goal", for: p.id, rankAt: p.rankAt, loan: p.loan, fx: { happy: p.rankAt === 1 ? 1 : 0, money: p.loan > 0 ? -p.loan : 0 } };
    }
    else this.endTurn();
  }

  drawEvent() {
    const g = this.g, p = this.cur();
    let ev = null, guard = 0;
    while (guard++ < 40) {
      if (!g.deck.length) g.deck = R.shuffle(R.EVENTS.map((_, i) => i));
      const cand = R.EVENTS[g.deck.pop()];
      if (cand.only === "rural" && !p.fam.rural) continue;
      if (cand.only === "rich" && p.fam.rural) continue;
      if ((cand.kind === "info" || cand.kind === "fair") && p.hidden.length === 0) continue;
      ev = cand; break;
    }
    if (!ev) return this.endTurn();
    if (ev.kind === "info") {
      const n = p.perk === "tasukeai" ? 2 : 1;
      const revealed = R.revealTags(p, ev.reveal, n);
      let note = revealed > 0
        ? bi(`👁 見えていなかった選択肢が <b>${revealed}個</b>、見えるようになった！`, `👁 <b>${revealed}</b> hidden option${revealed > 1 ? "s" : ""} became visible!`)
        : null;
      const dn = R.checkDeai(p);
      if (dn) note = note ? join(note, dn) : dn;
      this.setInfo("event", ev.t, ev.d, {}, note);
    }
    else if (ev.kind === "fair") this.setChoice(R.fairDef(), "event");
    else this.setInfo("event", ev.t, ev.d, { ...ev.fx });
  }

  applyChoice(i) {
    const g = this.g, p = this.cur(), o = g.pending.opts[i];
    if (!o || g.pending.states[i] !== "open") return;
    if (g.logged && p.doorLog.length) p.doorLog[p.doorLog.length - 1].chosen = i;
    const fx = { ...o.fx };
    const notes = [];
    if (fx.money) {
      fx.money = R.effectiveMoneyFx(p, o);
      if (fx.money !== o.fx.money && o.special !== "shogakukin") {
        notes.push(bi(`🎗 サポートのおかげで、はらうお金が <b>${fmJa(o.fx.money)} → ${fmJa(fx.money)}</b> に軽くなった。`,
                      `🎗 Thanks to the support, what you pay drops from <b>${fmEn(o.fx.money)} to ${fmEn(fx.money)}</b>.`));
      }
    }
    if (o.special === "revealAll" && p.hidden.length > 0) {
      p.hidden.length = 0;
      notes.push(bi("👁 いままで見えていなかった選択肢が、ぜんぶ見えるようになった！", "👁 Every hidden option is now visible!"));
      const dn = R.checkDeai(p); if (dn) notes.push(dn);
    }
    if (o.special === "reveal2") {
      const n = R.revealTags(p, "any", p.perk === "tasukeai" ? 4 : 2);
      if (n > 0) notes.push(bi(`👁 見えていなかった選択肢が <b>${n}個</b>、見えるようになった！`, `👁 <b>${n}</b> hidden option${n > 1 ? "s" : ""} became visible!`));
      const dn = R.checkDeai(p); if (dn) notes.push(dn);
    }
    if (o.special === "shienSupport") {
      p.shienDiscount = true;
      R.unhideTag(p, "shien");
      notes.push(bi("🎗 これから先、支援・まなび系のトビラが <b>最大50万ぶん安くなる</b>。カギ（必要なお金）も、じっさいにはらうお金も。",
                    `🎗 From now on, aid/learning doors cost up to <b>${fmEn(50)} less</b> — both the key you need and the money you actually pay.`));
      const dn = R.checkDeai(p); if (dn) notes.push(dn);
    }
    if (o.special === "letter") p.letterIn = 2;
    if (o.unlock && p.mult < 10) {
      p.mult = 10;
      notes.push(bi("🔓 スキルが活きる場につながった！ これから、まなびが <b>★×10万</b> でかせぎになる。",
                    `🔓 You reached a place where skills pay! Learning now earns <b>★×${fmEn(10)}</b>.`));
    }
    if (o.special === "aai") {
      p.aai = true;
      notes.push(bi("🤝 AAIは『志』の奨学金——卒業したら、リーダーシップで祖国に貢献する約束。あなたの「大きな夢」は、祖国とともにある。",
                    `🤝 AAI is a scholarship of purpose — a promise to lead and give back to your home country. Your "big dream" now belongs with your homeland.`));
    }
    if (o.special === "shogakukin") {
      if (p.shienDiscount || p.perk === "shienPro") {
        notes.push(bi("🎗 支援を知っていたおかげで<b>返さなくていい奨学金</b>に出会えた！", "🎗 Because you knew the support system, you found <b>a scholarship you never repay</b>!"));
      } else {
        p.loan = 48;
        notes.push(bi("🎓 これは<b>貸与型</b>（総額48万）。働きはじめたら、かせぎから<b>すこしずつ（−6万）</b>、35歳まで返していく。",
                      `🎓 This is <b>a loan</b> (${fmEn(48)} total). Once you work, you repay <b>bit by bit (−${fmEn(6)})</b> until you're 35.`));
      }
    }
    if (o.tag === "shien" && p.perk === "shienPro" && !p.shienUsed) {
      p.shienUsed = true;
      fx.learn = (fx.learn || 0) + 1;
      notes.push(bi("✨ 支援を知っている強みで まなび+1", "✨ Knowing the support system: Learn +1"));
    }
    g.pending = { kind: "result", for: p.id, type: g.pending.type, title: o.t, body: o.d, notes, fx };
  }

  /* info / result / goal のOKで、効果を反映してターンを終える */
  confirmPending() {
    const g = this.g, p = this.cur(), pd = g.pending;
    if (pd.kind === "goal") {
      if (p.rankAt === 1) p.happy += 1;
      if (p.loan > 0) { p.money -= p.loan; p.loan = 0; }
    } else if (pd.kind === "info" || pd.kind === "result") {
      R.applyFx(p, pd.fx || {});
    } else return;                                   /* choice はボタンで決める */
    this.endTurn();
  }
}
