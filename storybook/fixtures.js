import * as R from "../public/rules.js";

/* この雛形は「みじかめ」（24マス）の盤面を前提に作ってある。
   マスの位置（pos:16 の「みんなで話す」など）がその盤面の並びに合わせてあるため。
   「ぜんぶ」（36マス）の盤面は board.stories.js に別のストーリーとして置いている。 */
const MODE = "short";
const B = R.mode(MODE);

const clone = value => structuredClone(value);
const FAMILY_BY_ID = Object.fromEntries(R.FAMILIES.map(family => [family.id, family]));
const PLAYER_IDS = ["player-1", "player-2", "player-3", "player-4"];

/** Build a player with the same public and private fields as src/index.js. */
export function createPlayer(index = 0, overrides = {}) {
  const famId = overrides.familyId || ["w1", "w2", "w3", "w4"][index % 4];
  const fam = clone(FAMILY_BY_ID[famId] || FAMILY_BY_ID.w1);
  const learner = fam.perk === "kinben" || fam.perk === "kokusai";
  const player = {
    id: PLAYER_IDS[index] || `player-${index + 1}`,
    name: ["Mika", "Ren", "Amina", "Kai"][index % 4],
    color: R.PCOLORS[index % R.PCOLORS.length],
    connected: true, pos: 0, money: fam.money, initMoney: fam.money,
    allow: fam.allow, learn: learner ? 2 : 1, initLearn: learner ? 2 : 1,
    happy: 0, fam, perk: fam.perk, hidden: [...fam.hide], mult: fam.rural ? 5 : 10,
    aai: false, univ: false, loan: 0, open: 0, locked: 0, unseen: 0,
    doorLog: [], shienDiscount: false, shienUsed: false, deaiUsed: false,
    hadHeavy: false, disasterTurns: 0, letterIn: null, wageShown: false,
    done: false, rankAt: null, seen: false, left: false,
    ...overrides,
  };
  player.fam = clone(overrides.fam || fam);
  player.hidden = [...(overrides.hidden || player.fam.hide || [])];
  return player;
}

/** Build a game state using the room's g.players schema. */
export function createGame(overrides = {}) {
  const players = overrides.players || [createPlayer(0)];
  return {
    phase: "play", hostId: players[0]?.id || PLAYER_IDS[0], turn: 0,
    dice: null, pending: null, heavyOn: false, mode: MODE, players,
    ...overrides,
  };
}

/** Build the browser message shape (the g/you split mirrors stateFor()). */
export function createState({ game = createGame(), viewerId, you, ...gameOverrides } = {}) {
  const g = { ...game, ...gameOverrides };
  const viewer = g.players.find(player => player.id === (viewerId || g.players[0]?.id));
  const privateState = you === undefined && viewer?.fam ? {
    fam: viewer.fam, hidden: viewer.hidden, perk: viewer.perk, mult: viewer.mult,
    allow: viewer.allow, loan: viewer.loan, aai: viewer.aai,
    shienDiscount: viewer.shienDiscount, seen: viewer.seen,
    open: viewer.open, locked: viewer.locked, unseen: viewer.unseen,
    myChoices: (viewer.doorLog || []).filter(entry => entry.chosen != null).map(entry => ({
      age: entry.age, door: entry.title, variant: entry.variant,
      t: entry.opts[entry.chosen].t, d: entry.opts[entry.chosen].d,
      fx: entry.appliedFx || entry.opts[entry.chosen].fx,
    })),
  } : you;
  const reveal = g.phase === "result";
  const players = g.players.map(player => {
    const publicPlayer = {
      id: player.id, name: player.name, color: player.color, connected: player.connected,
      pos: player.pos, money: player.money, learn: player.learn, happy: player.happy,
      done: player.done, rankAt: player.rankAt, seen: player.seen, left: !!player.left,
    };
    if (reveal) for (const key of [
      "fam", "perk", "mult", "aai", "univ", "hidden", "deaiUsed", "initMoney", "initLearn",
      "open", "locked", "unseen", "doorLog", "loan",
    ]) publicPlayer[key] = player[key];
    return publicPlayer;
  });
  return { t: "state", pid: viewerId || viewer?.id, g: { ...g, players }, you: privateState };
}

