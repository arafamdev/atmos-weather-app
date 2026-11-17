import assert from "node:assert/strict";
import test from "node:test";

import { searchCities } from "./geocodingService.js";

function createGeocodingData() {
  return {
    results: [{
      id: 2735943,
      name: "Porto",
      latitude: 41.14961,
      longitude: -8.61099,
      timezone: "Europe/Lisbon",
      country_code: "PT",
      country: "Portugal",
      admin1: "Porto",
      population: 249633,
    }],
    generationtime_ms: 0.5,
  };
}

test("trims the query, passes the signal and requests ten English JSON results", async (context) => {
  const payload = createGeocodingData();
  const controller = new AbortController();
  context.mock.method(globalThis, "fetch", async (url, { signal }) => {
    const request = new URL(url);
    assert.equal(request.origin, "https://geocoding-api.open-meteo.com");
    assert.equal(request.pathname, "/v1/search");
    assert.deepEqual(Object.fromEntries(request.searchParams), {
      name: "Porto", count: "10", language: "en", format: "json",
    });
    assert.equal(signal, controller.signal);
    return { ok: true, json: async () => payload };
  });
  assert.equal(await searchCities("  Porto \n", { signal: controller.signal }), payload);
});

test("avoids requests for empty or single-code-point searches", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", () => {
    throw new Error("Short queries must not fetch");
  });
  for (const query of ["", "   ", "\n\t", "A", " Å ", "京", "𠮷"]) {
    assert.deepEqual(await searchCities(query), { results: [] });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("accepts two-character, Unicode, postal-code and qualified searches without rewriting them", async (context) => {
  const queries = ["Eu", "西安", "São Paulo", "L’Haÿ-les-Roses", "St. John's", "1000", "Paris, France", "A & B", "New  York"];
  const requests = [];
  context.mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url).searchParams.get("name"));
    return Response.json({ results: [] });
  });
  for (const query of queries) await searchCities(query);
  assert.deepEqual(requests, queries);
});

test("rejects non-string queries without making requests", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  for (const query of [null, undefined, 123, {}, []]) {
    await assert.rejects(searchCities(query), /query must be a string/);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("preserves no-match responses with omitted or empty results", async (context) => {
  for (const payload of [{ generationtime_ms: 0.2 }, { results: [] }, {}]) {
    context.mock.method(globalThis, "fetch", async () => Response.json(payload));
    assert.deepEqual(await searchCities("NoMatchingLocation"), payload);
  }
});

test("accepts missing optional metadata and zero-valued coordinates", async (context) => {
  const payload = { results: [{ id: 1, name: "Example", latitude: 0, longitude: 0 }] };
  context.mock.method(globalThis, "fetch", async () => Response.json(payload));
  assert.deepEqual(await searchCities("Example"), payload);
});

test("includes HTTP status and API reason in errors", async (context) => {
  for (const status of [400, 429, 500, 503]) {
    context.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: true, reason: "Request rejected" }, { status }),
    );
    await assert.rejects(searchCities("Porto"), new RegExp(`HTTP ${status}.*Request rejected`));
  }
});

test("rejects API errors even on a successful HTTP response", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: true, reason: "Invalid parameter" }),
  );
  await assert.rejects(searchCities("Porto"), /HTTP 200.*Invalid parameter/);
});

test("handles HTTP failures without a reason or JSON body", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 404 }));
  await assert.rejects(searchCities("Porto"), /HTTP 404/);
  context.mock.method(globalThis, "fetch", async () => new Response("Bad gateway", { status: 502 }));
  await assert.rejects(searchCities("Porto"), /HTTP 502/);
});

test("wraps network failures with the original cause", async (context) => {
  const cause = new TypeError("Network failure");
  context.mock.method(globalThis, "fetch", async () => { throw cause; });
  await assert.rejects(searchCities("Porto"), (error) =>
    error.cause === cause && /Check your connection/.test(error.message),
  );
});

test("rejects invalid JSON with its original parsing cause", async (context) => {
  const cause = new SyntaxError("Invalid JSON");
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => { throw cause; },
  }));
  await assert.rejects(searchCities("Porto"), (error) =>
    error.cause === cause && /invalid JSON/.test(error.message),
  );
});

test("rejects unexpected envelopes and invalid core location fields", async (context) => {
  const invalidCities = [
    null, [], {},
    { id: "1", name: "Porto", latitude: 41, longitude: -8 },
    { id: 1, name: " ", latitude: 41, longitude: -8 },
    { id: 1, name: "Porto", latitude: null, longitude: -8 },
    { id: 1, name: "Porto", latitude: 91, longitude: -8 },
    { id: 1, name: "Porto", latitude: 41, longitude: 181 },
  ];
  const payloads = [null, [], "invalid", 1, { results: null }, { results: {} },
    ...invalidCities.map((city) => ({ results: [city] }))];
  for (const payload of payloads) {
    context.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(searchCities("Porto"), /unexpected geocoding data structure/);
  }
});

test("preserves an already-aborted signal without fetching", async (context) => {
  const controller = new AbortController();
  const reason = new Error("Search cancelled");
  controller.abort(reason);
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  for (const query of ["Porto", ""]) {
    await assert.rejects(searchCities(query, { signal: controller.signal }), (error) => error === reason);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("aborts an in-flight fetch without wrapping the cancellation reason", async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const request = searchCities("Porto", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (error) => error === controller.signal.reason);
});

test("preserves cancellation while reading the response body", async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => {
      controller.abort(new Error("Body reading cancelled"));
      throw controller.signal.reason;
    },
  }));
  await assert.rejects(
    searchCities("Porto", { signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
});

test("preserves AbortError even when no external signal was supplied", async (context) => {
  const cause = new DOMException("Aborted", "AbortError");
  context.mock.method(globalThis, "fetch", async () => { throw cause; });
  await assert.rejects(searchCities("Porto"), (error) => error === cause);
});
