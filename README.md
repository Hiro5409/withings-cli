# withings-cli

Thin local-first CLI for the Withings Public API.

## Install

```bash
bun install
bun run generate-types
bun src/main.ts --help
```

For local development:

```bash
bun run dev -- status
bun run build
./withings --help
```

## Setup

Create a Withings developer application at:

```text
https://developer.withings.com/dashboard/
```

Use this callback URL:

```text
http://localhost:8765/auth/withings/callback
```

Set OAuth credentials in the environment:

```bash
export WITHINGS_CLIENT_ID="your-client-id"
export WITHINGS_CLIENT_SECRET="your-client-secret"
```

Then authenticate:

```bash
bun src/main.ts login
```

The login flow opens the Withings authorization URL and exchanges the short-lived
authorization code through a local callback server. Tokens are stored locally in:

```text
~/.config/withings-cli/credentials.json
```

The credentials file is written with `0600` permissions. Do not commit OAuth
credentials or raw callback URLs.

## Usage

```bash
withings <command> [options]
```

During development, replace `withings` with `bun src/main.ts`.

### Global options

| Flag | Description |
|------|-------------|
| `-f, --format` | Output format: `json` or `table` (default: `table`) |
| `--profile` | OAuth profile name (default: `default`) |
| `-q, --quiet` | Suppress non-essential output |
| `--no-color` | Disable colored output |

### Auth

```bash
withings login
withings status
withings status --format json
withings logout
```

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
withings latest
withings latest --format json
withings measures --limit 30
withings measures --startdate 1710000000 --enddate 1720000000 --format json
withings measures --lastupdate 1720000000 --format json
```

The normalized measure fields currently cover:

| Withings type | Field |
|---------------|-------|
| `1` | `weightKg` |
| `6` | `fatRatioPercent` |
| `76` | `muscleMassKg` |
| `77` | `hydrationKg` |
| `88` | `boneMassKg` |

The CLI follows `more` / `offset` pagination for `measure-getmeas`.

### Raw API

```bash
withings raw measure-getmeas --format json
withings raw measure-getmeas --startdate 1710000000 --enddate 1720000000
```

Raw commands still use the generated `@hey-api/openapi-ts` SDK, but the CLI
keeps UX, token refresh, and measure normalization in small hand-written
modules.

## Development

```bash
bun install
bun run generate-types
bun run typecheck
bun test
```

OpenAPI types are generated from:

```text
/Users/delamtt28/Downloads/openapi.json
```

The Withings OpenAPI document contains absolute URL paths and some duplicated
endpoints that differ only by trailing spaces. Keep generated files under
`src/types/withings`; put stable CLI behavior in hand-written wrappers.