function makeChoicePending(player, key, { type = "choice", skipCount = false, heavy = false } = {}) {
  const def = key === "heavy" ? R.heavyDef({ ...player, fam: player.fam }) : R.choiceDef(key, player, B);
  const states = def.opts.map(option => option.tag && player.hidden.includes(option.tag)
    ? "unseen" : R.meetsReq(player, option) ? "open" : "locked");
  return {
    kind: "choice", for: player.id, type: heavy ? "heavy" : type,
    def: { title: def.title, body: def.body, variant: def.variant, heavy: !!(heavy || def.heavy) },
    opts: def.opts, states,
    actor: {
      name: player.name, money: player.money, learn: player.learn, pos: player.pos,
      perk: player.perk, mult: player.mult, shienDiscount: player.shienDiscount, univ: player.univ,
    },
  };
}

export function createChoiceState({ familyId = "w1", key = "shinro", viewer = "actor", player: playerOverrides = {}, ...options } = {}) {
  const player = createPlayer(0, { familyId, pos: key === "shinro" ? 4 : 12, ...playerOverrides });
  const pending = makeChoicePending(player, key, options);
  const game = createGame({ phase: "play", players: [player], pending });
  if (viewer === "spectator") {
    const spectator = createPlayer(1, { pos: Math.max(0, player.pos - 1) });
    game.players.push(spectator);
    const privatePending = { ...pending, def: { title: pending.def.title, heavy: pending.def.heavy } };
    delete privatePending.opts;
    delete privatePending.states;
    delete privatePending.actor;
    game.pending = privatePending;
    return createState({ game, viewerId: spectator.id });
  }
  return createState({ game, viewerId: player.id });
}

function createDoorLog(player, key, chosen = 0) {
  const def = R.choiceDef(key, player, B);
  const states = def.opts.map(option => option.tag && player.hidden.includes(option.tag)
    ? "unseen" : R.meetsReq(player, option) ? "open" : "locked");
  return {
    title: def.title, variant: def.variant, age: B.AGES[player.pos], opts: def.opts,
    states, chosen, appliedFx: chosen == null ? undefined : { ...def.opts[chosen].fx },
  };
}

export function createResultPlayer(index = 0, overrides = {}) {
  const player = createPlayer(index, {
    pos: 23, money: 90 + index * 35, learn: 5 + index, happy: 4 + index,
    initMoney: FAMILY_BY_ID[["w1", "w2", "w3", "w4"][index % 4]].money,
    done: true, rankAt: index + 1, seen: true,
    open: 3, locked: 1, unseen: 2,
    ...overrides,
  });
  player.doorLog = overrides.doorLog || [
    { ...createDoorLog(player, "shinro", player.perk === "deai" ? 1 : 0), age: 15 },
    { ...createDoorLog(player, "kurashi", 1), age: 18 },
    { ...createDoorLog(player, "daigaku", player.perk === "shienPro" ? 0 : 3), age: 19 },
    { ...createDoorLog(player, "machi", 1), age: 21 },
    { ...createDoorLog(player, "ginou", 2), age: 22 },
    { ...createDoorLog(player, "shigoto", 3), age: 24 },
  ];
  return player;
}

const info = (player, type, title, body, fx = {}, note = null, pnote = null) => ({
  kind: "info", for: player.id, type, title, body, note, pnote, fx,
});

/* 家庭カードは、家庭ごとに見る人の席を1つずつずらす。
   席によってプレイヤー色（R.PCOLORS）と名前・顔が変わるので、
   6枚を並べたときにカードの違いが見分けやすくなる。
   色は6色あるので、6枚がそれぞれ別の色になる。 */
export const familyCardScenarios = R.FAMILIES.map((family, index) => {
  const me = index % R.PCOLORS.length;
  return {
    id: `family-${family.id}`, name: family.name.ja,
    state: createState({
      game: createGame({ phase: "cards", players: Array.from({ length: 4 }, (_, i) => createPlayer(i, {
        familyId: i === me ? family.id : ["w1", "w2", "w5", "w6"][i % 4], seen: i !== me,
      })) }),
      viewerId: PLAYER_IDS[me],
    }),
  };
});

