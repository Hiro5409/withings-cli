import { expect, test } from "bun:test";
import { parseNotificationPayload } from "./notify.js";

test("parses Withings notification payloads from URLSearchParams", () => {
  const notification = parseNotificationPayload(
    new URLSearchParams({
      userid: "123",
      appli: "1",
      startdate: "1781280000",
      enddate: "1781283600",
      unknown: "kept",
      deviceid: "scale-1",
    }),
  );

  expect(notification).toEqual({
    userid: 123,
    appli: 1,
    startdate: 1_781_280_000,
    enddate: 1_781_283_600,
    deviceid: "scale-1",
    mac: undefined,
    action: undefined,
    date: undefined,
    fields: {
      userid: "123",
      appli: "1",
      startdate: "1781280000",
      enddate: "1781283600",
      unknown: "kept",
      deviceid: "scale-1",
    },
  });
});

test("parses Withings notification payloads from FormData", () => {
  const form = new FormData();
  form.set("userid", "123");
  form.set("appli", "16");
  form.set("date", "2026-06-13");

  expect(parseNotificationPayload(form)).toEqual({
    userid: 123,
    appli: 16,
    date: "2026-06-13",
    startdate: undefined,
    enddate: undefined,
    deviceid: undefined,
    mac: undefined,
    action: undefined,
    fields: {
      userid: "123",
      appli: "16",
      date: "2026-06-13",
    },
  });
});

test("parses event notification payloads from form-encoded fields", () => {
  expect(
    parseNotificationPayload(
      new URLSearchParams({
        userid: "123",
        appli: "50",
        date: "1530576000",
        deviceid: "abc123",
      }),
    ),
  ).toEqual({
    userid: 123,
    appli: 50,
    date: 1_530_576_000,
    startdate: undefined,
    enddate: undefined,
    deviceid: "abc123",
    mac: undefined,
    action: undefined,
    fields: {
      userid: "123",
      appli: "50",
      date: "1530576000",
      deviceid: "abc123",
    },
  });

  expect(
    parseNotificationPayload(
      new URLSearchParams({
        userid: "123",
        appli: "46",
        action: "update",
      }),
    ),
  ).toEqual({
    userid: 123,
    appli: 46,
    date: undefined,
    startdate: undefined,
    enddate: undefined,
    deviceid: undefined,
    mac: undefined,
    action: "update",
    fields: {
      userid: "123",
      appli: "46",
      action: "update",
    },
  });

  expect(
    parseNotificationPayload(new URLSearchParams({ appli: "53", mac: "aa:bb:cc:dd:ee:ff" })),
  ).toEqual({
    userid: undefined,
    appli: 53,
    date: undefined,
    startdate: undefined,
    enddate: undefined,
    deviceid: undefined,
    mac: "aa:bb:cc:dd:ee:ff",
    action: undefined,
    fields: {
      appli: "53",
      mac: "aa:bb:cc:dd:ee:ff",
    },
  });
});

test("parses Withings notification payloads from scalar records", () => {
  expect(
    parseNotificationPayload({
      appli: 53,
      mac: "aa:bb:cc:dd:ee:ff",
      nested: { ignored: true },
    }),
  ).toEqual({
    appli: 53,
    userid: undefined,
    date: undefined,
    startdate: undefined,
    enddate: undefined,
    deviceid: undefined,
    mac: "aa:bb:cc:dd:ee:ff",
    action: undefined,
    fields: {
      appli: "53",
      mac: "aa:bb:cc:dd:ee:ff",
    },
  });
});

test("rejects invalid Withings notification payloads", () => {
  expect(() => parseNotificationPayload(null)).toThrow(/appli must be an integer/);
  expect(() => parseNotificationPayload(new URLSearchParams({ userid: "123" }))).toThrow(
    /appli must be an integer/,
  );
  expect(() =>
    parseNotificationPayload(new URLSearchParams({ userid: "abc", appli: "1" })),
  ).toThrow(/userid must be an integer/);
  expect(() =>
    parseNotificationPayload(new URLSearchParams({ userid: "123", appli: "weight" })),
  ).toThrow(/appli must be an integer/);
  expect(() =>
    parseNotificationPayload(
      new URLSearchParams({ userid: "123", appli: "1", startdate: "yesterday" }),
    ),
  ).toThrow(/startdate must be an integer/);
  expect(
    parseNotificationPayload(new URLSearchParams({ userid: "123", appli: "1", startdate: "" }))
      .startdate,
  ).toBeUndefined();
  expect(() =>
    parseNotificationPayload(new URLSearchParams({ userid: "123", appli: "1", date: "soon" })),
  ).toThrow(/date must be YYYY-MM-DD or unix time/);
  expect(() =>
    parseNotificationPayload(
      new URLSearchParams({ userid: "123", appli: "1", date: "2026-99-99" }),
    ),
  ).toThrow(/date must be YYYY-MM-DD or unix time/);
});
