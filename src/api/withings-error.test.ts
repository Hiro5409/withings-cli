import { expect, test } from "bun:test";
import { assertWithingsOk, WithingsApiError } from "./withings-error.ts";

test("allows successful Withings responses", () => {
  expect(() =>
    assertWithingsOk({ status: 0 }, { service: "measure", action: "getmeas" }),
  ).not.toThrow();
});

test("adds endpoint-specific hint for known Withings status", () => {
  try {
    assertWithingsOk({ status: 503 }, { service: "user", action: "get" });
  } catch (error) {
    expect(error).toBeInstanceOf(WithingsApiError);
    expect((error as WithingsApiError).code).toBe("invalid_params");
    expect((error as WithingsApiError).withingsStatus).toBe(503);
    expect((error as WithingsApiError).endpoint).toBe("user.get");
    expect((error as WithingsApiError).hint).toContain("account-creation integrations");
    return;
  }

  throw new Error("Expected WithingsApiError");
});

test("adds generic hint for unknown Withings status", () => {
  try {
    assertWithingsOk({ status: 999 }, { service: "unknown", action: "call" });
  } catch (error) {
    expect(error).toBeInstanceOf(WithingsApiError);
    expect((error as WithingsApiError).code).toBe("unknown");
    expect((error as WithingsApiError).hint).toContain("OAuth scopes");
    return;
  }

  throw new Error("Expected WithingsApiError");
});
