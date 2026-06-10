import { expect, test } from "bun:test";
import { WithingsApiError } from "./api/withings-error.ts";
import { printError } from "./error-output.ts";

test("prints structured Withings API fields in JSON error output", () => {
  const originalError = console.error;
  const lines: string[] = [];
  console.error = (message?: unknown) => {
    lines.push(String(message));
  };

  try {
    const exitCode = printError(
      new WithingsApiError(503, { service: "user", action: "get" }),
      "json",
    );
    expect(exitCode).toBe(4);
  } finally {
    console.error = originalError;
  }

  const payload = JSON.parse(lines.join("\n")) as Record<string, unknown>;
  expect(payload.code).toBe("invalid_params");
  expect(payload.withingsStatus).toBe(503);
  expect(payload.endpoint).toBe("user.get");
  expect(payload.hint).toContain("account-creation integrations");
});