export const choiceScenarios = [
  ["shinro", "w1"], ["shinro", "w6"],
  ["kurashi", "w1"], ["kurashi", "w3"],
  ["daigaku", "w1"], ["daigaku", "w5"], ["daigaku", "w6"],
  ["machi", "w1"], ["machi", "w3"],
  ["ginou", "w3"], ["ginou", "w5"],
  ["shigoto", "w1"], ["shigoto", "w3"],
].map(([key, familyId]) => ({
  id: `door-${key}-${familyId}`, name: `${key} / ${familyId}`,
  state: createChoiceState({ familyId, key }),
}));

const firstChore = B.SQUARES[1].name;
const simpleEvent = R.EVENTS.find(event => event.kind === "info" && event.reveal === "any");
const infoPlayer = createPlayer(0, { pos: 5, money: 85, learn: 3, happy: 2 });
const talkPlayer = createPlayer(0, { pos: 16, money: 130, learn: 7, happy: 5 });
const resultPlayer = createResultPlayer(0, { loan: 30 });

export const pendingScenarios = [
  { id: "first-income", name: "はじめてのお手伝い", state: createState({ game: createGame({ pending: info(infoPlayer, "income", firstChore, { ja: "はじめての、自分のかせぎ！", en: "Your first money of your own!" }, { money: 15 }) }) }) },
  {
    id: "income-first-pay", name: "初回のお給料",
    state: createState({ game: createGame({ pending: info(infoPlayer, "income",
      { ja: "16歳・いまのしごと：見習い", en: "Age 16 · Current job: Apprentice" },
      { ja: "かせぎは 基本給20万 ＋ まなび×10万 ＋ 仕送り10万", en: "Pay = base ¥200k + Learn × ¥100k + allowance ¥100k" },
      { money: 60 }, { ja: "学びが増えると、しごともかせぎも変わっていく", en: "As learning grows, jobs and pay change too" }) }) }),
  },
  {
    id: "income-loan-disaster", name: "返済・災害影響のある収入",
    state: createState({ game: createGame({ pending: info(
      createPlayer(2, { familyId: "w6", pos: 10, money: 70, learn: 4, loan: 24, disasterTurns: 2 }), "income",
      { ja: "19歳・いまのしごと：見習い", en: "Age 19 · Current job: Apprentice" },
      { ja: "かせぎ ＝ 基本給10万 ＋ まなび★4×5万", en: "Pay = base ¥100k + Learn ★4 × ¥50k" },
      { money: 12 }, { ja: "奨学金の返済 −6万（のこり18万）／災害の影響で −10万", en: "Scholarship repayment −¥60k / disaster impact −¥100k" }) }) }),
  },
  { id: "expense", name: "急な病気の医療費", state: createState({ game: createGame({ pending: info(infoPlayer, "cost", B.SQUARES[12].name, { ja: "生きているとお金はかかる。固定費、だいじ。", en: "Living costs money. Watch those fixed costs." }, { money: -30 }) }) }) },
  { id: "event-info", name: "情報に出会うできごと", state: createState({ game: createGame({ pending: info(infoPlayer, "event", simpleEvent.t, simpleEvent.d, {}, null, { ja: "見えていなかった選択肢が1個、見えるようになった！", en: "1 hidden option became visible!" }) }) }) },
  { id: "talk", name: "全員で話し合い", state: createState({ game: createGame({ pending: info(talkPlayer, "talk", R.TALK.title, R.TALK.body, {}, { ja: `${R.TALK.asks.ja}<br><br>${R.TALK.note.ja}`, en: `${R.TALK.asks.en}<br><br>${R.TALK.note.en}` }) }) }) },
  { id: "choice-result", name: "選択後の結果", state: createState({ game: createGame({ pending: { kind: "result", for: infoPlayer.id, type: "choice", title: R.choiceDef("kurashi", infoPlayer, B).opts[1].t, body: R.choiceDef("kurashi", infoPlayer, B).opts[1].d, notes: [], pnotes: [], fx: { money: 50 } } }) }) },
  { id: "goal-with-loan", name: "ゴール・返済残額あり", state: createState({ game: createGame({ players: [resultPlayer], pending: { kind: "goal", for: resultPlayer.id, rankAt: 1, loan: 30, fx: { happy: 1 } } }) }) },
];

