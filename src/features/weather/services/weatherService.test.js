import assert from "node:assert/strict";
import test from "node:test";

import { fetchPortoWeather } from "./weatherService.js";
import { createWeatherData } from "../testing/weatherFixtures.js";

test("requests Porto with explicit units, timezone and DST-safe coverage", async (context) => {
  const payload = createWeatherData();
  const controller = new AbortController();
  context.mock.method(globalThis, "fetch", async (url, { signal }) => {
    const request = new URL(url);
    assert.equal(request.origin, "https://api.open-meteo.com");
    assert.equal(request.pathname, "/v1/forecast");
    const expected = {
      latitude: "41.1496",
      longitude: "-8.6109",
      timezone: "Europe/Lisbon",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      past_days: "1",
      forecast_days: "5",
      hourly: "precipitation_probability",
    };
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(request.searchParams.get(key), value);
    }
    assert.equal(signal, controller.signal);
    return Response.json(payload);
  });
  assert.deepEqual(await fetchPortoWeather({ signal: controller.signal }), payload);
});

test("preserves API reasons for HTTP errors and API error payloads", async (context) => {
  for (const status of [200, 400, 429, 503]) {
    context.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: true, reason: "Request rejected" }, { status }),
    );
    await assert.rejects(fetchPortoWeather(), new RegExp(`HTTP ${status}.*Request rejected`));
  }
});

test("reports non-JSON HTTP errors and invalid successful JSON", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("Bad gateway", { status: 502 }));
  await assert.rejects(fetchPortoWeather(), /HTTP 502/);
  context.mock.method(globalThis, "fetch", async () => new Response("Invalid JSON"));
  await assert.rejects(fetchPortoWeather(), /invalid JSON/);
});

test("wraps network failures while retaining their cause", async (context) => {
  const cause = new TypeError("Network unavailable");
  context.mock.method(globalThis, "fetch", async () => { throw cause; });
  await assert.rejects(fetchPortoWeather(), (error) =>
    error.cause === cause && /Unable to reach Open-Meteo/.test(error.message),
  );
});

test("preserves cancellation before response headers and during body reading", async (context) => {
  const controller = new AbortController();
  controller.abort();
  context.mock.method(globalThis, "fetch", async () => { throw controller.signal.reason; });
  await assert.rejects(
    fetchPortoWeather({ signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => { throw controller.signal.reason; },
  }));
  await assert.rejects(
    fetchPortoWeather({ signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
});

test("rejects missing or misaligned weather sections", async (context) => {
  const misaligned = createWeatherData();
  misaligned.daily.sunrise.pop();
  for (const payload of [null, {}, misaligned]) {
    context.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(fetchPortoWeather(), /unexpected weather data structure/);
  }
});
