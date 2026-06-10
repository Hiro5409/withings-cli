# Phase 2 plan: Worker/Hono 実利用に伴う follow-up

Phase 1(library-first 化)のマージ後、**実際に別 repo の Worker から使い始めて
摩擦が確認されたときにだけ**着手する。摩擦が出なければこの Phase は丸ごと
やらないのが正しい(YAGNI)。

## Goal

- private worker repo(Cloudflare Worker / Hono)から `withings-cli` を実利用し、
  そこで確認された摩擦だけを解消する。
- 想定される摩擦は次の 3 つ。いずれも「発生したら直す」であり、先回りしない。
  1. TS ソース出荷の型解決(tsc 系 consumer で `exports` が `.ts` を指すことによる
     エラー)。
  2. Worker 向け `TokenStore` 実装(KV / D1 / Durable Object)のリファレンス不足。
  3. webhook 受信側で必要になるペイロード型・検証ヘルパの不足。

## Non-goals

- 本番 webhook server / Worker アプリ本体をこの public repo に置くこと。
  デプロイ設定・secrets・storage 選定は private worker repo の責務であり、
  この repo は reusable client + docs に徹する。
- package 改名(`withings-client` 等)・repo 分割。外部ユーザーが現れるまで凍結
  (それは Phase 3 の議題)。
- CJS dual build。需要が確認されるまで ESM のみ。
- Node ランタイムでの CLI 対応(`bin/withings` は Bun 前提のまま)。

## Current coupling

Phase 1 完了後の前提状態:

- `src/index.ts` が唯一の公開面。`createWithingsClient` + `TokenStore` +
  低レベル関数(`buildAuthorizationUrl` / `exchangeCodeForToken` /
  `refreshAccessToken`)+ 正規化関数が root export される。
- fs 依存は `src/stores/file.ts` と `src/config/*` と `src/commands/*` に隔離済み。
- `package.json` の `exports` は `"."` → `./src/index.ts`(TS ソース直指し)。
- 残る環境依存は「TS ソース出荷」という配布形態のみ。

## Proposed API shape

追加候補(必要になったものだけ実装する):

```ts
// 1. webhook 通知ペイロードの型と parse ヘルパ(受信は consumer 側の責務)
import { parseNotificationPayload, type WithingsNotification } from "withings-cli";

// 2. docs/examples に置く TokenStore リファレンス実装(コピペ用スニペット、
//    package には含めない)
//    - Cloudflare KV 版
//    - D1 版(並行 refresh 注意点コメント付き)
```

配布形態の変更(摩擦 1 が確認された場合のみ):

```jsonc
// package.json
"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
"files": ["bin", "dist", "src"]  // bin は Bun 実行のため src も残す
```

- ビルドは `bun build`(JS)+ `tsgo --emitDeclarationOnly` 相当(d.ts)を想定。
  `prepublishOnly` に組み込み、リポジトリには dist をコミットしない。

## File changes

すべて条件付き。確認された摩擦に対応するものだけ作る。

```
docs/examples/worker-token-store.md   # 新規: KV / D1 の TokenStore スニペット集
src/api/notify.ts もしくは新規 module # 変更: 通知ペイロード型 + parse ヘルパ追加
package.json                          # 変更: dist 出荷への exports 切り替え(摩擦 1 のみ)
.github/workflows/release.yml         # 変更: ビルド工程追加(摩擦 1 のみ。別エージェント
                                      #       作業との競合に注意して着手前に最新を確認)
README.md / README.ja.md              # 変更: examples への導線
```

## Step-by-step tasks

1. private worker repo で `withings-cli` を依存に追加し、wrangler dev / deploy まで
   通す。ここで出た問題を issue 化する(このステップ自体は worker repo 側の作業)。
2. 型解決の摩擦が出た場合: dist ビルド(JS + d.ts)を導入し、`exports` を dist に
   切り替える。`bunx withings-cli` と `bun add -g` の CLI 経路が壊れないことを確認。
3. `docs/examples/worker-token-store.md` に KV / D1 の `TokenStore` 実装例を置く。
   並行 refresh(refresh token ローテーション)の注意を例の中にコメントで残す。
4. webhook 受信を実装する段になったら、通知ペイロードの型と parse ヘルパを
   library に追加する(受信 endpoint そのものは worker repo 側)。
5. README から examples へリンクし、「webhook server はこの repo には含めない」
   方針を明文化する。

## Tests / verification

- dist 出荷に切り替えた場合:
  - `npm pack` した tarball を一時ディレクトリで展開し、Bun と tsc(bundler
    resolution)の両方から import が型ごと解決できることを確認する。
  - CLI 経路(`bunx`、`bun add -g`)のスモークテスト。
  - release workflow でのビルド成果物検証(publish 前に `node -e "import(...)"`
    相当のスモーク)。
- parse ヘルパ追加時: 実際の Withings 通知ペイロードのサンプルを fixture にした
  ユニットテスト。
- 継続条件: `bun run typecheck && bun run lint && bun run knip && bun test` green。

## Risks / open questions

- dist 出荷に切り替えると「ソースそのまま」というこの repo の単純さが失われ、
  ビルド成果物と src の二重管理になる。摩擦が実証されるまで踏み込まない最大の
  理由がこれ。
- `.github/workflows/release.yml` は並行作業の差分があるため、ビルド工程を足す
  場合は着手時点の最新内容を確認してから計画を更新する。
- Withings の webhook に署名検証の仕組みがあるか未確認(docs が JS レンダリング
  で機械取得しづらい)。webhook ヘルパ設計時に一次情報を再確認する。
- D1/KV ストア例における排他の推奨(Durable Object を必須とするか、
  「稀な再ログインを許容」と書くか)は worker repo での実測後に決める。
