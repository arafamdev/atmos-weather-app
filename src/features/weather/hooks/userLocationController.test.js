import assert from "node:assert/strict";
import test from "node:test";

import { createUserLocationController } from "./userLocationController.js";

const position = { coords: { latitude: 35.6895, longitude: 139.6917 } };
function harness(overrides = {}) {
  const requests = [];
  const locations = [];
  const states = [];
  const controller = createUserLocationController({
    geolocation: { getCurrentPosition: (...args) => requests.push(args) },
    reverseGeocode: async () => ({ name: "Tokyo", country: "Japan", admin1: null }),
    onLocation: (location) => locations.push(location),
    onStatus: (state) => states.push(state),
    ...overrides,
  });
  return { controller, requests, locations, states };
}

test("permission granted starts once automatically and preserves actual GPS coordinates", async () => {
  const h = harness({ permissions: { query: async (descriptor) => {
    assert.deepEqual(descriptor, { name: "geolocation" }); return { state: "granted" };
  } } });
  await h.controller.startIfGranted();
  h.controller.start();
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.requests[0][2], { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  await h.requests[0][0](position);
  assert.equal(h.locations[0].name, "Current location");
  assert.deepEqual(h.locations[1], { ...position.coords, name: "Tokyo", country: "Japan", admin1: null,
    timezone: "auto", source: "geolocation" });
  assert.equal(h.states.at(-1).status, "success");
});

for (const state of ["prompt", "denied"]) {
  test(`${state} permission never requests location until explicit action`, async () => {
    const h = harness({ permissions: { query: async () => ({ state }) } });
    await h.controller.startIfGranted();
    assert.equal(h.requests.length, 0);
    h.controller.start();
    assert.equal(h.requests.length, 1);
  });
}

for (const permissions of [undefined, { query: async () => { throw new TypeError("Unsupported"); } }]) {
  test("missing or unsupported Permissions API preserves explicit geolocation", async () => {
    const h = harness({ permissions });
    await h.controller.startIfGranted();
    assert.equal(h.requests.length, 0);
    h.controller.start();
    await h.requests[0][0](position);
    assert.equal(h.locations.length, 2);
  });
}

test("missing geolocation reports an actionable error without changing location", () => {
  const h = harness({ geolocation: undefined });
  h.controller.start();
  assert.match(h.states.at(-1).message, /not supported/);
  assert.equal(h.locations.length, 0);
});

for (const [code, message] of [[1, /denied/], [2, /unavailable/], [3, /timed out/]]) {
  test(`GPS error ${code} leaves the active location intact and permits retry`, () => {
    const h = harness(); h.controller.start(); h.requests[0][1]({ code });
    assert.match(h.states.at(-1).message, message);
    assert.equal(h.locations.length, 0);
    h.controller.start(); assert.equal(h.requests.length, 2);
  });
}

test("invalid GPS coordinates are rejected without reverse lookup or Porto substitution", async () => {
  const h = harness({ reverseGeocode: () => { throw new Error("Must not run"); } });
  h.controller.start();
  await h.requests[0][0]({ coords: { latitude: NaN, longitude: 190 } });
  assert.equal(h.locations.length, 0);
  assert.match(h.states.at(-1).message, /unavailable/);
});

test("reverse lookup failure retains coordinates with a truthful label and automatic timezone", async () => {
  const h = harness({ reverseGeocode: async () => { throw new Error("Offline"); } });
  h.controller.start(); await h.requests[0][0](position);
  assert.equal(h.locations.length, 1);
  assert.equal(h.locations[0].name, "Current location");
  assert.equal(h.locations[0].latitude, position.coords.latitude);
  assert.equal(h.locations[0].timezone, "auto");
  assert.match(h.states.at(-1).message, /Locality unavailable/);
});

test("manual selection wins over late GPS and late permission queries", async () => {
  const permission = Promise.withResolvers();
  const h = harness({ permissions: { query: () => permission.promise } });
  const auto = h.controller.startIfGranted();
  h.controller.cancel();
  permission.resolve({ state: "granted" }); await auto;
  assert.equal(h.requests.length, 0);
  h.controller.start(); h.controller.cancel(); await h.requests[0][0](position);
  assert.equal(h.locations.length, 0);
});

test("manual selection aborts reverse lookup and ignores an uncancellable late result", async () => {
  const reverse = Promise.withResolvers(); let signal;
  const h = harness({ reverseGeocode: (_, options) => { signal = options.signal; return reverse.promise; } });
  h.controller.start(); const completing = h.requests[0][0](position);
  h.controller.start(); assert.equal(h.requests.length, 1);
  h.controller.cancel(); assert.equal(signal.aborted, true);
  reverse.resolve({ name: "Old result" }); await completing;
  assert.equal(h.locations.length, 1);
  assert.equal(h.locations[0].name, "Current location");
  assert.equal(h.states.at(-1).status, "idle");
});

test("returning to device location works after cancellation and after a completed selection", async () => {
  const h = harness(); h.controller.start(); h.controller.cancel();
  h.controller.start(); await h.requests[1][0](position);
  h.controller.start(); await h.requests[2][0](position);
  await h.requests[2][0](position);
  assert.equal(h.locations.length, 4);
  assert.equal(h.locations.filter(({ name }) => name === "Tokyo").length, 2);
});

test("disposal suppresses every late callback, including errors, with no state updates", async () => {
  const h = harness(); h.controller.start(); h.controller.dispose();
  const stateCount = h.states.length;
  await h.requests[0][0](position); h.requests[0][1]({ code: 1 }); h.controller.start();
  assert.equal(h.locations.length, 0); assert.equal(h.states.length, stateCount);
});

test("StrictMode-style cleanup before permission resolution avoids duplicate GPS requests", async () => {
  const first = harness({ permissions: { query: async () => ({ state: "granted" }) } });
  const pending = first.controller.startIfGranted(); first.controller.dispose(); await pending;
  const second = harness({ permissions: { query: async () => ({ state: "granted" }) } });
  await second.controller.startIfGranted();
  assert.equal(first.requests.length + second.requests.length, 1);
});


test("coordinates publish immediately while a slow locality lookup only enriches identification", async () => {
  const reverse = Promise.withResolvers();
  const h = harness({ reverseGeocode: () => reverse.promise });
  h.controller.start(); const pending = h.requests[0][0](position);
  assert.deepEqual(h.locations, [{ ...position.coords, name: "Current location", timezone: "auto", source: "geolocation" }]);
  assert.equal(h.states.at(-1).status, "resolving");
  reverse.resolve({ name: "Tokyo", country: "Japan", admin1: "Tokyo" }); await pending;
  assert.equal(h.locations.length, 2);
  assert.equal(h.locations[1].name, "Tokyo");
  assert.equal(h.locations[1].latitude, h.locations[0].latitude);
  assert.equal(h.locations[1].longitude, h.locations[0].longitude);
  assert.equal(h.locations[1].timezone, "auto");
});

test("unmount during locality enrichment cannot publish a late name or status", async () => {
  const reverse = Promise.withResolvers();
  const h = harness({ reverseGeocode: () => reverse.promise });
  h.controller.start(); const pending = h.requests[0][0](position);
  h.controller.dispose(); const stateCount = h.states.length;
  reverse.resolve({ name: "Late locality" }); await pending;
  assert.equal(h.locations.length, 1);
  assert.equal(h.locations[0].name, "Current location");
  assert.equal(h.states.length, stateCount);
});