export const lobbyScenarios = [
  { id: "lobby-host-alone", name: "進行役ひとり", state: createState({ game: createGame({ phase: "lobby" }) }) },
  { id: "lobby-four-players", name: "4人・接続中", state: createState({ game: createGame({ phase: "lobby", players: [0, 1, 2, 3].map(i => createPlayer(i)) }) }) },
  { id: "lobby-host-disconnected", name: "進行役切断・引き継ぎ可能", state: createState({ game: createGame({ phase: "lobby", players: [createPlayer(0, { connected: false }), createPlayer(1)] }) , viewerId: PLAYER_IDS[1] }) },
];

export const boardScenarios = [
  { id: "board-child-step", name: "子ども時代・一歩", state: createState({ game: createGame({ players: [createPlayer(0, { pos: 2 }), createPlayer(1, { pos: 3 })] }) }) },
  { id: "board-my-dice-turn", name: "自分のサイコロ手番", state: createState({ game: createGame({ players: [createPlayer(0, { pos: 8 }), createPlayer(1, { pos: 10 })], turn: 0 }) }) },
  { id: "board-other-turn", name: "ほかの人の手番", state: createState({ game: createGame({ players: [createPlayer(0, { pos: 8 }), createPlayer(1, { pos: 10 })], turn: 1 }), viewerId: PLAYER_IDS[0] }) },
  { id: "board-mixed-status", name: "同じマス・完了・退出・切断", state: createState({ game: createGame({ players: [createPlayer(0, { pos: 14 }), createPlayer(1, { pos: 14, connected: false }), createPlayer(2, { pos: 23, done: true }), createPlayer(3, { pos: 18, left: true, done: true })], turn: 0 }) }) },
];

export const resultScenarios = [
  { id: "result-single", name: "1人プレイ", state: createState({ game: createGame({ phase: "result", players: [createResultPlayer(0)] }) }) },
  { id: "result-four-and-left", name: "複数順位・同点・奨学金・途中退出", state: createState({ game: createGame({ phase: "result", players: [createResultPlayer(0, { happy: 7 }), createResultPlayer(1, { happy: 7, loan: 24 }), createResultPlayer(2, { happy: 4, loan: 6 }), createResultPlayer(3, { left: true, done: true, doorLog: [] })] }) }) },
];

export const hostScenarios = [
  { id: "host-lobby", name: "待機中", state: createState({ game: createGame({ phase: "lobby", players: [createPlayer(0), createPlayer(1, { connected: false })] }) }) },
  { id: "host-cards", name: "家庭カード確認中", state: createState({ game: createGame({ phase: "cards", players: [createPlayer(0, { seen: true }), createPlayer(1, { seen: false })] }) }) },
  { id: "host-playing", name: "ゲーム中・手番スキップ", state: createState({ game: createGame({ players: [createPlayer(0, { pos: 9 }), createPlayer(1, { pos: 8, connected: false })], turn: 1 }) }) },
];

export const scenarioGroups = [
  { id: "lobby", title: "ロビー", scenarios: lobbyScenarios },
  { id: "board", title: "ゲーム盤面・手番", scenarios: boardScenarios },
  { id: "family-cards", title: "家庭カード", scenarios: familyCardScenarios },
  { id: "doors", title: "トビラ選択", scenarios: choiceScenarios },
  { id: "pending", title: "情報・結果モーダル", scenarios: pendingScenarios },
  { id: "results", title: "結果発表", scenarios: resultScenarios },
  { id: "host-tools", title: "進行役メニュー", scenarios: hostScenarios },
];

export const allScenarios = scenarioGroups.flatMap(group => group.scenarios.map(scenario => ({
  ...scenario, groupId: group.id, groupTitle: group.title,
})));

