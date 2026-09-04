# トビラ せかい版 オンライン — 作業セッション用ブリーフ

このリポジトリ(/Users/arisa/door-world-online)の作業をするセッションです。まず SETUP.md を読み、次に下の「現状」を把握してから作業してください。

## これは何か
教育ボードゲーム「トビラ せかい版」を、**参加者それぞれの端末で遊べる**ようにしたオンライン版。
公開URL: https://tobira-online.tobira-online.workers.dev (Cloudflare Workers + Durable Objects・無料枠)

姉妹プロジェクト(どちらも別リポジトリ・現役):
- /Users/arisa/door-world-game … 1画面をみんなで囲む「せかい版」。**ゲーム内容の正はこちら**
- /Users/arisa/door-domestic-game … 国内版

## 現状（2026-09-04 時点・デプロイ済み）
- 2〜6人。進行役が「ルームをつくる」→6文字のあいことば→各自が自分の端末で参加→ゲーム開始
- ゲームの判定はすべてサーバー(Durable Object)が持ち、クライアントは表示と入力だけ
- **家庭カードは持ち主の接続にしか送らない**(公開は名前・色・位置・おかね・まなび・♥のみ。結果発表で全公開)
- 盤面・手番・全員の状態を全端末に同期。手番の人だけ操作でき、他の人には読み取り専用で同じ画面が映る
- 結果発表・35歳のいまエンディング・ネタバラシ・トビラ一覧・ふりかえり・日英切り替え すべて実装済み
- 2〜6人の通しプレイ自動テストが、ローカル・本番の両方で完走することを確認済み

## ファイル構成
- `src/index.js` … Worker + Room(Durable Object)。ゲーム進行の全判定
- `public/rules.js` … サーバーと画面が共有するルール・文言・盤面データ
- `public/app.js` … クライアント(表示と入力のみ)
- `public/index.html` … 画面の骨格とCSS
- `test/play.mjs` … 通しプレイの自動テスト(`N=人数 HOST=接続先 node test/play.mjs`)
- `wrangler.toml` … Durable Objectは SQLite バックエンド(無料枠の条件)

## よく使うコマンド
```bash
export PATH="/usr/local/bin:$PATH"
npx wrangler dev            # ローカル http://localhost:8787
npx wrangler deploy         # 本番へ反映
N=4 node test/play.mjs      # ローカルへ通しテスト
HOST=wss://tobira-online.tobira-online.workers.dev N=4 node test/play.mjs   # 本番へ
```
- Cloudflareはログイン済み(`wrangler whoami` で確認可)
- macOS標準のcurlは古いTLSでworkers.devに繋がらないことがある。確認は node の fetch かブラウザで

## 守ること
- **ゲームバランス・文言は1画面版(door-world-game)と同一に保つ**。ルールを変えるときは両方に反映する
- 新しいテキストは必ず日英そろえて書く({ja,en} オブジェクト + L() ヘルパー)
- 👁？？？の種明かしは結果発表まで伏せる。家庭カードの秘密を壊す変更をしない
- デザイン: Zen Maru Gothic / クリーム#FBF8F1 + 茶#4A3A30 / 手描き風

## 既知の注意点
- 同じ端末の別タブは別プレイヤーになる(sessionStorage)。`?pid=なにか` で固定もできる
- 開始後は新規参加不可(再接続は可能)
- ブラウザのタブが非表示だとタイマーが絞られるため、自動テストはブラウザではなく `test/play.mjs` を使う
