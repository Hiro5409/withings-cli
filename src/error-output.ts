import colors from "yoctocolors";
import { CliError } from "./errors.ts";

const ERROR_PRINTED = Symbol.for("withings-cli.errorPrinted");

type ErrorWithPrintedFlag = Error & { [ERROR_PRINTED]?: boolean };

export function wasErrorPrinted(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as ErrorWithPrintedFlag)[ERROR_PRINTED],
  );
}

function markErrorPrinted(error: unknown): void {
  if (error && typeof error === "object") {
    try {
      (error as ErrorWithPrintedFlag)[ERROR_PRINTED] = true;
    } catch {
      // Some parser errors are frozen by the CLI framework.
    }
  }
}

export function formatFromArgv(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format" || arg === "-f") return String(argv[i + 1] ?? "");
    if (arg?.startsWith("--format=")) return arg.slice("--format=".length);
  }
  return "";
}

export function errorExitCode(error: unknown): number {
  return error instanceof CliError ? error.exitCode : 1;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorPayload(error: unknown): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    error: errorMessage(error),
    exitCode: errorExitCode(error),
  };

  if (error instanceof CliError) {
    if (error.code) payload.code = error.code;
    for (const [key, value] of Object.entries(error.details ?? {})) {
      if (!(key in payload)) payload[key] = value;
    }
    if (error.why) payload.why = error.why;
    if (error.hint) payload.hint = error.hint;
  }

  return payload;
}

export function printError(error: unknown, format: string): number {
  if (format === "json") {
    console.error(JSON.stringify(errorPayload(error), null, 2));
  } else {
    console.error(colors.red(errorMessage(error)));
    if (error instanceof CliError) {
      if (error.why) console.error(colors.dim(`why: ${error.why}`));
      if (error.hint) console.error(colors.dim(`hint: ${error.hint}`));
    }
  }
  markErrorPrinted(error);
  return errorExitCode(error);
}