const preview = (message, options = {}) => ({
  ...options, g: message?.g || null, you: message?.you || null,
  pid: message?.pid || message?.g?.players?.[0]?.id || PLAYER_IDS[0],
});
const playPreview = (game, viewerId, options = {}) => preview(createState({ game, viewerId }), { view: "play", ...options });
const makePendingChoice = (player, def, type = "heavy") => {
  const states = def.opts.map(option => option.tag && player.hidden.includes(option.tag)
    ? "unseen" : R.meetsReq(player, option) ? "open" : "locked");
  return {
    kind: "choice", for: player.id, type,
    def: { title: def.title, body: def.body, variant: def.variant, heavy: !!def.heavy },
    opts: def.opts, states,
    actor: { name: player.name, money: player.money, learn: player.learn, pos: player.pos,
      perk: player.perk, mult: player.mult, shienDiscount: player.shienDiscount, univ: player.univ },
  };
};
const pendingChoicePreview = (player, def, options = {}) => playPreview(
  createGame({ players: [player], pending: makePendingChoice(player, def, options.type || "heavy") }),
  player.id, options,
);

const child = createPlayer(0, { pos: 2 });
const incomeActor = createPlayer(0, { pos: 5, money: 95, learn: 4, happy: 2 });
const fairActor = createPlayer(2, { familyId: "w6", pos: 6, money: 20, learn: 2 });
const lossActor = createPlayer(1, { familyId: "w2", pos: 6, money: 100, learn: 2, allow: 0 });
const ruralActor = createPlayer(2, { familyId: "w3", pos: 6, money: 50, learn: 2 });
const urbanActor = createPlayer(0, { pos: 6, money: 130, learn: 3 });
const careerDegreeActor = createPlayer(0, { pos: 20, money: 90, learn: 7, univ: true });
const careerNoDegreeActor = createPlayer(2, { familyId: "w3", pos: 20, money: 30, learn: 2, univ: false });
const reviewPlayer = createPlayer(0, { pos: 10, open: 2, locked: 1, unseen: 1, happy: 1 });
reviewPlayer.doorLog = [
  { ...createDoorLog(reviewPlayer, "shinro", 2), age: 15 },
  { ...createDoorLog(reviewPlayer, "kurashi", 1), age: 18 },
];

const specialHeavy = (title, body, options) => ({ heavy: true, title, body, opts: options });
const lossDef = specialHeavy(
  { ja: "家族が、病気で亡くなった。", en: "Someone in your family died of illness." },
  { ja: "しばらくして、暮らしの計算が変わっていることに気づく。", en: "A while later, you notice daily life has changed." },
  [
    { t: { ja: "遺児を支える団体・奨学金について調べる", en: "Look into orphan-support groups & scholarships" }, d: { ja: "世界には、親を亡くした子を支える仕組みがある", en: "The world has systems for children who lost a parent" }, req: {}, fx: { learn: 1 }, special: "shienSupport" },
    { t: { ja: "今は、何も考えられない", en: "You can't think about anything right now" }, d: { ja: "それでいい。時間が必要なときもある", en: "That's okay. Sometimes you need time" }, req: {}, fx: {}, special: "letter" },
  ],
);
const droughtDef = specialHeavy(
  { ja: "雨が、何か月も降らない。", en: "The rain hasn't come for months." },
  { ja: "干ばつで畑の作物が枯れていく。井戸の水も減ってきた。", en: "Drought is killing the crops. The well is running low." },
  [
    { t: { ja: "支援団体の食料・種の支援を調べる", en: "Look into food & seed aid" }, d: { ja: "こういうときのための仕組みがある", en: "Systems exist for times like this" }, req: {}, fx: { money: 30, learn: 1 } },
    { t: { ja: "たくわえでしのぐ", en: "Get by on savings" }, d: { ja: "備えがあれば、乗りこえられる", en: "Being prepared carries you through" }, req: { money: 30 }, fx: { money: -30 } },
  ],
);
const disasterDef = specialHeavy(
  { ja: "深夜、大きな地震があった。", en: "A big earthquake struck in the night." },
  { ja: "家族は無事だった。ただ、家と親の職場は無事ではなかった。", en: "Your family is safe. Your home and a parent's workplace are not." },
  [
    { t: { ja: "災害支援制度・義援金について調べる", en: "Look into disaster aid & relief funds" }, d: { ja: "こういうときのための仕組みがある", en: "Systems exist for times like this" }, req: {}, fx: { money: 30, learn: 1 } },
    { t: { ja: "貯金でしのぐ", en: "Get by on savings" }, d: { ja: "備えがあれば、乗りこえられる", en: "Being prepared carries you through" }, req: { money: 30 }, fx: { money: -30 } },
  ],
);

