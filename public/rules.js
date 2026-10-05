/* ===== トビラ せかい版 — 共有ルールモジュール =====
   サーバー(Durable Object)とブラウザの両方から読み込む。DOMに触れない純粋なデータとロジックだけを置く。
   ゲームバランス・文言は1画面版(door-world-game)と同一に保つこと。 ===== */

/* プレイヤーの色。キャラ(CHARS)と同じ順番で対応させる */
const PCOLORS = ["#F4879F","#6FA9DD","#A98BD9","#6FC49B","#E89A5C","#57BCC9"];
/* マスの見た目。icon はアプリ側で描いたSVGのid、fill=面、ink=文字、chip=見出しの帯 */
const TYPE_META = {
  start:{label:{ja:"スタート",en:"Start"}, icon:"start", fill:"#F4879F", ink:"#FFFFFF", chip:"#F4879F"},
  goal:{label:{ja:"ゴール",en:"Goal"}, icon:"goal", fill:"#FBD96B", ink:"#7A6320", chip:"#E0AE28"},
  income:{label:{ja:"おしごと",en:"Work"}, icon:"coin", fill:"#FCE7A6", ink:"#6B5720", chip:"#D9A32B"},
  cost:{label:{ja:"しゅっぴ",en:"Expense"}, icon:"cost", fill:"#F9C9C9", ink:"#8E4A4A", chip:"#D9737B"},
  event:{label:{ja:"できごと",en:"Event"}, icon:"bolt", fill:"#DCD3F5", ink:"#54487A", chip:"#8878C4"},
  learn:{label:{ja:"まなび",en:"Learning"}, icon:"book", fill:"#C6E3F7", ink:"#2F5E80", chip:"#4E8FC0"},
  choice:{label:{ja:"トビラ",en:"Door"}, icon:"door", fill:"#F7A9C4", ink:"#FFFFFF", chip:"#E4708F"},
  talk:{label:{ja:"はなしあい",en:"Talk"}, icon:"people", fill:"#CDEBDD", ink:"#2F6B52", chip:"#5FA882"},
  heavy:{label:{ja:"できごと",en:"Event"}, icon:"bolt", fill:"#E7D6C6", ink:"#6B5442", chip:"#B08968"},
  fam:{label:{ja:"家庭カード",en:"Family Card"}, icon:"home", fill:"#E9A87C", ink:"#FFFFFF", chip:"#D98E63"},
};

/* 生まれた場所ごとの家庭カードの色帯 */
const FAM_TONE = {
  "欧米":["#8FB8E0","#6E9BCC"], "日本":["#F2A0BC","#E4809F"],
  "ウガンダ":["#E9A87C","#D98E63"], "ウガンダ（駐在）":["#9ECFC4","#79B3A6"],
};

/* プレイヤーに割りあてるキャラ（家庭カードとは無関係。ランダムに配る） */
/* ロビー（家庭カードを配る前）でだけ使う、席ごとの仮のキャラ。
   p5・p6 はコードで描いた仮の絵だが、配ったあとは下の CHAR_POOL から選びなおすので、
   ゲーム中に出ることはない */
const CHARS = ["p1","p2","p3","p4","p5","p6"];

/* ── キャラは家庭カードで決まる（2026-10-06〜） ──
   家庭カードを全員に見せるようにしたので、見た目も生まれた場所にそろえる。
   FAM_LOOK で家庭→見た目の系統、CHAR_POOL でその系統のキャラを選ぶ。
   1ゲームに同じキャラは出さない。ウガンダの家庭(w3/w5/w6)は最大3人同時に出るので、
   黒人の子は服の色ちがい(bb2/bg2)まで用意してあり、足りないときだけ使う。
   プレイヤーの色(リングや名札の色)は、キャラの服の色にそろえる。 */
const FAM_LOOK = {
  w1: "white",   /* 欧米 */
  w2: "jp",      /* 日本 */
  w3: "black",   /* ウガンダ・両親あり */
  w4: "jp",      /* 外交官としてウガンダに駐在（「長期休みには帰国する」ので日本から来た家庭として描く） */
  w5: "black",   /* ウガンダの遺児・支援あり */
  w6: "black",   /* ウガンダの遺児・支援なし */
};
/* 系統ごとのキャラ。内側の配列が優先順で、前の段が埋まったときだけ次の段を使う */
const CHAR_POOL = {
  jp:    [["p1","p2","p3","p4"]],
  white: [["wb","wg"]],
  black: [["bb","bg"], ["bb2","bg2"]],   /* bb2/bg2 は bb/bg の服の色ちがい */
};
const CHAR_COLOR = {
  p1:"#F4879F", p2:"#6FA9DD", p3:"#A98BD9", p4:"#6FC49B", p5:"#E89A5C", p6:"#57BCC9",
  wb:"#86B8F2", wg:"#F5A3B3", bb:"#3FB6BF", bg:"#F47A70", bb2:"#E5B23C", bg2:"#93C84A",
};
/* 家庭が配られたプレイヤーに、キャラと色を割りあてる（サーバーで1回だけ呼ぶ） */
function assignChars(players){
  const used = new Set();
  for(const p of players){
    const tiers = CHAR_POOL[FAM_LOOK[p.fam && p.fam.id]] || CHAR_POOL.jp;
    let pick = null;
    for(const tier of tiers){
      const free = tier.filter(c => !used.has(c));
      if(free.length){ pick = free[Math.floor(Math.random()*free.length)]; break; }
    }
    if(!pick){ const all = tiers.flat(); pick = all[Math.floor(Math.random()*all.length)]; }  /* 理論上こない */
    used.add(pick);
    p.char = pick; p.color = CHAR_COLOR[pick];
  }
}

/* 家庭カード(6種) hide: shien=支援・奨学金 / chiiki=支え合い / career=しごと / global=海外 */
const FAMILIES = [
  {id:"w1", name:{ja:"欧米に生まれた家庭",en:"A family in a Western country"}, region:{ja:"欧米",en:"a Western country"}, rural:false, money:150, allow:10, wage:20,
   hide:["chiiki"], perk:"eigo",
   asa:{ja:"スクールバスで10分。朝食はシリアルとオレンジジュース。",en:"A 10-minute school bus ride. Cereal and orange juice for breakfast."},
   daily:{ja:"約8,000円",en:"about ¥8,000"}, dailyNote:"",
   story:{ja:"学校に行くのは「当たり前」。図書館もネットも、ぜんぶそろっている。ただ、となりの家の人の名前は、じつは知らない。",
          en:"Going to school is just \"normal\". Libraries, internet — it's all there. But honestly, you don't know your neighbor's name."},
   perkText:{ja:"英語ネイティブ：海外・留学系のトビラの ★のカギが2つ軽くなる",
             en:"Native English: study-abroad doors need 2 fewer ★"}},
  {id:"w2", name:{ja:"日本に生まれた家庭",en:"A family in Japan"}, region:{ja:"日本",en:"Japan"}, rural:false, money:120, allow:5, wage:20,
   hide:["chiiki","shien"], perk:"kinben",
   asa:{ja:"7時に起きて、電車で20分。コンビニに寄る余裕もある。",en:"Up at 7, a 20-minute train ride — with time to stop at a convenience store."},
   daily:{ja:"約6,000円",en:"about ¥6,000"}, dailyNote:"",
   story:{ja:"教科書は無料で、学校には給食もある。塾にも通わせてもらった。「支援」や「奨学金」は、自分には関係ない言葉だと思っていた。",
          en:"Textbooks are free and school serves lunch. Your parents even paid for cram school. \"Aid\" and \"scholarships\" felt like words for somebody else."},
   perkText:{ja:"コツコツ力：はじめから まなび+1／独学の効果が上がる",
             en:"Steady learner: start with Learn +1 / self-study works better"}},
  {id:"w3", name:{ja:"ウガンダの、両親がそろっている家庭",en:"A Ugandan family with both parents"}, region:{ja:"ウガンダ",en:"Uganda"}, rural:true, money:40, allow:0, wage:10,
   hide:["shien","career","global"], perk:"tasukeai",
   asa:{ja:"5時起き。水くみに1時間、畑を手伝ってから、5km歩いて学校へ。",en:"Up at 5. An hour fetching water, helping in the field, then a 5 km walk to school."},
   daily:{ja:"約400円",en:"about ¥400"}, dailyNote:{ja:"学費を払う月は、ここからさらに減る",en:"school-fee months leave even less"},
   story:{ja:"学費を払う月はたいへんだ。でも困ったときは、村のみんなが助けてくれる。",
          en:"School-fee months are hard. But when trouble comes, the whole village helps out."},
   perkText:{ja:"支え合い：情報が手に入るできごとの効果が2倍",
             en:"Community: information events count double"}},
  {id:"w4", name:{ja:"外交官としてウガンダに駐在する家庭",en:"A diplomat family posted to Uganda"}, region:{ja:"ウガンダ（駐在）",en:"Uganda (expat)"}, rural:false, money:150, allow:10, wage:20,
   hide:["chiiki"], perk:"kokusai",
   asa:{ja:"運転手つきの車で外国人学校へ。窓の外には、歩いて登校する子どもたち。",en:"A chauffeured car to international school. Outside the window, kids walking to school."},
   daily:{ja:"約8,000円",en:"about ¥8,000"}, dailyNote:{ja:"ただし、門の外の暮らしはちがう",en:"though life outside the gate is different"},
   story:{ja:"インターナショナルスクールに通い、長期休みには帰国する。車の窓から見える市場の暮らしを、じつはまだ、よく知らない。",
          en:"You go to an international school and fly home for the holidays. The market life outside the car window — you don't really know it yet."},
   perkText:{ja:"国際感覚：はじめから まなび+1／海外・留学系トビラのおかねのカギ −50万",
             en:"Global sense: start with Learn +1 / study-abroad doors cost −¥500k"}},
  {id:"w5", name:{ja:"支援と出会えた、ウガンダの遺児の家庭",en:"A Ugandan orphan family — already met support"}, region:{ja:"ウガンダ",en:"Uganda"}, rural:true, money:20, allow:0, wage:10,
   hide:["career","global"], perk:"shienPro",
   asa:{ja:"5時起き。水くみと弟の世話、母の畑を手伝ってから、6km歩いて学校へ。",en:"Up at 5. Water, your little brother, your mother's field — then a 6 km walk to school."},
   daily:{ja:"約250円",en:"about ¥250"}, dailyNote:{ja:"世界の貧困ライン・1日約300円を下回る",en:"below the global poverty line of about ¥300/day"},
   story:{ja:"小さいころ、父を病気で亡くした。母と畑を守りながら学校に通う。そのとき出会った遺児支援の団体で、「支えてくれる仕組みと人」を誰よりも早く知った。",
          en:"You lost your father to illness when you were small. You keep up school while helping your mother with the field. The orphan-support group you met taught you, earlier than anyone, that help exists."},
   perkText:{ja:"支援を知っている：奨学金・支援の選択肢がすべて見えている／はじめて使うと まなび+1",
             en:"Knows support: all aid/scholarship options are visible / first use gives Learn +1"}},
  {id:"w6", name:{ja:"まだ支援と出会えていない、ウガンダの遺児の家庭",en:"A Ugandan orphan family — not yet met support"}, region:{ja:"ウガンダ",en:"Uganda"}, rural:true, money:20, allow:0, wage:10,
   hide:["shien","career","global"], perk:"deai",
   asa:{ja:"5時起き。水くみと弟の世話、母の畑を手伝ってから、6km歩いて学校へ。",en:"Up at 5. Water, your little brother, your mother's field — then a 6 km walk to school."},
   daily:{ja:"約250円",en:"about ¥250"}, dailyNote:{ja:"世界の貧困ライン・1日約300円を下回る",en:"below the global poverty line of about ¥300/day"},
   story:{ja:"小さいころ、父を病気で亡くした。母と畑を守りながら学校に通う。支えてくれる仕組みが世界にあることを、まだ誰も教えてくれていない。",
          en:"You lost your father to illness when you were small. You keep up school while helping your mother with the field. Nobody has told you yet that, somewhere in the world, there is help."},
   perkText:{ja:"出会いがチカラになる：「支援」の選択肢がはじめて見えたとき、まなび+1＆支援・まなび系のカギが −50万 になる",
             en:"A meeting becomes power: when \"aid\" options first become visible — Learn +1 & aid/learning keys cost −¥500k"}},
];

