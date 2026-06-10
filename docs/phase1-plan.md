# Phase 1 plan: library-first + CLI included への最小改修

1 PR で完結する粒度。CLI の挙動・コマンド体系・npm package 名は一切変えず、
`import { createWithingsClient } from "withings-cli"` を可能にする。

## Goal

- `src/api/*` を runtime-agnostic な library core にする。唯一の fs 結合点である
  `src/api/client.ts` の `ensureValidToken` から `node:fs` 依存を抜き、token storage を
  `TokenStore` interface として注入可能にする。
- `src/index.ts` を新設し、`package.json` に `exports` map を追加して公開面を root
  export 1 本に定義する。subpath export(`withings-cli/api` など)は作らない。
- Cloudflare Worker / Hono などの別プロジェクトから、KV / D1 / Durable Object を
  token storage にして利用できる状態にする。

## Non-goals

- package 改名・repo 分割・monorepo 化(外部ユーザーが現れるまで凍結)。
- ビルド成果物(`.js` + `.d.ts`)の出荷。TS ソース出荷のまま(Phase 2 の判断事項)。
- webhook server / Worker example アプリの追加(private worker repo の責務)。
- fetch の抽象化、CJS dual build、Node ランタイムでの CLI 対応。
- エラー型の改名(`CliError` の `exitCode` は library では無害に無視できる)。

## Current coupling

依存方向はすでにほぼ正しく、fs への到達経路は 1 本に集約されている。