const familyById = id => familyCardScenarios.find(scenario => scenario.id === `family-${id}`).state;
const doorState = (key, familyId, playerOverrides = {}, options = {}) => createChoiceState({
  key, familyId, player: playerOverrides, ...options,
});
const withModal = (message, modal, options = {}) => preview(message, { ...options, view: options.view || "play", modal });

export const scenarios = {
  lobby: {
    initial: { view: "lobby" },
    nameEntered: { view: "lobby", name: "Amina" },
    createError: { view: "lobby", error: { ja: "ルームを作成できませんでした", en: "Couldn't create room" } },
    joinError: { view: "lobby", error: { ja: "コードを入れてください", en: "Enter a room code" } },
  },
  waiting: {
    hostSolo: preview(createState({ game: createGame({ phase: "lobby" }) }), { view: "wait" }),
    hostMulti: preview(createState({ game: createGame({ phase: "lobby", players: [createPlayer(0), createPlayer(1), createPlayer(2)] }) }), { view: "wait" }),
    guestWaiting: preview(createState({ game: createGame({ phase: "lobby", players: [createPlayer(0), createPlayer(1)] }), viewerId: PLAYER_IDS[1] }), { view: "wait" }),
    hostOffline: preview(createState({ game: createGame({ phase: "lobby", players: [createPlayer(0, { connected: false }), createPlayer(1)] }), viewerId: PLAYER_IDS[1] }), { view: "wait" }),
  },
  board: {
    checkingCardsHost: preview(createState({ game: createGame({ phase: "cards", players: [createPlayer(0, { seen: false }), createPlayer(1, { seen: true })] }) }), { view: "game" }),
    checkingCardsGuest: preview(createState({ game: createGame({ phase: "cards", players: [createPlayer(0, { seen: false }), createPlayer(1, { seen: true })] }), viewerId: PLAYER_IDS[1] }), { view: "game" }),
    childhoodStep: playPreview(createGame({ players: [child, createPlayer(1, { pos: 3 })] }), child.id),
    diceTurn: playPreview(createGame({ players: [createPlayer(0, { pos: 8 }), createPlayer(1, { pos: 10 })] }), PLAYER_IDS[0]),
    otherPlayerTurn: playPreview(createGame({ players: [createPlayer(0, { pos: 8 }), createPlayer(1, { pos: 10 })], turn: 1 }), PLAYER_IDS[0]),
    disconnectedTurn: playPreview(createGame({ players: [createPlayer(0, { pos: 8 }), createPlayer(1, { pos: 10, connected: false })], turn: 1 }), PLAYER_IDS[0]),
    mixedPlayers: playPreview(createGame({ players: [createPlayer(0, { pos: 14 }), createPlayer(1, { pos: 14 }), createResultPlayer(2), createPlayer(3, { pos: 18, left: true, done: true })] }), PLAYER_IDS[0]),
  },
  dice: {
    rolling: withModal(createState({ game: createGame({ players: [createPlayer(0, { pos: 8 })] }) }), { type: "dice", dice: "rolling", diceValue: 4 }),
    landed: withModal(createState({ game: createGame({ players: [createPlayer(0, { pos: 8 })], dice: 5 }) }), { type: "dice", dice: "landed", diceValue: 5 }),
  },
  family: {
    western: preview(familyById("w1"), { view: "game", modal: "card" }),
    japan: preview(familyById("w2"), { view: "game", modal: "card" }),
    uganda: preview(familyById("w3"), { view: "game", modal: "card" }),
    expat: preview(familyById("w4"), { view: "game", modal: "card" }),
    orphanWithSupport: preview(familyById("w5"), { view: "game", modal: "card" }),
    orphanWithoutSupport: preview(familyById("w6"), { view: "game", modal: "card" }),
    waitingForOthers: preview(createState({ game: createGame({ phase: "cards", players: [createPlayer(0, { seen: true }), createPlayer(1, { seen: false })] }) }), { view: "game" }),
    cardReview: preview(createState({ game: createGame({ players: [reviewPlayer] }) }), { view: "game", modal: "card" }),
  },
  information: {
    incomeGain: withModal(createState({ game: createGame({ players: [incomeActor], pending: info(incomeActor, "income", { ja: "16歳・いまのしごと：見習い", en: "Age 16 · Current job: Apprentice" }, { ja: "かせぎは 基本給20万 ＋ まなび×4 ＋ 仕送り10万", en: "Pay = base + Learn × 4 + allowance" }, { money: 70 }) }) }), null),
    incomeNoChange: withModal(createState({ game: createGame({ players: [incomeActor], pending: info(incomeActor, "income", { ja: "19歳・いまのしごと：見習い", en: "Age 19 · Current job: Apprentice" }, { ja: "かせぎ＝基本給＋まなび×倍率", en: "Pay = base + learning × multiplier" }, {}) }) }), null),
    expense: withModal(createState({ game: createGame({ players: [incomeActor], pending: info(incomeActor, "cost", B.SQUARES[12].name, { ja: "生きているとお金はかかる。固定費、だいじ。", en: "Living costs money. Watch those fixed costs." }, { money: -30 }) }) }), null),
    learning: playPreview(createGame({ players: [createPlayer(0, { pos: 3, learn: 1 }), createPlayer(1)] , pending: makePendingChoice(createPlayer(0, { pos: 3 }), R.choiceDef("learnSq", createPlayer(0, { pos: 3 })), "learn") }), PLAYER_IDS[0]),
    eventPositive: withModal(createState({ game: createGame({ players: [infoPlayer], pending: info(infoPlayer, "event", R.EVENTS.find(event => event.kind === "info").t, R.EVENTS.find(event => event.kind === "info").d, { learn: 1, happy: 1 }) }) }), null),
    eventNegative: withModal(createState({ game: createGame({ players: [infoPlayer], pending: info(infoPlayer, "event", R.EVENTS[4].t, R.EVENTS[4].d, R.EVENTS[4].fx) }) }), null),
    talkTogether: withModal(createState({ game: createGame({ players: [talkPlayer], pending: info(talkPlayer, "talk", R.TALK.title, R.TALK.body, {}, { ja: R.TALK.asks.ja, en: R.TALK.asks.en }) }) }), null),
    noStatusChange: withModal(createState({ game: createGame({ players: [infoPlayer], pending: { kind: "result", for: infoPlayer.id, type: "event", title: { ja: "今回は数字は変わらなかった", en: "No change this time" }, body: { ja: "それでも、出会った人や話は残っていく。", en: "The people and stories you met still stay with you." }, notes: [], pnotes: [], fx: {} } }) }), null),
  },
  doors: {
    school: preview(doorState("shinro", "w1"), { view: "game" }),
    homeRural: preview(doorState("kurashi", "w3"), { view: "game" }),
    homeUrban: preview(doorState("kurashi", "w1"), { view: "game" }),
    universityOrphan: preview(doorState("kaigai", "w5"), { view: "game" }),
    universityOther: preview(doorState("kaigai", "w1"), { view: "game" }),
    townRural: preview(doorState("machi", "w3"), { view: "game" }),
    townUrban: preview(doorState("machi", "w1"), { view: "game" }),
    skills: preview(doorState("ginou", "w3"), { view: "game" }),
    career: preview(doorState("shigoto", "w1", { pos: 20, money: 100, learn: 7, univ: true }), { view: "game" }),
    learning: preview(doorState("learnSq", "w3", { pos: 15, money: 20, learn: 2 }), { view: "game" }),
  },
  doorStates: {
    choiceListMixed: preview(doorState("kaigai", "w3", { pos: 11, money: 30, learn: 2 }), { view: "game" }),
    choiceListVisible: preview(doorState("kurashi", "w1", { pos: 9, money: 20 }), { view: "game" }),
    confirmOpen: { ...preview(doorState("kurashi", "w1", { pos: 9, money: 130 }), { view: "game" }), modal: { type: "choiceConfirm", index: 1 } },
    confirmLockedMoney: { ...preview(doorState("kaigai", "w1", { pos: 11, money: 20, learn: 4 }), { view: "game" }), modal: { type: "choiceConfirm", index: 0 } },
    confirmLockedLearn: { ...preview(doorState("kaigai", "w1", { pos: 11, money: 150, learn: 1 }), { view: "game" }), modal: { type: "choiceConfirm", index: 0 } },
    discountedMoney: { ...preview(doorState("kaigai", "w4", { pos: 11, money: 110, learn: 4 }), { view: "game" }), modal: { type: "choiceConfirm", index: 0 } },
  },
  heavy: {
    loss: pendingChoicePreview(lossActor, lossDef, { type: "heavy" }),
    drought: pendingChoicePreview(ruralActor, droughtDef, { type: "heavy" }),
    disaster: pendingChoicePreview(urbanActor, disasterDef, { type: "heavy" }),
    supportLetter: pendingChoicePreview(createPlayer(2, { familyId: "w6", pos: 8 }), R.letterDef(), { type: "heavy" }),
  },
  watching: {
    watchingChoice: preview(createChoiceState({ familyId: "w1", key: "kaigai", viewer: "spectator" }), { view: "game" }),
    watchingInfo: preview(createState({ game: createGame({ players: [createPlayer(1, { pos: 2 }), createPlayer(0)], turn: 0, pending: info(createPlayer(1, { pos: 2 }), "event", simpleEvent.t, simpleEvent.d) }), viewerId: PLAYER_IDS[0] }), { view: "game" }),
    watchingResult: preview(createState({ game: createGame({ players: [createPlayer(1, { pos: 9 }), createPlayer(0)], turn: 0, pending: { kind: "result", for: PLAYER_IDS[1], type: "choice", title: { ja: "実家でしっかり貯金", en: "Stay home and save" }, body: { ja: "堅実もりっぱな選択", en: "Playing it steady is a fine choice" }, notes: [], pnotes: [], fx: { money: 50 } } }), viewerId: PLAYER_IDS[0] }), { view: "game" }),
  },
  results: {
    solo: preview(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0)] }) }), { view: "result" }),
    multiplayer: preview(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0, { happy: 7 }), createResultPlayer(1, { happy: 7 }), createResultPlayer(2, { happy: 3 })] }) }), { view: "result" }),
    unpaidLoan: preview(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0, { loan: 24 })] }) }), { view: "result" }),
    playerLeft: preview(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0), createResultPlayer(1, { left: true, done: true, doorLog: [] })] }) }), { view: "result" }),
  },
  reveal: {
    mixedDoorStates: withModal(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0)] }) }), "reveal", { view: "result" }),
    noDoors: withModal(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0, { doorLog: [], open: 0, locked: 0, unseen: 0 })] }) }), "reveal", { view: "result" }),
  },
  allDoors: {
    playerChoices: withModal(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0), createResultPlayer(1)] }) }), "allDoors", { view: "result" }),
    untrodden: withModal(createState({ game: createGame({ phase: "result", players: [createResultPlayer(0, { doorLog: [] })] }) }), "allDoors", { view: "result" }),
  },
  help: Object.fromEntries(Array.from({ length: 6 }, (_, page) => {
    const key = ["intro", "goal", "doorsAndKeys", "learningAndMoney", "familyCards", "whyUganda"][page];
    return [key, withModal(createState({ game: createGame({ players: [createPlayer(0, { pos: 10 })] }) }), { type: "rules", page })];
  })),
  host: {
    lobby: withModal(createState({ game: createGame({ phase: "lobby", players: [createPlayer(0), createPlayer(1)] }) }), "host", { view: "wait" }),
    cards: withModal(createState({ game: createGame({ phase: "cards", players: [createPlayer(0, { seen: true }), createPlayer(1, { seen: false })] }) }), "host", { view: "game" }),
    play: withModal(createState({ game: createGame({ players: [createPlayer(0, { pos: 8 }), createPlayer(1, { pos: 9 })], turn: 1 }) }), "host", { view: "game" }),
  },
};
