# ひるしか Ver.0.5 セットアップ

## 構成
- GitHub Pages: スマホ画面/PWA
- Cloudflare Worker: OpenAI APIへの安全な中継
- OpenAI APIキー: WorkerのSecretにのみ保存。GitHubには置かない

## 1. 先にGitHub側を更新
`index.html`、`manifest.webmanifest`、`sw.js`、`assets/` を既存の `hirushika` リポジトリへ上書きし、Commit → Push。

## 2. Cloudflare Workerを作る
Cloudflareにログイン → Workers & Pages → Create → Worker。
作成したWorkerのコードを `worker/worker.js` の内容で置き換えて Deploy。

## 3. Workerの環境変数
Worker Settings → Variables and Secrets で以下を追加。

- Secret: `OPENAI_API_KEY` = OpenAI Platformで発行したAPIキー
- Variable: `ALLOWED_ORIGIN` = `https://manabu20200701.github.io`
- Variable: `OPENAI_MODEL` = `gpt-5.6-luna`

APIキーは絶対にGitHubのindex.htmlへ書かない。

## 4. スマホの「ひるしか」で接続
ひるしかHOME → `AI接続設定` → Worker URLを貼付。
例: `https://hirushika-ai.xxxxx.workers.dev`
`保存して接続確認` → 「接続OK」なら完了。

## 5. 試す
- `何食べる？`: 自由入力で会話。候補が決まれば「これでランチする」。
- `ランチする`: AIが会話を生成。`詳しく`は何回でも要求できる。
- `続ける`: 10秒ロック。会話の連打を防ぐ。
- 15分未満で終了する場合は確認ダイアログ。

## MVP上の注意
このWorkerは少人数テスト用。一般公開前には、利用回数制限、認証または不正利用対策、ログ/エラー監視、プライバシーポリシー整備を追加する。
