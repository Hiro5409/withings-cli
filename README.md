<p align="center">
  <img src="./assets/withings-cli-hero.png" alt="withings CLI" width="100%">
</p>

<h1 align="center">withings-cli</h1>

<p align="center">
  Thin local-first CLI for the Withings Public API.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/withings-cli">
    <img src="https://img.shields.io/npm/v/withings-cli" alt="npm version">
  </a>
  <a href="https://github.com/Hiro5409/withings-cli/actions/workflows/ci.yml">
    <img src="https://github.com/Hiro5409/withings-cli/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
</p>

<p align="center">
  English | <a href="README.ja.md">日本語</a>
</p>

## Quick Start

Requires [Bun](https://bun.sh/).

1. Create a Withings developer application at
   <https://developer.withings.com/dashboard/> with this callback URL:

   ```text
   http://localhost:8765/auth/withings/callback
   ```

2. Export the OAuth credentials of that application:

   ```bash
   export WITHINGS_CLIENT_ID="your-client-id"
   export WITHINGS_CLIENT_SECRET="your-client-secret"
   ```

3. Log in (opens the Withings authorization page in your browser):

   ```bash
   bunx withings-cli login
   ```

4. Fetch your latest body measurements:

   ```bash
   bunx withings-cli latest
   ```

## Install

`bunx withings-cli` works without installing. For repeated use, install the
CLI globally:

```bash
bun add -g withings-cli
withings --help
```

For local development:

```bash
bun install
bun run dev -- status
bun run build
./withings --help
```

## Library Use

The package also exposes a small library surface from the root export:

```ts
import { createWithingsClient, type TokenSet, type TokenStore } from "withings-cli";

// This minimal KV store is safe when calls are already serialized, for example
// inside one Durable Object instance.
function kvTokenStore(kv: KVNamespace, key = "withings:tokens"): TokenStore {
  return {
    async load(): Promise<TokenSet | undefined> {
      const value = await kv.get<TokenSet>(key, "json");
      return value ?? undefined;
    },
    async save(tokenSet: TokenSet): Promise<void> {
      await kv.put(key, JSON.stringify(tokenSet));
    },
  };
}

const client = createWithingsClient({ store: kvTokenStore(env.WITHINGS_KV) });
const latest = await client.fetchLatestMeasure();
```

Withings refresh tokens rotate. If multiple requests can refresh the same
token concurrently, serialize refreshes in your `TokenStore` implementation
with `withRefreshLock`, using a Durable Object, D1 transaction, or another lock
that owns the full load -> refresh -> save sequence.

## Usage

```bash
withings <command> [options]
```

During development, replace `withings` with `bun src/main.ts`.

### Global options

| Flag           | Description                                         |
| -------------- | --------------------------------------------------- |
| `-f, --format` | Output format: `json` or `table` (default: `table`) |
| `--profile`    | OAuth profile name (default: `default`)             |
| `--no-color`   | Disable colored output                              |

### Auth

```bash
withings login                  # OAuth login via browser
withings status                 # show who is logged in
withings status --format json
withings logout                 # remove local credentials
```

Tokens are stored locally in `~/.config/withings-cli/credentials.json`,
written with `0600` permissions. Do not commit OAuth credentials or raw
callback URLs. `logout` removes local credentials only; Withings access
tokens expire on their own after a few hours. See
[OAuth design notes](#oauth-design-notes) for how the login flow works.

`status --format json` returns structured JSON even when no credentials exist:

```json
{
  "authenticated": false,
  "profile": "default",
  "configDir": "~/.config/withings-cli",
  "credentialsPath": "~/.config/withings-cli/credentials.json"
}
```

### Body measures

```bash
withings latest                 # most recent value per measure type
withings latest --format json
withings measures --limit 30    # measurement history
withings measures --startdate 1710000000 --enddate 1720000000 --format json
withings measures --lastupdate 1720000000 --format json
```

The normalized measure fields currently cover:

| Withings type | Field             |
| ------------- | ----------------- |
| `1`           | `weightKg`        |
| `5`           | `fatFreeMassKg`   |
| `6`           | `fatRatioPercent` |
| `8`           | `fatMassKg`       |
| `76`          | `muscleMassKg`    |
| `77`          | `hydrationKg`     |
| `88`          | `boneMassKg`      |

The CLI follows `more` / `offset` pagination for `measure-getmeas`.

### Activity

```bash
withings activity               # daily activity summary
withings activity --limit 7 --format json
withings activity --startdateymd 2026-06-01 --enddateymd 2026-06-10
withings activity --lastupdate 1720000000
```

`activity` returns one normalized row per day: `date`, `steps`, `distanceM`,
`caloriesKcal`, `totalCaloriesKcal`, `softMin`, `moderateMin`, `intenseMin`,
and `hrAverage`. Use `raw measurev2 getactivity` with `data_fields` for fields
that are not normalized, such as elevation or heart-rate zones. Webhook
category `16` notifies activity changes.

### Sleep

```bash
withings sleep                  # one row per sleep period, naps included
withings sleep --limit 7 --format json
withings sleep --startdateymd 2026-06-01 --enddateymd 2026-06-10
withings sleep --lastupdate 1720000000
```

`sleep` returns one normalized row per sleep period, including naps: `date`,
`startdate`, `enddate`, `sleepScore`, `totalSleepTimeMin`, `deepMin`,
`lightMin`, `remMin`, `awakeMin`, and `hrAverage`. Minute-level `sleepv2.get`
remains available through `raw sleepv2 get`; there is no dedicated command for
it yet. Webhook category `44` notifies sleep changes.

### Webhooks

Withings can POST a notification to your server when new data arrives
([notification overview](https://developer.withings.com/developer-guide/v3/data-api/notifications/notification-overview/)).
The CLI manages those subscriptions; receiving the callbacks is up to your
own publicly reachable endpoint.

```bash
withings notify list
withings notify subscribe --callbackurl https://example.com/hook --appli 1
withings notify revoke --callbackurl https://example.com/hook
```

Common `--appli` notification categories:

| appli | Data                        |
| ----- | --------------------------- |
| `1`   | Weight / body composition   |
| `4`   | Heart rate / blood pressure |
| `16`  | Activity                    |
| `44`  | Sleep                       |

### Raw API

```bash
withings raw user getdevice --format json
withings raw measure getmeas '{"category":1,"meastypes":"1,6,76,77,88"}'
echo '{"startdateymd":"2026-06-01","enddateymd":"2026-06-10","data_fields":"steps,distance,elevation,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3"}' | withings raw measurev2 getactivity
```

Raw commands are the escape hatch for Withings endpoints that do not have a
dedicated command yet. They refresh OAuth credentials, send a form-encoded POST,
add `action=<action>`, and print the unmodified `{ status, body }` envelope.
The optional JSON object is sent as form fields; if omitted, stdin JSON is
accepted. `raw measure-getmeas` remains as a compatibility alias for the older
raw body-measure command.

### Error JSON

When `--format json` is used, CLI errors are written to stderr as structured
JSON. Withings API status errors include fields agents can branch on:

```json
{
  "error": "Withings API returned status 503 for user.get.",
  "exitCode": 4,
  "code": "invalid_params",
  "withingsStatus": 503,
  "endpoint": "user.get",
  "why": "The HTTP request succeeded, but Withings rejected the API operation.",
  "hint": "user.get is restricted to account-creation integrations such as Withings Cellular Solutions or Mobile SDK. For this OAuth app, use user.getdevice or user.getgoals."
}
```

## Development

```bash
bun install
bun run typecheck
bun test
```

### OAuth design notes

The login flow opens the Withings authorization URL and exchanges the
short-lived authorization code through a local callback server. It follows
[RFC 8252 (OAuth 2.0 for Native Apps)](https://datatracker.ietf.org/doc/html/rfc8252)
where the [Withings OAuth implementation](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-web-flow)
allows it:

- Authorization Code flow with a loopback redirect; the callback server binds
  to `127.0.0.1` and ignores requests whose `state` does not match the
  CSRF token generated for the current login attempt.
- **No PKCE**: Withings does not support PKCE. The `state` check plus the
  loopback-only listener stand in for it.
- **`client_secret` is stored next to the tokens**: the Withings
  [token endpoint](https://developer.withings.com/api-reference/#tag/oauth2)
  requires `client_id` and `client_secret` on every refresh, so the secret you
  registered is kept in `credentials.json` (mode `0600`) to make refresh work
  without re-exporting environment variables.
- Withings deviates from standard OAuth 2.0 in other ways as well: the token
  endpoint needs an `action=requesttoken` parameter and wraps its response in
  a `{ status, body }` envelope. The hand-written auth module absorbs these
  quirks.

### Type policy

All Withings wire types are hand-written and colocated with the module that
fetches them (e.g. the `measure.getmeas` shapes live in
`src/api/measures.ts`). Responses are parsed with runtime checks at the API
boundary — never `as`-asserted — so an unexpected payload degrades to
`undefined` fields instead of lying to the type system.

We deliberately do not generate code from the Withings OpenAPI document: it
is written for rendering API reference pages, not codegen (action-multiplexed
RPC endpoints deduplicated by whitespace-padded URLs, required parameter
values stated only in prose). The document is vendored at `spec/openapi.json`
purely as a reference for writing types by hand
(source: [Withings developer documentation](https://developer.withings.com/api-reference/)).
