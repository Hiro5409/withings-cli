import { expect, test } from "bun:test";
import { CliError } from "../errors.js";
import { buildRawForm, parseRawJson, rawServiceUrl } from "./raw.js";

test("parses an omitted raw JSON payload as an empty object", () => {
  expect(parseRawJson(undefined)).toEqual({});
  expect(parseRawJson("")).toEqual({});
});

test("parses raw JSON object payloads", () => {
  expect(parseRawJson('{"category":1,"active":true,"skip":null}')).toEqual({
    category: 1,
    active: true,
    skip: null,
  });
});

test("rejects invalid raw JSON payloads", () => {
  expect(() => parseRawJson("[1,2,3]")).toThrow(CliError);
  expect(() => parseRawJson("{bad")).toThrow(CliError);
});

test("builds form data with action and scalar fields", () => {
  const form = buildRawForm("getmeas", {
    action: "ignored",
    category: 1,
    active: true,
    empty: undefined,
    none: null,
  });
  expect(form.toString()).toBe("action=getmeas&category=1&active=true");
});

test("rejects nested raw form fields", () => {
  expect(() => buildRawForm("getmeas", { nested: { value: 1 } })).toThrow(CliError);
});

test("resolves supported raw service URLs", () => {
  expect(rawServiceUrl("measure")).toBe("https://wbsapi.withings.net/measure");
  expect(rawServiceUrl("user")).toBe("https://wbsapi.withings.net/v2/user");
});

test("rejects unknown raw services", () => {
  expect(() => rawServiceUrl("unknown")).toThrow(CliError);
});
