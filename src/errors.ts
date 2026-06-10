export class CliError extends Error {
  readonly exitCode: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly why?: string;
  readonly hint?: string;

  constructor(
    message: string,
    exitCodeOrOptions:
      | number
      | {
          exitCode?: number;
          code?: string;
          details?: Record<string, unknown>;
          why?: string;
          hint?: string;
        } = 1,
  ) {
    super(message);
    this.name = "CliError";
    const options =
      typeof exitCodeOrOptions === "number" ? { exitCode: exitCodeOrOptions } : exitCodeOrOptions;
    this.exitCode = options.exitCode ?? 1;
    this.code = options.code;
    this.details = options.details;
    this.why = options.why;
    this.hint = options.hint;
  }
}

export class AuthError extends CliError {
  constructor(message: string) {
    super(message, {
      exitCode: 2,
      why: "Authentication credentials are missing or invalid.",
      hint: "Run withings login, or check WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET.",
    });
    this.name = "AuthError";
  }
}

export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, 3);
    this.name = "ConfigError";
  }
}