/* 各マスの年齢（6歳→25歳の19年間・ショート版） */
const AGES_SHORT = [
  6,8,10,12,15,16,
  16,17,17,18,19,19,
  20,21,21,22,22,22,
  23,24,24,25,25,25,
];
/* 盤面の行＝人生の章（1章＝6マス。PC 6列×4行／スマホ 3列×8行にきれいに収まる） */
/* 22歳の「みんなで話す」マス。
   最初にここへ来た人だけが止まり、そのあとの人は通りすぎる（全員ぶん止まると時間が足りない）。
   数字は動かさない——盤面をいちど止めて、顔を上げるためだけのマス。 */
const TALK = {
  title:{ja:"サイコロを置いて、話してみよう",en:"Put down the dice, and talk"},
  body:{ja:"22歳。ここまでの道のりは、たぶん人によってずいぶん違う。<br>おかねも、まなびも、通ってきた扉も。",
        en:"Age 22. By now your roads have probably diverged — money, learning, the doors you walked through."},
  asks:{ja:"・いま何歳で、何をしている？　おかね・まなび・ハッピーはいくつ？<br>"
          + "・進学した人、働いた人——<b>なぜ、その扉を選んだ？</b><br>"
          + "・開けたかったのに開けられなかった扉はあった？　何が足りなかった？<br>"
          + "・ほかの人の話を聞いて、「自分にはなかったな」と思ったものは？",
        en:"· How old are you, and what are you doing? How much money, learning, happiness?<br>"
          + "· Those who studied on, those who went to work — <b>why did you choose that door?</b><br>"
          + "· Was there a door you wanted but couldn't open? What was missing?<br>"
          + "· Listening to the others, what did you realise you never had?"},
  note:{ja:"<small>話し終わったら、止まった人がOKを押してください。<br>このマスに止まるのは、いちばんに着いた人だけ。ほかの人は通りすぎます。</small>",
        en:"<small>When you're done, whoever landed here presses OK.<br>Only the first to arrive stops here — everyone else walks past.</small>"},
};

const CH_SHORT = [
  {t:{ja:"子ども時代 ── 6〜16歳",en:"Childhood — age 6–16"}, note:{ja:"15歳までは1マスずつ。人生の土台の時間だ",en:"One square at a time until 15 — the years that build your base"}},
  {t:{ja:"10代後半 ── 道がわかれはじめる",en:"Late teens — paths start to split"}},
  {t:{ja:"20代前半 ── 道を選ぶ",en:"Early 20s — choosing a road"}},
  {t:{ja:"20代なかば ── 25歳のいまへ",en:"Mid 20s — toward the life you have at 25"}},
];

/* 盤面 24マス（ショート版）
   ★ トビラのマスはすべて stop:true。サイコロで飛びこされると出会うトビラが
     3〜6枚とぶれて、1人プレイのネタバラシが薄くなるため、全員が6枚全部と出会う。
     とくに大学（AAI）は、あしなが事業そのものを表すいちばん大事な一枚。 */
