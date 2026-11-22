import assert from "node:assert/strict";
import test from "node:test";

import { reverseGeocodePosition } from "./reverseGeocodingService.js";

const coordinates = { latitude: 35.6895, longitude: 139.6917 };
const result = { lookupSource: "coordinates", city: "Tokyo", countryName: "Japan", principalSubdivision: "Tokyo" };

test("reverse geocoding sends consented coordinates without credentials or referrer and returns only locality", async (context) => {
  context.mock.method(globalThis, "fetch", async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, "https://api.bigdatacloud.net");
    assert.equal(request.searchParams.get("latitude"), String(coordinates.latitude));
    assert.equal(request.searchParams.get("longitude"), String(coordinates.longitude));
    assert.equal(request.searchParams.get("localityLanguage"), "en");
    assert.equal(options.credentials, "omit"); assert.equal(options.referrerPolicy, "no-referrer");
    return Response.json({ ...result, latitude: 0, longitude: 0 });
  });
  assert.deepEqual(await reverseGeocodePosition(coordinates), { name: "Tokyo", country: "Japan", admin1: "Tokyo" });
});

test("missing city uses locality without inventing optional fields", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ lookupSource: "reverseGeocoding", locality: "Village" }));
  assert.deepEqual(await reverseGeocodePosition(coordinates), { name: "Village", country: null, admin1: null });
});

for (const payload of [null, [], {}, { ...result, lookupSource: "ipGeolocation" }, { ...result, city: "" }]) {
  test("malformed, IP-derived or nameless results are rejected", async (context) => {
    context.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(reverseGeocodePosition(coordinates), /Unable to identify/);
  });
}

for (const response of [() => Promise.reject(new TypeError("Offline")),
  () => Promise.resolve(new Response("bad", { status: 500 })),
  () => Promise.resolve(new Response("invalid JSON"))]) {
  test("network, HTTP and invalid JSON failures use a non-sensitive error", async (context) => {
    context.mock.method(globalThis, "fetch", response);
    await assert.rejects(reverseGeocodePosition(coordinates), /Unable to identify/);
  });
}

test("cancellation preserves its reason and aborts the fetch", async (context) => {
  let requestSignal;
  context.mock.method(globalThis, "fetch", (_, { signal }) => new Promise((_, reject) => {
    requestSignal = signal; signal.addEventListener("abort", () => reject(signal.reason));
  }));
  const controller = new AbortController();
  const pending = reverseGeocodePosition(coordinates, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requestSignal.aborted, true);
});

test("lookup timeout aborts a stalled network request", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(globalThis, "fetch", (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason));
  }));
  const pending = reverseGeocodePosition(coordinates);
  context.mock.timers.tick(5000);
  await assert.rejects(pending, /Unable to identify/);
});

test("invalid or pre-aborted coordinates never trigger a request", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", () => {});
  await assert.rejects(reverseGeocodePosition({ latitude: 91, longitude: 0 }));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(reverseGeocodePosition(coordinates, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), 0);
});
