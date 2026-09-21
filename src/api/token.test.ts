import { expect, test } from "bun:test";
import { parseTokenSet } from "../index.js";

test("parseTokenSet returns the canonical persisted token shape", () => {
  expect(
    parseTokenSet({
      accessToken: "access",
      clientId: "client",
      clientSecret: "secret",
      expiresAt: 1,
      refreshToken: "refresh",
      unrelated: "ignored",
      userid: "123",
    }),
  ).toEqual({
    accessToken: "access",
    clientId: "client",
    clientSecret: "secret",
    expiresAt: 1,
    refreshToken: "refresh",
    userid: 123,
  });
  expect(parseTokenSet({})).toBeUndefined();
});