| 場所                                                                                  | 状態                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/parse.ts`, `src/api/withings-error.ts`, `normalizeMeasureGroup` 等           | 純粋。変更不要                                                                                                                           |
| `src/api/auth.ts`                                                                     | token 交換/refresh は fetch のみ。ただし `REDIRECT_URI` が loopback 固定(`auth.ts:12`)、`removeProfile`(`auth.ts:136-140`)だけ fs に触る |
| `src/api/measures.ts` / `activity.ts` / `sleep.ts` / `notify.ts` / `raw.ts`           | `{configDir, profile}` を素通しして `postWithingsForm` を呼ぶだけ                                                                        |
| `src/api/client.ts`                                                                   | 唯一の結合点。`ensureValidToken` が `loadCredentials` / `saveCredentials` / `withCredentialsLock`(node:fs)を直接呼ぶ                     |
| `src/config/credentials.ts`, `src/config/config.ts`                                   | Node/Bun 専用(fs、HOME、lock)。CLI 側実装として残す                                                                                      |
| `src/commands/*`, `src/cli.ts`, `src/output.ts`, `src/error-output.ts`, `src/main.ts` | CLI 専用。現状維持                                                                                                                       |
| `package.json`                                                                        | `exports` なし。`files: ["bin", "src"]` で TS ソース出荷。`bin` のみ公開                                                                 |

## Proposed API shape

```ts
// 公開面は root export 1 本。
import {
  createWithingsClient,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  normalizeMeasureGroup,
  type TokenStore,
  type TokenSet,
} from "withings-cli";

// TokenStore: load/save の 2 メソッドのみ。1 client = 1 トークン。
// profile の概念は store 実装側(CLI の FileTokenStore)に閉じ込める。
type TokenStore = {
  load(): Promise<TokenSet | undefined>;
  save(tokenSet: TokenSet): Promise<void>;
};

const client = createWithingsClient({ store });
const { measures } = await client.fetchMeasures({ query: { limit: 7 } });
const latest = await client.fetchLatestMeasure();
const activity = await client.fetchActivity({ query: { limit: 7 } });
const sleep = await client.fetchSleep({ query: { limit: 7 } });
const raw = await client.raw({ service: "user", action: "getdevice", fields: {} });
// notify list/subscribe/revoke も client メソッドとして公開
```

設計上の決定:

- 並行 refresh の排他(現 `withCredentialsLock`)は **store の責務**に移す。
  `FileTokenStore` が lock を内包し、KV/D1 実装者は Durable Object 等で各自選択する。
  `TokenStore` の doc コメントに「refresh token はローテーションするため、並行
  refresh は片方のトークンを無効化する」旨を必ず書く。
- `redirect_uri` は `buildAuthorizationUrl` / `exchangeCodeForToken` の引数にし、
  loopback 値(`http://localhost:8765/auth/withings/callback`)は CLI 側のデフォルト
  に降格する。

## File changes

```
src/
  index.ts              # 新規: 公開 export の唯一の定義
  api/
    client.ts           # 変更: ensureValidToken を TokenStore 経由に。fs import を削除
    auth.ts             # 変更: redirect_uri をパラメータ化。removeProfile は CLI 側へ移動
    measures.ts ほか    # 変更: 引数 {configDir, profile} → store(機械的置換)
  stores/
    file.ts             # 新規: FileTokenStore(config/credentials.ts + lock を包む)
  config/credentials.ts # 変更: withCredentialsLock の輸出先が stores/file.ts になる
  commands/*            # 変更: FileTokenStore を生成して渡す(約 7 ファイル、機械的)
package.json            # 変更: "exports": { ".": "./src/index.ts" } を追加
README.md / README.ja.md # 変更: library 利用の最小例(TokenStore の KV 実装 10 行程度)
```

破壊的変更: なし。`bin` は不変、library surface は新規追加のみ。

## Step-by-step tasks

1. `TokenStore` 型と `createWithingsClient` の骨格を `src/index.ts` + `src/api/client.ts`
   に定義する(まだ既存経路は壊さない)。
2. `src/stores/file.ts` に `FileTokenStore` を実装する。`configDir` + `profile` を
   コンストラクタで受け、`load`/`save` 内で `withCredentialsLock` による排他と
   double-checked refresh の前提(lock 内再読込)を維持する。
3. `src/api/client.ts` の `ensureValidToken` を store 経由に書き換える。
   現行の「期限内なら即 return、期限切れなら lock → 再読込 → 再判定 → refresh →
   save」のロジックを等価に移植する。
4. `src/api/measures.ts` / `activity.ts` / `sleep.ts` / `notify.ts` / `raw.ts` の
   `{configDir, profile}` 引数を store(または client インスタンス)に置換する。
5. `src/commands/*` を `FileTokenStore` 生成に切り替える。`removeProfile` は
   `src/api/auth.ts` から CLI 側(`stores/file.ts` か commands)へ移す。
6. `src/api/auth.ts` の `REDIRECT_URI` 定数をパラメータ化し、CLI の login コマンド
   だけが loopback デフォルトを渡すようにする。
7. `package.json` に `exports` map を追加する。
8. README に library 利用例(Worker + KV の `TokenStore` 最小実装)を追記する。

## Tests / verification

- 既存テスト(34 件)が無変更または機械的な引数置換のみで green であること。
- 追加するテスト:
  - `createWithingsClient` + インメモリ `TokenStore` で「期限切れ → refresh →
    save が呼ばれる」「期限内 → save が呼ばれない」を検証(fs 不要になるので
    既存の fetch モックよりテストが書きやすくなるはず)。
  - `FileTokenStore` が既存の credentials.json 形式・権限(0600/0700)・lock 挙動を
    維持していること(既存 `credentials.test.ts` の流用 + store 経由の 1 本)。
- 検証コマンド: `bun run typecheck && bun run lint && bun run knip && bun test`。
- 手動確認: `bun run dev -- status` と `bun run dev -- latest`(実トークンで CLI
  経路のリグレッションがないこと)。

## Risks / open questions

- TS ソース出荷のまま外部 repo から import したときの型解決(tsc 系 consumer)。
  Bun / wrangler(esbuild)は node_modules 内 `.ts` を扱えるが、素の tsc では摩擦が
  出る可能性がある。Phase 1 では先回りせず、実利用で摩擦が出たら Phase 2 で
  ビルド出荷に切り替える。
- `AuthError` の hint 文言("Run withings login")が Worker のエラーに混ざる。
  実害は小さいので Phase 1 では触らない。気になったら hint 付与を CLI 層へ移す。
- lock を store 責務に移すことで「KV/D1 実装者が排他を忘れる」余地が生まれる。
  doc コメントと README の例で明示する以上の強制はしない。
- `raw` コマンドの `SERVICE_URLS` allowlist は library でも維持する(任意 URL への
  認証付き POST を公開面に出さない)。
