import assert from "node:assert/strict";
import test from "node:test";

import { fetchWeather } from "./weatherService.js";
import { createUnixWeatherData, createWeatherData } from "../testing/weatherFixtures.js";
import { DEFAULT_WEATHER_LOCATION } from "../utils/weatherLocation.js";

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
      hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
      timeformat: "unixtime",
    };
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(request.searchParams.get(key), value);
    }
    assert.equal(signal, controller.signal);
    return Response.json(payload);
  });
  assert.deepEqual(await fetchWeather(undefined, { signal: controller.signal }), payload);
});

test("preserves API reasons for HTTP errors and API error payloads", async (context) => {
  for (const status of [200, 400, 429, 503]) {
    context.mock.method(globalThis, "fetch", async () =>
      Response.json({ error: true, reason: "Request rejected" }, { status }),
    );
    await assert.rejects(fetchWeather(), new RegExp(`HTTP ${status}.*Request rejected`));
  }
});

test("reports non-JSON HTTP errors and invalid successful JSON", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("Bad gateway", { status: 502 }));
  await assert.rejects(fetchWeather(), /HTTP 502/);
  context.mock.method(globalThis, "fetch", async () => new Response("Invalid JSON"));
  await assert.rejects(fetchWeather(), /invalid JSON/);
});

test("wraps network failures while retaining their cause", async (context) => {
  const cause = new TypeError("Network unavailable");
  context.mock.method(globalThis, "fetch", async () => { throw cause; });
  await assert.rejects(fetchWeather(), (error) =>
    error.cause === cause && /Unable to reach Open-Meteo/.test(error.message),
  );
});

test("preserves cancellation before response headers and during body reading", async (context) => {
  const controller = new AbortController();
  controller.abort();
  context.mock.method(globalThis, "fetch", async () => { throw controller.signal.reason; });
  await assert.rejects(
    fetchWeather(undefined, { signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => { throw controller.signal.reason; },
  }));
  await assert.rejects(
    fetchWeather(undefined, { signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
});

test("rejects missing or misaligned weather sections", async (context) => {
  const misaligned = createWeatherData();
  misaligned.daily.temperature_2m_max.pop();
  for (const payload of [null, {}, misaligned]) {
    context.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(fetchWeather(), /unexpected weather data structure/);
  }
});

test("requests different cities using validated coordinates and their own timezone", async (context) => {
  const locations = [
    { latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
    { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
    { latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
    { latitude: 22.5726, longitude: 88.3639, timezone: "Asia/Kolkata" },
    { latitude: 0, longitude: 0, timezone: "UTC" },
  ];
  const controller = new AbortController();
  for (const location of locations) {
    const payload = { ...createWeatherData(), timezone: location.timezone };
    context.mock.method(globalThis, "fetch", async (url, { signal }) => {
      const parameters = new URL(url).searchParams;
      assert.equal(parameters.get("latitude"), String(location.latitude));
      assert.equal(parameters.get("longitude"), String(location.longitude));
      assert.equal(parameters.get("timezone"), new Intl.DateTimeFormat("en", {
        timeZone: location.timezone,
      }).resolvedOptions().timeZone);
      assert.equal(parameters.get("past_days"), "1");
      assert.equal(parameters.get("forecast_days"), "5");
      assert.equal(signal, controller.signal);
      return Response.json(payload);
    });
    assert.deepEqual(await fetchWeather(location, { signal: controller.signal }), payload);
  }
});

test("fetchWeather defaults to the same request as an explicit Porto location", async (context) => {
  const requests = [];
  context.mock.method(globalThis, "fetch", async (url) => {
    requests.push(url);
    return Response.json(createWeatherData());
  });
  assert.deepEqual(await fetchWeather(), await fetchWeather(DEFAULT_WEATHER_LOCATION));
  assert.equal(requests[0], requests[1]);
});

test("rejects invalid coordinates or absent timezones without contacting the API", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  const valid = { latitude: 48.85, longitude: 2.35, timezone: "Europe/Paris" };
  for (const invalid of [
    { latitude: null }, { latitude: "48.85" }, { latitude: NaN }, { latitude: 91 },
    { longitude: -181 }, { longitude: Infinity }, { longitude: undefined },
    { timezone: null }, { timezone: undefined }, { timezone: "" },
    { timezone: "Invalid/Timezone" }, { timezone: "+01:00" },
  ]) {
    await assert.rejects(fetchWeather({ ...valid, ...invalid }), /Invalid weather location/);
  }
  await assert.rejects(fetchWeather({ ...valid, timezone: null }), /timezone is required and cannot be null/);
  await assert.rejects(fetchWeather(null), /location must be an object/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("generalized requests preserve cancellation during fetch and body reading", async (context) => {
  const location = { latitude: 35.67, longitude: 139.65, timezone: "Asia/Tokyo" };
  const controller = new AbortController();
  context.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const request = fetchWeather(location, { signal: controller.signal });
  controller.abort(new Error("Location changed"));
  await assert.rejects(request, (error) => error === controller.signal.reason);

  const bodyController = new AbortController();
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => {
      bodyController.abort(new Error("Body reading cancelled"));
      throw bodyController.signal.reason;
    },
  }));
  await assert.rejects(fetchWeather(location, { signal: bodyController.signal }),
    (error) => error === bodyController.signal.reason);
});


test("accepts the requested Unix response unchanged, including aligned hourly fields", async (context) => {
  const payload = createUnixWeatherData();
  context.mock.method(globalThis, "fetch", async () => Response.json(payload));
  const result = await fetchWeather();
  assert.deepEqual(result, payload);
  assert.equal(typeof result.current.time, "number");
  assert.equal(result.hourly.temperature_2m.length, result.hourly.time.length);
});

test("optional solar fields do not require extra requests or block weather when absent", async (context) => {
  const payload = createUnixWeatherData();
  delete payload.daily.sunrise;
  payload.daily.sunset = null;
  const fetchMock = context.mock.method(globalThis, "fetch", async (url) => {
    const daily = new URL(url).searchParams.get("daily").split(",");
    assert.ok(daily.includes("sunrise"));
    assert.ok(daily.includes("sunset"));
    return Response.json(payload);
  });
  assert.deepEqual(await fetchWeather(), payload);
  assert.equal(fetchMock.mock.callCount(), 1);
});