const SQ_SHORT = [
  {t:"start", name:{ja:"スタート",en:"Start"}, sub:{ja:"はじまり",en:"the beginning"}},
  {t:"income", name:{ja:"はじめてのお手伝い",en:"First chores"}, fixed:15, stop:true, sub:{ja:"はじめての、じぶんのかせぎ",en:"your first earnings"}},
  {t:"event", stop:true, sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"learn", stop:true, sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"choice", name:{ja:"進学",en:"School"}, key:"shinro", stop:true, sub:{ja:"学校を出たあと",en:"after school"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"event", sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"cost", name:{ja:"学用品・制服代",en:"School supplies & uniform"}, amt:20, sub:{ja:"いるものは、いる",en:"what you need, you need"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"choice", name:{ja:"くらし",en:"Home life"}, key:"kurashi", stop:true, sub:{ja:"暮らしを決める",en:"deciding how to live"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"choice", name:{ja:"大学",en:"University"}, key:"daigaku", stop:true, sub:{ja:"進む道を選ぶ",en:"choosing your road"}},
  {t:"cost", name:{ja:"急な病気の医療費",en:"Sudden medical bill"}, amt:30, sub:{ja:"病気は、えらべない",en:"illness doesn't choose"}},
  {t:"choice", name:{ja:"まち",en:"Town"}, key:"machi", stop:true, sub:{ja:"どこで生きる",en:"where to live"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"talk", name:{ja:"みんなで話す",en:"Talk together"}, stop:true, sub:{ja:"いちど顔を上げる",en:"look up from the board"}},
  {t:"choice", name:{ja:"技術",en:"Skills"}, key:"ginou", stop:true, sub:{ja:"手に職をつける",en:"learn a trade"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"cost", name:{ja:"家族のための出費",en:"Family expenses"}, amt:40, sub:{ja:"支えるほうにまわる",en:"now you do the supporting"}},
  {t:"choice", name:{ja:"しごと",en:"Career"}, key:"shigoto", stop:true, sub:{ja:"はたらき方を選ぶ",en:"how you want to work"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"goal", name:{ja:"ゴール",en:"Goal"}, sub:{ja:"いまのあなた",en:"you, right now"}},
];

/* ══ 本番（60分）版の盤面：36マス・6歳〜35歳 ══
   ショート版（24マス・25歳）とちがい、トビラのマスに stop:true は付けていない。
   ＝サイコロで飛びこされることがあり、出会うトビラの数は人によってちがう。
   これは 2026-09-04 以来の本番版の挙動をそのまま保っている。
   ⚠️ 留学（AAI）のトビラも飛びこされうるので、AAIに一度も出会わない人が出る。
      全員に出会わせたいなら stop:true を足すが、そのぶん手番が増えて60分に響く。 */
const AGES_FULL = [
  6,8,10,12,15,16,
  16,17,17,18,18,19,
  20,21,22,22,23,24,
  24,25,25,26,27,28,
  28,29,30,31,32,32,
  33,33,34,34,35,35,
];

/* 盤面の行＝人生の章（1章＝6マス。PC 6列×6行／スマホ 3列×12行） */
const CH_FULL = [
  {t:{ja:"子ども時代 ── 6〜16歳",en:"Childhood — age 6–16"}, note:{ja:"15歳までは1マスずつ。人生の土台の時間だ",en:"One square at a time until 15 — the years that build your base"}},
  {t:{ja:"10代後半 ── 道がわかれはじめる",en:"Late teens — paths start to split"}},
  {t:{ja:"20代前半 ── 道を選ぶ",en:"Early 20s — choosing a road"}},
  {t:{ja:"20代なかば ── 広がる世界",en:"Mid 20s — a wider world"}},
  {t:{ja:"30歳前後 ── 学びなおしと挑戦",en:"Around 30 — relearning & challenges"}},
  {t:{ja:"30代なかば ── 積み重ねの先に",en:"Mid 30s — where it all adds up"}},
];

const SQ_FULL = [
  {t:"start", name:{ja:"スタート",en:"Start"}, sub:{ja:"はじまり",en:"the beginning"}},
  {t:"income", name:{ja:"はじめてのお手伝い",en:"First chores"}, fixed:15, stop:true, sub:{ja:"はじめての、じぶんのかせぎ",en:"your first earnings"}},
  {t:"event", stop:true, sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"learn", stop:true, sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"choice", name:{ja:"進学",en:"School"}, key:"shinro", stop:true, sub:{ja:"学校を出たあと",en:"after school"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"event", sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"cost", name:{ja:"学用品・制服代",en:"School supplies & uniform"}, amt:20, sub:{ja:"いるものは、いる",en:"what you need, you need"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"choice", name:{ja:"くらし",en:"Home life"}, key:"kurashi", sub:{ja:"暮らしを決める",en:"deciding how to live"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"choice", name:{ja:"まち",en:"Town"}, key:"machi", sub:{ja:"どこで生きる",en:"where to live"}},
  {t:"cost", name:{ja:"急な病気の医療費",en:"Sudden medical bill"}, amt:30, sub:{ja:"病気は、えらべない",en:"illness doesn't choose"}},
  {t:"choice", name:{ja:"技術",en:"Skills"}, key:"ginou", sub:{ja:"手に職をつける",en:"learn a trade"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"event", sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"choice", name:{ja:"しごと",en:"Career"}, key:"shigoto", sub:{ja:"はたらき方を選ぶ",en:"how you want to work"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"cost", name:{ja:"家族のための出費",en:"Family expenses"}, amt:40, sub:{ja:"支えるほうにまわる",en:"now you do the supporting"}},
  {t:"event", sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"choice", name:{ja:"留学",en:"Abroad"}, key:"kaigai", sub:{ja:"海のむこうへ",en:"across the sea"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"choice", name:{ja:"学びなおし",en:"Relearn"}, key:"manabinaoshi", sub:{ja:"もう一度、学ぶ",en:"learning again"}},
  {t:"choice", name:{ja:"挑戦",en:"Challenge"}, key:"chousen", sub:{ja:"踏みだしてみる",en:"taking the leap"}},
  {t:"cost", name:{ja:"ライフイベント出費",en:"Life event costs"}, amt:50, sub:{ja:"人生には節目がある",en:"life has its milestones"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"event", sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"choice", name:{ja:"大きな夢",en:"Big dream"}, key:"yume", sub:{ja:"いちばん遠いトビラ",en:"the furthest door"}},
  {t:"learn", sub:{ja:"じぶんに投資する",en:"invest in yourself"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"event", sub:{ja:"なにが起きる…？",en:"what happens…?"}},
  {t:"cost", name:{ja:"まとまった出費",en:"Big expense"}, amt:60, sub:{ja:"まとまって出ていく",en:"a big one, all at once"}},
  {t:"income", name:{ja:"おしごと",en:"Work"}, sub:{ja:"はたらいて、かせぐ",en:"work and earn"}},
  {t:"goal", name:{ja:"ゴール",en:"Goal"}, sub:{ja:"いまのあなた",en:"you, right now"}},
];

/* トビラ定義 tag: shien/chiiki/career/global は家庭カードによって？？？になる */
/* 大学のトビラを通れた人にだけ、24歳でつづいている道。
   ？？？（見えない）ではなく🔒（カギ不足）で全員に見せるのは、
   「知らなかった」のではなく「19歳の選択が24歳の選択肢を決めていた」ことを見せるため。
   このカギだけは、24歳の時点ではもう取りに行けない。 */
const gradSchoolOpt =
  {t:{ja:"大学院に進んで、研究をつづける",en:"Go on to graduate school"},
   d:{ja:"学部で見つけた問いを、もっと深くへ。大学を出た人にだけ、この道はつづいている",
      en:"Take the question you found as an undergraduate deeper — a road that continues only for those who finished university"},
   cons:{ja:"でも、しばらくのあいだ収入は減る",en:"But your income drops for a while"},
   req:{univ:true, learn:6}, fx:{money:-50, learn:3, happy:3}};

/* m は盤面のモード。渡しわすれても落ちないよう、既定は「ぜんぶ」にしておく
   （StorybookやテストがcheiceDefを直接呼ぶことがある） */
function choiceDef(key, p, m = MODES.full){
  switch(key){
    case "shinro": return {
      title:{ja:"進学のトビラ",en:"The School Door"}, body:{ja:"学校を卒業。ここから先の道を選ぼう。",en:"You finished school. Choose your next path."},
      opts:[
        {t:{ja:"上の学校へ進学する（自費）",en:"Continue to higher education (self-funded)"}, d:{ja:"学費を家のお金で払ってまなぶ。世界がひろがる",en:"Your family pays the fees. The world opens up"}, cons:{ja:"でも、家のお金が一気に減る。その間かせぎはない",en:"But it drains the family's money, and you earn nothing meanwhile"}, req:{money:150}, fx:{money:-150, learn:3, happy:1}},
        {t:{ja:"奨学金・支援団体の力で進学する",en:"Continue with a scholarship / aid group"}, d:{ja:"はたらきはじめたら、すこしずつ返す。支援を知っていれば、返さなくていい奨学金に出会えることも",en:"You repay bit by bit once you work. If you know the right support, you may find a scholarship you never repay"}, cons:{ja:"でも、貸与型なら働きはじめてから何年も返しつづける",en:"But if it's a loan, you repay for years once you start working"}, tag:"shien", req:{maxMoney:150}, fx:{money:-30, learn:3, happy:1}, special:"shogakukin"},
        {t:{ja:"働いて家族を支える",en:"Work to support your family"}, d:{ja:"畑や店で働き、現場で経験を積む",en:"Field or shop — you learn on the job"}, cons:{ja:"でも、学ぶ時間はほとんど残らない。まなびは伸びにくい",en:"But almost no time is left to study — your learning barely grows"}, req:{}, fx:{money:80, learn:1}},
      ]};
    case "kurashi":
      if(p.fam.rural) return {
        title:{ja:"くらしのトビラ",en:"The Home Door"}, variant:{ja:"ウガンダ育ち",en:"raised in Uganda"}, body:{ja:"毎日の水くみと、暗くなったら終わる勉強。くらしを変える？",en:"Fetching water every day; studying ends at sunset. Change how you live?"},
        opts:[
          {t:{ja:"雨水タンクとソーラーランプを入れる",en:"Install a rain tank & solar lamp"}, d:{ja:"水くみの時間が、勉強の時間に変わる",en:"Water-fetching time becomes study time"}, cons:{ja:"でも、まとまったお金が一度に出ていく",en:"But it takes a large sum all at once"}, req:{money:50}, fx:{money:-50, learn:1, happy:2}},
          {t:{ja:"いままでどおりの暮らしを続ける",en:"Keep living as before"}, d:{ja:"お金はかからない。そのぶん時間はかかる",en:"Costs nothing — but takes time"}, cons:{ja:"でも、水くみと暗さに毎日時間をとられつづける",en:"But water-fetching and darkness keep eating your days"}, req:{}, fx:{money:20}},
        ]};
      return {
        title:{ja:"くらしのトビラ",en:"The Home Door"}, variant:{ja:"欧米・日本育ち",en:"raised in the West / Japan"}, body:{ja:"そろそろ自分の暮らしを考えたい。",en:"Time to think about a place of your own."},
        opts:[
          {t:{ja:"ひとり暮らしを始める",en:"Start living on your own"}, d:{ja:"自由と責任。自分の生活をつくる",en:"Freedom and responsibility — a life you build"}, cons:{ja:"でも、家賃も光熱費も、これから全部自分もち",en:"But rent and bills are all yours from now on"}, req:{money:100}, fx:{money:-100, learn:1, happy:2}},
          {t:{ja:"実家でしっかり貯金",en:"Stay home and save"}, d:{ja:"堅実もりっぱな選択",en:"Playing it steady is a fine choice"}, cons:{ja:"でも、自分で決めて暮らす経験は、先のばしになる",en:"But learning to run your own life gets postponed"}, req:{}, fx:{money:50}},
        ]};
    case "machi":
      if(p.fam.rural) return {
        title:{ja:"まちのトビラ",en:"The Town Door"}, variant:{ja:"ウガンダ育ち",en:"raised in Uganda"}, body:{ja:"村を出るか、残るか。人生の分かれ道。",en:"Leave the village, or stay? A fork in life."},
        opts:[
          {t:{ja:"首都カンパラに出る",en:"Move to Kampala, the capital"}, d:{ja:"生活費は上がる。でも、見える世界と、はたらける場が変わる",en:"Living costs rise — but what you can see, and where you can work, change"}, cons:{ja:"でも、知り合いのいない場所。生活費も上がる",en:"But nobody knows you there, and living costs more"}, req:{money:60}, fx:{money:-60, learn:1, happy:1}, special:"revealAll", unlock:true},
          {t:{ja:"村で暮らしつづける",en:"Stay in the village"}, d:{ja:"顔見知りと、慣れた畑。生活費は安い",en:"Familiar faces, familiar fields. Cheap to live"}, cons:{ja:"でも、出会えるしごとと人は、村にあるぶんだけ",en:"But the work and the people you meet are only what the village holds"}, req:{}, fx:{money:20, happy:1}},
          /* 「支え合い」の選択肢。chiiki タグを持つ選択肢が盤面にひとつも無いと、
             めぐまれた家庭（chiiki を隠している w1/w2/w4）が「？？？」に一度も出会わず、
             ふりかえりの「支え合いのトビラは、めぐまれた家庭からこそ見えなかったはず」が
             必ず外れてしまう。
             本番版（36マス）は 挑戦・大きな夢のトビラが chiiki を受けもっているので出さない。
             ショート版（24マス）はそのトビラが盤面に無いので、ここで受ける。 */
          ...(m.chiikiExtra ? [{t:{ja:"村の助け合いの輪に入る",en:"Join the village's circle of mutual help"}, d:{ja:"毎月すこしずつ出しあって、困った人を順番に助ける",en:"Everyone puts in a little each month, and helps whoever needs it next"}, cons:{ja:"でも、自分が困っていない月も出しつづける",en:"But you keep paying in even in months you don't need help"}, tag:"chiiki", req:{money:20}, fx:{money:-20, learn:1, happy:2}}] : []),
        ]};
      return {
        title:{ja:"まちのトビラ",en:"The Town Door"}, variant:{ja:"欧米・日本育ち",en:"raised in the West / Japan"}, body:{ja:"進学・しごと・暮らし。どこで生きていく？",en:"Study, work, life — where will you live?"},
        opts:[
          {t:{ja:"大都市に住みつづける",en:"Stay in the big city"}, d:{ja:"情報も出会いも多い。そのぶん生活費が高い",en:"Full of information and encounters — and high costs"}, cons:{ja:"でも、家賃と生活費で、手元には残りにくい",en:"But rent and costs leave little in your hand"}, req:{}, fx:{money:-30, happy:1}},
          {t:{ja:"家賃の安い郊外へ",en:"Move somewhere cheaper"}, d:{ja:"浮いたお金は貯金にまわす",en:"Save the difference"}, cons:{ja:"でも、しごとも情報も、街の中心から遠くなる",en:"But work and information move further away"}, req:{}, fx:{money:30}},
          /* めぐまれた家庭は chiiki を隠しているので、ここが「？？？」になる。
             お金では買えないものが見えていない——というのがこの一枚の役目（ショート版だけ） */
          ...(m.chiikiExtra ? [{t:{ja:"ご近所の助け合いの輪に入る",en:"Join the neighbourhood's circle of mutual help"}, d:{ja:"すこしずつ出しあう当番制。となりに住む人の名前を、はじめて知った",en:"A rota everyone chips into. For the first time, you learn your neighbour's name"}, cons:{ja:"でも、当番も集まりも、時間をとられる",en:"But the rota and the meetings take your time"}, tag:"chiiki", req:{money:20}, fx:{money:-20, learn:1, happy:2}}] : []),
        ]};
    case "ginou": return {
      title:{ja:"技術のトビラ",en:"The Skills Door"}, body:{ja:"手に職があれば、しごとの幅がぐんと広がる。",en:"A trade widens the work you can do."},
      opts:[
        {t:{ja:"職業訓練校で技術を学ぶ",en:"Train at a vocational school"}, d:{ja:"縫製・機械・IT。お金と時間を集中投資",en:"Sewing, machines, IT — invest money and time"}, cons:{ja:"でも、お金と時間をまとめて使いきる",en:"But it uses up both money and time at once"}, tag:"career", req:{money:50, learn:3}, fx:{money:-50, learn:2, happy:1}, unlock:true},
        {t:{ja:"見習いとして働きながら覚える",en:"Learn as an apprentice"}, d:{ja:"先輩の手もとが教科書",en:"Your seniors' hands are the textbook"}, cons:{ja:"でも、覚えるのに何年もかかる",en:"But it takes years to learn this way"}, req:{}, fx:{money:10, learn:1}},
        {t:{ja:"今はやめておく",en:"Not this time"}, d:{ja:"タイミングも大事",en:"Timing matters too"}, cons:{ja:"でも、手に職はつかないまま次のマスへ",en:"But you move on without a trade in your hands"}, req:{}, fx:{}},
      ]};
    case "shigoto": return {
      title:{ja:"しごとのトビラ",en:"The Career Door"}, body:{ja:"新しいしごとの募集を見つけた！",en:"You found a new job opening!"},
      opts:[
        /* 大学院は、盤面に「大学のトビラ」があるモードだけ。
           本番版（36マス）には大学のトビラがなく univ が立たないので、出すと
           だれも開けられない🔒がひとつ並ぶだけになる */
        ...(m.gradSchool ? [gradSchoolOpt] : []),
        {t:{ja:"国際機関・NGOで働く",en:"Work for an international org / NGO"}, d:{ja:"まなびの蓄積が採用の決め手に",en:"Your learning is what gets you hired"}, cons:{ja:"でも、給料は高くない",en:"But the pay is not high"}, tag:"career", req:{learn:5}, fx:{learn:1, happy:2}, unlock:true},
        {t:{ja:"給料の高いしごとに移る",en:"Move to a better-paid job"}, d:{ja:"スキルを高く買ってもらう",en:"Sell your skills higher"}, cons:{ja:"でも、いままでの人間関係は一度リセットになる",en:"But you start over with the people around you"}, req:{learn:4}, fx:{money:100}},
        {t:{ja:"いまのしごとを続ける",en:"Keep your current job"}, d:{ja:"安定して働き、少し昇給した",en:"Steady work, a small raise"}, cons:{ja:"でも、はたらき方も、見える景色も変わらない",en:"But neither your work nor your view of the world changes"}, req:{}, fx:{money:30}},
      ]};
    /* ショート版（24マス）の19歳のトビラ。本番版の26歳「留学」とは別の扉なので、
       キーを分けて両方を持っている。盤面データのどちらを使うかで自動的に決まる */
    case "daigaku": {
      const base = [
        /* univ:true = この選択で「大学に行けた」ことになる。24歳の大学院のカギになる */
        {t:{ja:"海外の大学に留学する",en:"Study at a university abroad"}, d:{ja:"言葉の壁をこえた先に、新しい世界",en:"Beyond the language barrier, a new world"}, cons:{ja:"でも、家族とは遠くはなれる。言葉も一からやり直し",en:"But you live far from your family, and start over in another language"}, tag:"global", req:{money:150, learn:4}, fx:{money:-150, learn:2, happy:3}, unlock:true, univ:true},
        /* ウガンダにも大学はある（マケレレなど）。壁は「知らないこと」ではなく学費なので、
           tag は付けず全員に見せ、おかねのカギだけで差がつくようにする。
           unlock:true = 国内の大学でも、まなびがかせぎになる場につながる。
           カギ150万は現実の進学率に寄せた数字。通しプレイ360人ぶんの実測で、19歳時点で
           これに手が届くのは ウガンダ両親あり21%・遺児(支援あり)3%・遺児(支援なし)10%
           ＝ウガンダ3家庭で11%、欧米49%・日本53%・駐在44%。
           120万だとウガンダ28%で高すぎた（現実のウガンダの高等教育進学率は4〜5%）。
           ★3は「海外の大学」(★4)より必ず軽くしておくこと。軽くないとこの選択肢は
           海外に完全に見劣りして存在意義がなくなる。それ以上ウガンダ側を下げたいなら、
           国内を180万にしたうえで海外も上げる（＝扉ごと作りなおす）必要がある。 */
        {t:{ja:"自分の国の大学に進む",en:"Go to a university in your own country"}, d:{ja:"国を出なくても、大学はある。壁になるのは学費のほう",en:"There are universities at home too. What stands in the way is the fees"}, cons:{ja:"でも、学費は海外とおなじだけかかる",en:"But the fees cost as much as going abroad"}, req:{money:150, learn:3}, fx:{money:-150, learn:2, happy:2}, unlock:true, univ:true},
        {t:{ja:"外国で働いてみる",en:"Work in another country"}, d:{ja:"仕送りで、遠くの家族も支えられる",en:"Send money home to your family"}, cons:{ja:"でも、学びなおす時間はとりにくい。大学の道はここで閉じる",en:"But there's little time to study again — the university road closes here"}, req:{learn:3}, fx:{money:80, happy:1}, unlock:true},
        {t:{ja:"自分の国で暮らしつづける",en:"Stay in your own country"}, d:{ja:"ここにも、いい暮らしはある",en:"There is a good life here too"}, cons:{ja:"でも、大学の道はここで閉じる。24歳の選択肢がひとつ減る",en:"But the university road closes here — one option fewer at 24"}, req:{}, fx:{happy:1}},
      ];
      /* 遺児家庭だけに、あしながAAI（お金のカギがない大学奨学金）の扉が存在する。
         ショート版では19歳（中等教育を終えた直後＝実際のAAIの典型的な応募時期）に置いたので、
         カギは本番版の ★5 から ★3 に下げてある。19歳時点で★5はほぼ届かず、
         常に🔒の扉になってしまうため。 */
      if(p.perk === "shienPro" || p.perk === "deai") return {
        title:{ja:"大学のトビラ",en:"The University Door"}, variant:{ja:"遺児家庭",en:"orphan families"},
        body:{ja:"中等教育を終えた19歳。大学へ進む道がある——国の中にも、海の向こうにも。",en:"You're 19, just out of secondary school. Roads lead on to university — at home, and across the sea."},
        opts:[
          {t:{ja:"AAI——遺児のための留学奨学金に挑戦する",en:"AAI — try for the orphans' study-abroad scholarship"},
           d:{ja:"学費も渡航費も支援。カギはお金ではなく、まなびと『志』",en:"Fees and travel covered. The keys are learning and a mission — not money"}, cons:{ja:"でも、選ばれるとはかぎらない。卒業したら祖国のために働く約束がついてくる",en:"But you may not be chosen — and it comes with a promise to work for your home country"},
           tag:"shien", req:{learn:3}, fx:{learn:2, happy:3}, special:"aai", unlock:true, univ:true},
          ...base,
        ]};
      return {
        /* variant を付けておかないと、トビラ一覧で遺児家庭版と同じ名前が2つ並び、
           片方に「🚶 だれも通らなかった」と出て混乱する（1人プレイでは必ず起きる） */
        title:{ja:"大学のトビラ",en:"The University Door"}, variant:{ja:"遺児家庭いがい",en:"other families"},
        body:{ja:"中等教育を終えた19歳。大学へ進む道がある——国の中にも、海の向こうにも。",en:"You're 19, just out of secondary school. Roads lead on to university — at home, and across the sea."},
        opts:base};
    }
    /* 本番版（36マス）の26歳のトビラ。AAIのカギは★5。
       26歳までに★を積めているかが問われる位置にある */
    case "kaigai": {
      const base = [
        {t:{ja:"海外の大学に留学する",en:"Study at a university abroad"}, d:{ja:"言葉の壁をこえた先に、新しい世界",en:"Beyond the language barrier, a new world"}, cons:{ja:"でも、家族とは遠くはなれる。言葉も一からやり直し",en:"But you live far from your family, and start over in another language"}, tag:"global", req:{money:150, learn:4}, fx:{money:-150, learn:2, happy:3}, unlock:true},
        {t:{ja:"外国で働いてみる",en:"Work in another country"}, d:{ja:"仕送りで、遠くの家族も支えられる",en:"Send money home to your family"}, cons:{ja:"でも、学びなおす時間はとりにくい",en:"But there's little time to study again"}, req:{learn:3}, fx:{money:80, happy:1}, unlock:true},
        {t:{ja:"自分の国で暮らしつづける",en:"Stay in your own country"}, d:{ja:"ここにも、いい暮らしはある",en:"There is a good life here too"}, cons:{ja:"でも、海のむこうで学ぶ機会は、ここで見送ることになる",en:"But the chance to learn across the sea passes you by"}, req:{}, fx:{happy:1}},
      ];
      /* 遺児家庭だけに、あしながAAI（お金のカギがない留学奨学金）の扉が存在する */
      if(p.perk === "shienPro" || p.perk === "deai") return {
        title:{ja:"留学のトビラ",en:"The Study-Abroad Door"}, variant:{ja:"遺児家庭",en:"orphan families"},
        body:{ja:"海の向こうで学んでみたい気持ちがふくらむ。",en:"You want to learn across the sea."},
        opts:[
          {t:{ja:"AAI——遺児のための留学奨学金に挑戦する",en:"AAI — try for the orphans' study-abroad scholarship"},
           d:{ja:"学費も渡航費も支援。カギはお金ではなく、まなびと『志』",en:"Fees and travel covered. The keys are learning and a mission — not money"}, cons:{ja:"でも、選ばれるとはかぎらない。卒業したら祖国のために働く約束がついてくる",en:"But you may not be chosen — and it comes with a promise to work for your home country"},
           tag:"shien", req:{learn:5}, fx:{learn:2, happy:3}, special:"aai", unlock:true},
          ...base,
        ]};
      return {
        /* variant を付けておかないと、トビラ一覧で遺児家庭版と同じ名前が2つ並び、
           片方に「🚶 だれも通らなかった」と出て混乱する */
        title:{ja:"留学のトビラ",en:"The Study-Abroad Door"}, variant:{ja:"遺児家庭いがい",en:"other families"},
        body:{ja:"海の向こうで学んでみたい気持ちがふくらむ。",en:"You want to learn across the sea."},
        opts:base};
    }
    case "manabinaoshi": return {
      title:{ja:"学びなおしのトビラ",en:"The Relearning Door"}, body:{ja:"大人になってからでも、学びの扉は開けなおせる。",en:"Even as an adult, the door to learning can reopen."},
      opts:[
        {t:{ja:"夜間学校・オンライン講座で学びなおす",en:"Night school / online courses"}, d:{ja:"一度閉じた扉も、もう一度開けられる",en:"A door that closed once can open again"}, tag:"shien", req:{money:80, learn:2}, fx:{money:-80, learn:3, happy:1}},
        {t:{ja:"今の道をきわめる",en:"Master your current path"}, d:{ja:"続ける力も立派なキャリア",en:"Persistence is a career too"}, req:{}, fx:{money:20}},
      ]};
    case "chousen": return {
      title:{ja:"挑戦のトビラ",en:"The Challenge Door"}, body:{ja:"やってみたいことがある。動くなら今かも。",en:"There's something you want to try. Now may be the time."},
      opts:[
        {t:{ja:"起業する",en:"Start a business"}, d:{ja:"たくわえとまなびを全部つぎこんで勝負",en:"Bet your savings and your learning"}, req:{money:250, learn:6}, fx:{money:-250, learn:2, happy:3}},
        {t:{ja:"地域の子どもたちに勉強を教える",en:"Teach local kids"}, d:{ja:"もらった支えを、次の世代へ手わたす",en:"Pass the support you received to the next generation"}, tag:"chiiki", req:{learn:3}, fx:{learn:1, happy:2}},
        {t:{ja:"今の道をきわめる",en:"Master your current path"}, d:{ja:"続けることも立派な挑戦",en:"Continuing is a challenge too"}, req:{}, fx:{money:20}},
      ]};
    case "yume":
      /* AAIを選んだ人は「志」の約束つき——夢は祖国への貢献に絞られる */
      if(p.aai) return {
        title:{ja:"大きな夢のトビラ",en:"The Big Dream Door"}, variant:{ja:"AAIの約束",en:"the AAI promise"},
        body:{ja:"人生でいちばんやりたかったこと——でも、あなたには果たすべき約束がある。志を、祖国へ。",
              en:"The thing you most wanted to do — but you carry a promise. Your mission belongs to your homeland."},
        opts:[
          {t:{ja:"こんどは、じぶんがふるさとの子の学費を支える",en:"Now it's your turn to pay a child's school fees"}, d:{ja:"もらった支えを、次の子へ——恩返しという夢",en:"Passing the support you received to the next child — a dream called giving back"}, req:{money:50, learn:4}, fx:{money:-50, happy:4}},
          {t:{ja:"祖国に会社をおこし、しごとをつくる",en:"Start a company back home and create jobs"}, d:{ja:"ひとつの雇用が、いくつもの家庭のカギになる",en:"Every job you create is a key for another family"}, req:{money:150, learn:6}, fx:{money:-150, learn:1, happy:4}},
          {t:{ja:"村々をまわって、じぶんの物語を語る",en:"Travel the villages, telling your story"}, d:{ja:"あなたの生き方そのものが、次の子のトビラになる",en:"Your life itself becomes a door for the next child"}, req:{}, fx:{happy:2}},
        ]};
      return {
      title:{ja:"大きな夢のトビラ",en:"The Big Dream Door"}, body:{ja:"人生でいちばんやりたかったこと、覚えてる？",en:"Remember the thing you most wanted to do?"},
      opts:[
        {t:{ja:"世界一周の旅に出る",en:"Travel around the world"}, d:{ja:"ずっと夢だったあの計画を実行",en:"The plan you always dreamed of"}, req:{money:200}, fx:{money:-200, happy:4}},
        {t:{ja:"こんどは、じぶんがふるさとの子の学費を支える",en:"Now it's your turn to pay a child's school fees"}, d:{ja:"もらった支えを、次の子へ——恩返しという夢",en:"Passing the support you received to the next child — a dream called giving back"}, tag:"chiiki", req:{money:50, learn:4}, fx:{money:-50, happy:4}},
        {t:{ja:"大切な人との時間に投資",en:"Invest in time with loved ones"}, d:{ja:"いちばん近くにある、しあわせ",en:"The happiness closest to you"}, req:{money:100}, fx:{money:-100, happy:3}},
        {t:{ja:"星空の下で、家族と夢を語り合う",en:"Talk about dreams under the stars"}, d:{ja:"お金はなくても、夢は語れる",en:"Dreams cost nothing to share"}, req:{}, fx:{happy:1}},
      ]};
    case "learnSq": return {
      title:{ja:"まなびのトビラ",en:"The Learning Door"}, body:{ja:"自分に投資するチャンス。どうする？",en:"A chance to invest in yourself."},
      opts:[
        {t:{ja:"学校や講座にお金を払って学ぶ",en:"Pay for school or a course"}, d:{ja:"お金をかけたぶん、ぐんと伸びる",en:"Money in, big growth out"}, cons:{ja:"でも、いま手元にあるお金は確実に減る",en:"But the money in your hand is gone for sure"}, tag:"manabi", req:{money:30}, fx:{money:-30, learn:2}},
        {t:{ja:"ラジオ・本・友だちから学ぶ",en:"Learn from radio, books, friends"}, d:{ja:"ゼロ円でもちゃんと前に進める",en:"Zero yen still moves you forward"}, cons:{ja:"でも、伸び方はゆっくり。教えてくれる人は選べない",en:"But growth is slow, and you can't choose who teaches you"}, req:{}, fx:{learn: p.perk==="kinben" ? 2 : 1}},
      ]};
  }
}

/* できごとカード only: rural=ウガンダの村ぐらし / rich=先進国・駐在ぐらし */
const EVENTS = [
  {t:{ja:"手伝いが評価されて臨時収入",en:"Extra pay for good work"}, d:{ja:"はたらく力は、どこの国でも役に立つ",en:"Hard work pays off in any country"}, fx:{money:30}},
  {t:{ja:"中古のスマホを手に入れた",en:"You got a second-hand smartphone"}, d:{ja:"世界とつながる小さな窓ができた",en:"A little window to the world"}, fx:{learn:1, happy:1}},
  {t:{ja:"遠くの親戚が送金してくれた",en:"A distant relative sent money"}, d:{ja:"家族の助け合いは、国境をこえる",en:"Family help crosses borders"}, fx:{money:30}},
  {t:{ja:"「外国でかんたんに稼げる」という話を断った",en:"You turned down an \"easy money abroad\" offer"}, d:{ja:"うますぎる話にはウラがある。えらい！",en:"Deals too good to be true always are. Well done!"}, fx:{learn:1}},
  {t:{ja:"熱を出して寝こんだ",en:"You caught a fever"}, d:{ja:"薬代と、休んだぶんの出費",en:"Medicine, plus the days you missed"}, fx:{money:-10}},
  {only:"rural", t:{ja:"市場の手伝いで小づかいをかせいだ",en:"Earned pocket money at the market"}, d:{ja:"商売のコツが、少し身についた",en:"You picked up a knack for trade"}, fx:{money:20}},
  {only:"rural", t:{ja:"雨季の大雨で、通学路が川になった",en:"Heavy rains turned the road into a river"}, d:{ja:"学校まで歩けない日もある",en:"Some days you just can't reach school"}, fx:{money:-10}},
  {only:"rural", t:{ja:"ラジオの教育番組に夢中になった",en:"Hooked on a radio study program"}, d:{ja:"電気が少なくても、学びは届く",en:"Learning arrives even with little electricity"}, fx:{learn:1}},
  {only:"rural", t:{ja:"マラリアにかかってしまった",en:"You caught malaria"}, d:{ja:"薬代と、休んだあいだの出費",en:"Medicine, plus the days you missed"}, fx:{money:-20}},
  {only:"rural", t:{ja:"村の収穫祭でごちそうを囲んだ",en:"Harvest festival feast in the village"}, d:{ja:"分け合うと、しあわせはふえる",en:"Sharing multiplies happiness"}, fx:{money:-10, happy:2}},
  {only:"rural", t:{ja:"作物が高く売れた",en:"Your crops sold high"}, d:{ja:"がんばった畑が実を結んだ",en:"The field rewarded your work"}, fx:{money:30}},
  {only:"rural", t:{ja:"毎日歩く通学路で、靴がこわれた",en:"Your shoes wore out on the long walk"}, d:{ja:"長い道のりは、モノも消耗させる",en:"A long road wears things down"}, fx:{money:-10}},
  {only:"rural", t:{ja:"教科書を友だちと貸し借りした",en:"Shared textbooks with a friend"}, d:{ja:"1冊の本も、分ければ2人分",en:"One book, split two ways"}, fx:{learn:1, happy:1}},
  {only:"rich", t:{ja:"習いごとの発表会があった",en:"Recital day for your lessons"}, d:{ja:"月謝は高いけど、いい経験になった",en:"Pricey lessons, good experience"}, fx:{money:-15, happy:2}},
  {only:"rich", t:{ja:"家族で旅行に出かけた",en:"A family trip"}, d:{ja:"楽しかったけど、けっこうな出費",en:"Fun — and expensive"}, fx:{money:-25, happy:2}},
  {only:"rich", t:{ja:"サブスク、入りすぎでは？",en:"Too many subscriptions?"}, d:{ja:"固定費の見直しは節約の第一歩",en:"Reviewing fixed costs is step one of saving"}, fx:{money:-15}},
  {kind:"info", reveal:"any", t:{ja:"外国から来た人と、じっくり話しこんだ",en:"A long talk with a visitor from abroad"}, d:{ja:"知らなかった世界の入口が、少し見えた",en:"A door to a world you didn't know cracked open"}},
  {kind:"info", reveal:"shien", t:{ja:"「返さなくていい奨学金で大学に行けた」という話を聞いた",en:"You heard of a scholarship you never repay"}, d:{ja:"世界には、そういう仕組みをつくっている人たちがいる",en:"Somewhere, people are building systems like that"}},
  {kind:"info", reveal:"chiiki", t:{ja:"近所の家の夕食に招かれた",en:"Invited to dinner next door"}, d:{ja:"「困ったときはお互いさま」。そういう世界が、すぐそばにあった",en:"\"We help each other here.\" That world was right beside you"}},
  /* AAIの選択肢のタグは shien。ここを global にしていると「AAIがあると聞いた」のに
     AAIは？？？のまま、という食いちがいが起きる（本番版から引き継いだ取りちがえ） */
  {only:"rural", kind:"info", reveal:"shien", t:{ja:"遺児のための留学奨学金『AAI』があると聞いた",en:"You heard about \"AAI\", a study-abroad scholarship for orphans"}, d:{ja:"学費も渡航費も出るらしい。ただし問われるのは、お金ではなく『志』だという",en:"It covers fees and travel — but what it asks for, they say, is not money. It's a sense of mission"}},
  {kind:"fair", t:{ja:"NGOの進学説明会が、となりの町まで来た",en:"An NGO study fair came to the next town"}, d:{ja:"バス代はかかるけど、行けば情報が手に入る",en:"Bus fare costs — but information awaits"}},
];


function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}


function jobTitle(p){
  const n = p.learn;
  if(n <= 1) return {ic:"🌾", t:{ja:"畑・市場の手伝い",en:"Field & market helper"}};
  if(n <= 2) return {ic:"🔧", t:{ja:"見習い・日雇いのしごと",en:"Apprentice & day labor"}};
  if(n <= 3) return {ic:"🧵", t:{ja:"縫製・工房のスタッフ",en:"Sewing & workshop staff"}};
  if(n <= 4) return {ic:"🏪", t:{ja:"お店のリーダー",en:"Shop team leader"}};
  if(n <= 5) return {ic:"💻", t:{ja:"専門職・エンジニア",en:"Specialist & engineer"}};
  if(n <= 6) return {ic:"🏢", t:{ja:"国際企業のスタッフ",en:"Global company staff"}};
  return {ic:"👑", t:{ja:"マネージャー・専門家",en:"Manager & expert"}};
}

/* 「まだ見えていない選択肢」の数。p.hidden はタグの配列なので、その長さを数えると
   実際に？？？になる選択肢の数とズレる（例：遺児・支援なしはタグ3個だが選択肢は5個）。
   盤面に残っているトビラを実際に開いて、これから出会う？？？を数える。
   fromPos を渡すと、そのマスより先のトビラだけを数える（もう通りすぎた扉は数えない）。 */
function hiddenOptionCount(p, fromPos, m = MODES.full){
  let n = 0;
  m.SQUARES.forEach((sq, i) => {
    if(sq.t !== "choice" || i <= (fromPos || 0)) return;
    const def = choiceDef(sq.key, p, m);
    n += def.opts.filter(o => o.tag && p.hidden.includes(o.tag)).length;
  });
  return n;
}

function revealTags(p, target, n){
  const order = ["shien","chiiki","career","global"];
  let count = 0;
  if(target !== "any" && p.hidden.includes(target)){ unhideTag(p, target); count++; n--; }
  for(const t of order){
    if(n <= 0) break;
    if(p.hidden.includes(t)){ unhideTag(p, t); count++; n--; }
  }
  return count;
}
/* 「まだ支援と出会えていない遺児」：支援がはじめて見えた瞬間に発動 */
function checkDeai(p){
  if(p.perk === "deai" && !p.deaiUsed && !p.hidden.includes("shien")){
    p.deaiUsed = true;
    p.shienDiscount = true;
    p.learn += 1;
    return {ja:"🎗 はじめて「支援」の存在を知った——出会いがチカラになる！ まなび+1、これから支援・まなび系のトビラのカギが <b>−50万</b> になる。",
            en:"🎗 You just learned that support exists — the meeting becomes power! Learn +1, and aid/learning door keys now cost <b>−¥500k</b>."};
  }
  return null;
}

function applyFx(p, fx){
  p.money += fx.money||0;
  p.learn += fx.learn||0;
  p.happy += fx.happy||0;
}
function effectiveMoneyReq(p, o){
  let m = o.req.money || 0;
  if(p.shienDiscount && (o.tag === "shien" || o.tag === "manabi")) m = Math.max(0, m - 50);
  if(p.perk === "kokusai" && o.tag === "global") m = Math.max(0, m - 50);
  return m;
}
/* 🎗支援サポート・🌏国際感覚は、カギ（必要額）だけでなく、はらうお金も軽くする */
function effectiveMoneyFx(p, o){
  const m = o.fx.money || 0;
  if(m >= 0) return m;
  let cut = 0;
  if(p.shienDiscount && (o.tag === "shien" || o.tag === "manabi")) cut += 50;
  if(p.perk === "kokusai" && o.tag === "global") cut += 50;
  return cut ? Math.min(0, m + cut) : m;
}
function effectiveLearnReq(p, o){
  let l = o.req.learn || 0;
  if(p.perk === "eigo" && o.tag === "global") l = Math.max(0, l - 2);
  return l;
}
function meetsReq(p, o){
  if(o.req.univ && !p.univ) return false;   /* 大学を出ていること。24歳ではもう取り返せないカギ */
  const em = effectiveMoneyReq(p, o);
  if(em > 0 && em > p.money) return false;  /* カギなし(0円)の選択肢は借金中でも選べる */
  if(effectiveLearnReq(p, o) > p.learn) return false;
  if(o.req.maxMoney != null && p.money >= o.req.maxMoney) return false;  /* 所得制限 */
  return true;
}

/* 25歳のエンディング（ショート版）
   ★ここはゲームの読後感そのもの。あしなが側の監修を受けてから本番投入すること。
     本番版（35歳）とちがい、人生はまだ途中——「ここで終わりではない」ことを残す。 */
const ENDINGS_SHORT = {
  village:[  /* ウガンダ育ち・★が実る場に出会えないまま */
    {ja:"一日は、いまも水くみから始まる。子どものころと同じ道を、同じ時間に歩いている。選べた記憶より、選べなかった記憶のほうが多い。——でも、それはあなたのせいだったのだろうか？",
     en:"Your day still begins by fetching water. The same road, at the same hour, as when you were a child. You remember far more moments you couldn't choose than ones you could. — But was that really your fault?"},
    {ja:"畑としごとを行き来する毎日。楽ではないけれど、困ったときに頼れる顔がいくつも浮かぶ。ときどき、開けられなかった扉のことを思い出す。——まだ25歳。人生は、半分も来ていない。",
     en:"Your days move between the field and work. It isn't easy, but when trouble comes, many faces come to mind. Now and then you think of the doors that wouldn't open. — You're twenty-five. Life is not even half over."},
    {ja:"畑を継ぎ、市場に自分の場所をもった。夕方になると、近所の子が宿題をかかえて集まってくる。大きな扉ではなかったけれど、開けてきた一枚一枚が、いまの毎日をつくっている。",
     en:"You've taken over the field and hold your own spot at the market. In the evening, the neighbors' kids turn up with their homework. None of the doors you opened were grand — but every one of them built the days you have."},
  ],
  city:[  /* ウガンダ育ち・大学や都市など「まなびが実る場」につながった */
    {ja:"たしかに、まなびがかせぎになる場所にはたどりついた。それでも、開けたかった扉に手が届いたかというと——その場所は、カギの値段も高かった。",
     en:"You did reach a place where learning turns into pay. But did the doors you longed for come within reach? — In that place, the keys cost more too."},
    {ja:"しごとに慣れ、暮らし向きは村にいたころと別ものになった。ただ、にぎやかな通りでふと、村の夕方の音を思い出すことがある。ここからどこへ行くのかは、まだ決めていない。",
     en:"You've settled into the work, and life looks nothing like the village years. Yet on a busy street, you sometimes hear the evening sounds of home. Where you go from here, you haven't decided yet."},
    {ja:"カンパラのアパートには電気も水道もある。村を出た日に息をのんだ景色が、いまは日常だ。月末には仕送りをして、長い休みには土の道を歩いて帰る。次に開ける扉のことを、もう考えている。",
     en:"Your Kampala apartment has electricity and running water. The view that took your breath away the day you left the village is everyday life now. You send money home at month's end and walk the dirt road back for the holidays. Already, you're thinking about the next door."},
  ],
  aai:[  /* AAI——志の約束とともに。25歳は「留学から帰ってきたばかり」の年ごろ */
    {ja:"約束を胸に、祖国へもどってきたところだ。思うように進まない日々に、志が重く感じられることもある。——それでも、あなたが開けた扉は、まだ閉じていない。",
     en:"You've just come home, carrying the promise. Some days it feels heavy, when nothing moves the way you hoped. — And yet, the door you opened has not closed."},
    {ja:"大学を出て祖国へもどり、はたらきはじめた。理想と現実のあいだで足踏みする日も多い。それでも、あなたの姿を見て進路を決めた後輩が、もう何人かいる。",
     en:"Out of university and home again, you've started to work. Many days you stall between ideals and reality. Even so, a few younger students have already chosen their path after watching yours."},
    {ja:"祖国にもどり、しごとと支援の輪をつくりはじめた。村の学校では「あの人みたいになりたい」という子が育っている。約束は、これから暮らしになっていく。",
     en:"Home again, you've begun to build work and circles of support. In the village school, children are growing up saying they want to be like you. The promise is becoming a life."},
  ],
  west:[  /* 欧米・日本育ち */
    {ja:"扉はいつも目の前にあった。カギも、たぶん足りていた。それでも開けなかったのは、なぜだろう。",
     en:"The doors were always right in front of you. You probably even had the keys. Why didn't you open them?"},
    {ja:"そこそこ安定したしごとと、それなりの毎日。ふとSNSを眺めながら、選ばなかった道のことを考える夜がある。",
     en:"A reasonably steady job and a reasonable life. Some nights, scrolling your phone, you think about the roads you didn't take."},
    {ja:"好きなしごとと、気の合う仲間と、ときどき旅行。選べる道が、まだいくつも残っている——それを「当たり前」だと思ってきたかもしれない。",
     en:"Work you love, friends you click with, a trip now and then. Many roads are still open to you — and you may have thought that was just \"normal\"."},
  ],
};

/* ══ 本番（60分）版のエンディング：35歳のいま ══ */
const ENDINGS_FULL = {
  village:[  /* ウガンダ育ち・★が実る場に出会えないまま */
    {ja:"日が昇る前から働き、日が沈むと眠る。選べた記憶より、選べなかった記憶のほうが多い。——でも、それはあなたのせいだったのだろうか？",
     en:"You work before sunrise and sleep at sundown. You remember far more moments you couldn't choose than ones you could. — But was that really your fault?"},
    {ja:"畑としごとを行き来する毎日。楽ではないけれど、困ったとき頼れる顔がいくつも浮かぶ。開けられなかった扉のことは、ときどき思い出す。",
     en:"Days move between the field and work. It isn't easy, but when trouble comes, many faces come to mind. Now and then, you think of the doors you couldn't open."},
    {ja:"村はずれの小さな家。夕方には教え子や近所の子が集まってくる。畑とラジオと、にぎやかな食卓——あなたが開けてきた扉のむこうに、この暮らしがある。",
     en:"A small house at the edge of the village. In the evening, your students and the neighbors' kids crowd in. The field, the radio, a lively table — beyond the doors you opened, this life was waiting."},
  ],
  city:[  /* ウガンダ育ち・カンパラや海外など「スキルが活きる場」に出た */
    {ja:"たしかに都市に出た。稼ぎも増えた。それでも、開けたかった扉に手が届いたかというと——都会は、カギの値段も高かった。",
     en:"You did make it to the city, and you earn more now. But did the doors you longed for come within reach? — In the city, even keys have city prices."},
    {ja:"都市のしごとに慣れ、暮らし向きは村にいたころと別ものになった。ただ、にぎやかな通りでふと、村の夕方の音を思い出すことがある。",
     en:"You've settled into city work, and life looks nothing like the village years. Yet on a noisy street, you sometimes hear the evening sounds of home."},
    {ja:"カンパラのアパートには電気も水道もある。村を出た日に見た景色は、いま日常になった。月末には故郷に仕送りをして、長い休みには土の道を歩いて帰る。",
     en:"Your Kampala apartment has electricity and running water. The view that amazed you the day you left the village is now everyday life. You send money home at month's end, and walk the dirt road back for the holidays."},
  ],
  aai:[  /* AAI——志の約束とともに */
    {ja:"約束を胸に祖国へもどった。思うように進まない日々に、志が重く感じられることもある。——それでも、あなたが開けた扉は、まだ閉じていない。",
     en:"You came home carrying the promise. Some days it feels heavy, when nothing moves the way you hoped. — And yet, the door you opened has not closed."},
    {ja:"祖国にもどって働いている。理想と現実のあいだで悩む日も多いけれど、あなたの姿を見て進路を決めた子が、もう何人もいる。",
     en:"You work in your home country now. Many days are a struggle between ideals and reality — but more than a few kids have chosen their path after watching yours."},
    {ja:"留学から祖国へもどり、しごとと支援の輪をつくる毎日。村の学校では「あの人みたいになりたい」という子が育っている。約束は、暮らしになった。",
     en:"Back from study abroad, you build work and circles of support. In the village school, children say they want to be like you. The promise became a life."},
  ],
  west:[  /* 欧米・日本育ち */
    {ja:"扉はいつも目の前にあった。カギも、たぶん足りていた。それでも開けなかったのは、なぜだろう。",
     en:"The doors were always right in front of you. You probably even had the keys. Why didn't you open them?"},
    {ja:"安定した暮らし。ふとSNSを眺めながら、選ばなかった道を考える夜もある。",
     en:"A stable life. Some nights, scrolling your phone, you wonder about the roads you didn't take."},
    {ja:"好きなしごとと、気の合う仲間と、ときどき旅行。選択肢の多い人生だった——それが「当たり前」だと、思っていたかもしれない。",
     en:"Work you love, friends you click with, a trip now and then. A life full of options — you may have thought that was just \"normal\"."},
  ],
};

/* ══ モード ══
   盤面とエンディング、それに長さで変わる決めごとをひとまとめにして持つ。
   ロビーで選び、ゲームごとに g.mode として持ちまわる。
   サーバーは1つの isolate で複数のルームを動かすので、
   「いま選ばれているモード」をモジュール変数に置いてはいけない。必ず引数で渡す。 */
const MODES = {
  full: {
    key:"full",
    label:{ja:"ぜんぶ（6〜35歳・36マス／60分ぐらい）", en:"Full (age 6–35, 36 squares / about 60 min)"},
    SQUARES:SQ_FULL, AGES:AGES_FULL, CHAPTERS:CH_FULL, ENDINGS:ENDINGS_FULL,
    maxPlayers:6, minStart:2,
    heavyFrom:8,        /* 重いライフイベントが起こりうるマス。できごとマスが多いので8から */
    settleLoan:true,    /* 35歳のゴールで奨学金の残額を一括清算する */
    gradSchool:false,   /* 24歳のしごとのトビラに「大学院」を出さない（大学のトビラが無い） */
    chiikiExtra:false,  /* 助け合いの輪は、26歳以降の挑戦・大きな夢のトビラが受けもつ */
  },
  short: {
    key:"short",
    label:{ja:"みじかめ（6〜25歳・24マス／25分）", en:"Short (age 6–25, 24 squares / 25 min)"},
    SQUARES:SQ_SHORT, AGES:AGES_SHORT, CHAPTERS:CH_SHORT, ENDINGS:ENDINGS_SHORT,
    maxPlayers:4, minStart:1,
    heavyFrom:2,        /* できごとマスが3つしかないので、10歳から起こりうるようにする */
    settleLoan:false,   /* 25歳では返し終わらない。残額を背負ったまま結果発表へ */
    gradSchool:true,
    chiikiExtra:true,
  },
};
const mode = k => MODES[k] || MODES.full;
/* solo=true（1人プレイ）のときは、見くらべる相手がいない。
   「もしも」の答えは、となりの人生ではなくネタバラシの中にある */
function endingText(p, solo, m = MODES.full){
  const ctx = p.aai ? "aai" : (p.fam.rural ? (p.mult >= 10 ? "city" : "village") : "west");
  const tier = p.happy >= 6 ? 2 : (p.happy >= 3 ? 1 : 0);
  const base = m.ENDINGS[ctx][tier];
  if(p.perk === "deai" && !p.deaiUsed){
    const add = solo
      ? {ja:"——もし、支援と出会えていたら。その「もしも」の答えは、あなたに見えなかった「？？？」の中にある。",
         en:"— If only support had found you. The answer to that \"what if\" is inside the ？？？ you never got to see."}
      : {ja:"——もし、支援と出会えていたら。その「もしも」の答えは、となりのプレイヤーの人生が知っている。",
         en:"— If only support had found you. The answer to that \"what if\" lives in another player's life at this table."};
    return {ja: base.ja + "<br>" + add.ja, en: base.en + "<br>" + add.en};
  }
  return base;
}

/* hidden は配列で持つ（JSONで送受信するため）。Set版のロジックをここで吸収する */
export function hideTag(p, tag){ if(!p.hidden.includes(tag)) p.hidden.push(tag); }
export function unhideTag(p, tag){ const i = p.hidden.indexOf(tag); if(i >= 0) p.hidden.splice(i,1); }

export {
  PCOLORS, TYPE_META, FAM_TONE, CHARS, FAM_LOOK, CHAR_POOL, CHAR_COLOR, assignChars, FAMILIES, TALK, EVENTS, MODES, mode,
  choiceDef, shuffle, jobTitle, revealTags, hiddenOptionCount, checkDeai, applyFx,
  effectiveMoneyReq, effectiveMoneyFx, effectiveLearnReq, meetsReq, endingText,
};

/* ---------- 重いライフイベント（定義だけを返す。適用はサーバー側） ---------- */
export function heavyDef(p){
  const canDeath = p.allow > 0;
  const type = canDeath && Math.random() < 0.6 ? "death" : "disaster";
  p.hadHeavy = true;

  if(type === "death"){
    p.allow = 0;
    return {
      heavy:true,
      title:{ja:"家族が、病気で亡くなった。",en:"Someone in your family died of illness."},
      body:{ja:"しばらくして、暮らしの計算が変わっていることに気づく。<br><b>【この先ずっと：仕送りがなくなる】</b>",
            en:"A while later, you notice the math of daily life has changed.<br><b>[From now on: no more allowance]</b>"},
      opts:[
        {t:{ja:"遺児を支える団体・奨学金について調べる",en:"Look into orphan-support groups & scholarships"}, d:{ja:"世界には、親を亡くした子を支える仕組みがある",en:"The world has systems for children who lost a parent"}, req:{}, fx:{learn:1}, special:"shienSupport"},
        {t:{ja:"今は、何も考えられない",en:"You can't think about anything right now"}, d:{ja:"それでいい。時間が必要なときもある",en:"That's okay. Sometimes you need time"}, req:{}, fx:{}, special:"letter"},
      ]
  };
  } else if(p.fam.rural){
    p.disasterTurns = 3;
    return {
      heavy:true,
      title:{ja:"雨が、何か月も降らない。",en:"The rain hasn't come for months."},
      body:{ja:"干ばつで、畑の作物が枯れていく。井戸の水も減ってきた。<br><b>【3ターンのあいだ：かせぎ −10万】</b>",
            en:"Drought is killing the crops. The well is running low.<br><b>[For 3 turns: pay −¥100k]</b>"},
      opts:[
        {t:{ja:"支援団体の食料・種の支援を調べる",en:"Look into food & seed aid"}, d:{ja:"こういうときのための仕組みがある",en:"Systems exist for times like this"}, req:{}, fx:{money:30, learn:1}},
        {t:{ja:"たくわえでしのぐ",en:"Get by on savings"}, d:{ja:"備えがあれば、乗りこえられる",en:"Being prepared carries you through"}, req:{money:30}, fx:{money:-30}},
      ]
  };
  } else {
    p.disasterTurns = 3;
    return {
      heavy:true,
      title:{ja:"深夜、大きな地震があった。",en:"A big earthquake struck in the night."},
      body:{ja:"家族は無事だった。ただ、家と、親の職場は無事ではなかった。<br><b>【3ターンのあいだ：かせぎ −10万】</b>",
            en:"Your family is safe. Your home, and your parent's workplace, are not.<br><b>[For 3 turns: pay −¥100k]</b>"},
      opts:[
        {t:{ja:"災害支援制度・義援金について調べる",en:"Look into disaster aid & relief funds"}, d:{ja:"こういうときのための仕組みがある",en:"Systems exist for times like this"}, req:{}, fx:{money:30, learn:1}},
        {t:{ja:"貯金でしのぐ",en:"Get by on savings"}, d:{ja:"備えがあれば、乗りこえられる",en:"Being prepared carries you through"}, req:{money:30}, fx:{money:-30}},
      ]
  };
  }
}
export function letterDef(){
  return {
    heavy:true,
    title:{ja:"遺児支援団体の人が、家をたずねてきた。",en:"Someone from an orphan-support group knocked."},
    body:{ja:"親を亡くした子どもを支える団体が、世界にはあるという。<br>誰かが、ちゃんと気にかけてくれている。",
          en:"They say groups exist, around the world, that support children who lost a parent.<br>Someone is looking out for you."},
    opts:[
      {t:{ja:"思いきって、話を聞いてみる",en:"Take a breath, and hear them out"}, d:{ja:"支えてくれる仕組みと人は、ちゃんとある",en:"Support systems — and people — do exist"}, req:{}, fx:{learn:1}, special:"shienSupport"},
      {t:{ja:"まだ、話せない",en:"You can't talk yet"}, d:{ja:"もらった連絡先は、大切にとっておこう",en:"Keep the contact card somewhere safe"}, req:{}, fx:{}, special:"letter"},
    ]
  };
}


/* NGO進学説明会（できごとカードから開くトビラ） */
export function fairDef(){
  return {
    title:{ja:"NGOの進学説明会が、となりの町まで来た",en:"An NGO study fair came to the next town"},
    body:{ja:"バス代はかかるけど、行けば情報が手に入る。",en:"Bus fare costs — but information awaits."},
    opts:[
      {t:{ja:"バスを乗りついで行ってみる",en:"Take the buses and go"}, d:{ja:"パンフレットと、話を聞ける大人がそこにいる",en:"Pamphlets, and adults you can actually ask"}, req:{money:5}, fx:{money:-5}, special:"reveal2"},
      {t:{ja:"今回は見送る",en:"Skip it this time"}, d:{ja:"バス代も、ばかにならないから",en:"Bus fare isn't nothing, after all"}, req:{}, fx:{}},
    ]
  };
}
