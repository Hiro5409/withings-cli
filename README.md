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

Requires [Bun](https://bun.sh/) 1.4.2 or newer.

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

Library consumers can parse the form-encoded callback payload and normalize
common fields with `parseNotificationPayload`. This package does not provide a
webhook server, queue, storage layer, or retry/idempotency policy.
If you call the parser inside a webhook receiver, catch invalid payload errors
there and decide the HTTP response policy in that application.

### Raw API

```bash
withings raw call user getdevice --format json
withings raw call measure getmeas '{"category":1,"meastypes":"1,6,76,77,88"}'
echo '{"startdateymd":"2026-06-01","enddateymd":"2026-06-10","data_fields":"steps,distance,elevation,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3"}' | withings raw call measurev2 getactivity
```

Raw commands are the escape hatch for Withings endpoints that do not have a
dedicated command yet. They refresh OAuth credentials, send a form-encoded POST,
add `action=<action>`, and print the unmodified `{ status, body }` envelope.
The optional JSON object is sent as form fields; if omitted, stdin JSON is
accepted. `raw measure-getmeas` provides the body-measure-specific raw response.

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

## Library Use

The package also exposes a small library surface from the root export. Use it
when your app wants to call Withings directly instead of shelling out to the
CLI.

The client only needs a `TokenStore`, so storage is app-owned. The example below
uses Cloudflare Workers KV; in another runtime, use your database, Redis,
SQLite, or other persistent store instead.

A `TokenSet` includes OAuth client credentials and access/refresh tokens, so
protect the store accordingly.

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

## Development

Install and [activate mise](https://mise.jdx.dev/getting-started.html). mise
installs the Bun version in `.bun-version` and the Gitleaks and Lefthook
versions in `mise.toml`:

```bash
mise trust
mise install
bun install --frozen-lockfile
lefthook install
bun run typecheck
bun test
```

[Lefthook](https://lefthook.dev/) runs the Git hooks in `lefthook.yml`. The
pre-commit hook runs lint, type-check, tests, and Knip, and scans the staged
changes for secrets with Gitleaks. The pre-push hook runs
`bun audit --audit-level=high`, which fails on high and critical advisories.
CI runs the same checks and scans the Git history with the same Gitleaks
version.

`bun run check:package` packs the npm artifact into `artifact/` and lints
that tarball with publint and Are the Types Wrong?. CI also installs the
tarball into an empty project, runs its CLI, and runs and type-checks a
library consumer against it.

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

## Releases

A maintainer releases from `main`: commit the new `version` in
`package.json`, push the commit to `main`, then push the annotated tag for
that version:

```bash
git tag -a v1.2.3 --cleanup=verbatim -F - <<'NOTES'
## Changes

- Describe a change a user will notice.
NOTES
git push origin v1.2.3
```

The tag message becomes the GitHub Release notes. Git reads it from standard
input, and `--cleanup=verbatim` keeps lines that start with `#`, such as
Markdown headings, which Git otherwise strips as comments.

The tag starts the Release workflow. The workflow verifies that the tag is
annotated, matches `package.json`, and belongs to `main`, then runs CI on
the tagged commit. CI packs the npm artifact once, lints that tarball, and
uploads it, then smoke-tests the installed package and the standalone
executable. Both publishing jobs start only after every CI check passes, and
download the uploaded artifact instead of building it again.

The first job publishes the artifact to npm through
[trusted publishing](https://docs.npmjs.com/trusted-publishers/), which
attaches provenance. npm
[scans a new version](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)
before serving it, so the second job waits up to 30 minutes for the version to
become visible. It creates the GitHub Release only when the version on npm has
the integrity of the checked artifact. It attaches the artifact while
the release is a draft and then publishes it, because an
[immutable release](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
locks its assets once it is published.

Publishing relies on an npm trusted publisher for user `Hiro5409`, repository
`withings-cli`, and workflow filename `release.yml`, with no environment.
The workflow behaves the same whether or not the repository enforces immutable
releases.

To retry a failed run, rerun its failed jobs while the run keeps its artifact;
they download the artifact the run already checked:

```bash
gh run rerun <run-id> --failed
```

Once the run or its artifact has expired, run the workflow again from its tag:

```bash
gh workflow run release.yml --ref v1.2.3
```

This run packs and checks the tagged commit again, and continues past a
version already on npm only when the new tarball matches it byte for byte.
Every run acts on what it finds: it publishes the artifact while the version
is not visible on npm, and creates the GitHub Release while none exists for
the tag. A release that carries the checked artifact is complete, and the run
leaves it as it is. A run started from a branch stops at tag verification; the
workflow never changes `main`, the version, or tags.

A run stops when it cannot read npm or GitHub, when the version on npm differs
from the checked artifact, and when an existing release lacks the checked
artifact or carries a different one. A run also fails when npm does not serve
the version within 30 minutes; retry once the version is visible.

GitHub CLI attempts to delete its draft when attaching the artifact or
publishing the release fails. A failed cleanup or an interrupted run can leave
a draft release behind; the workflow does not look for drafts, so a maintainer
deletes it.
