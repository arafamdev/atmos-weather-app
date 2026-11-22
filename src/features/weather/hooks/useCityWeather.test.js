import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { cityWeatherQueryOptions, useCityWeather } from "./useCityWeather.js";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { createUnixWeatherData, createWeatherData } from "../testing/weatherFixtures.js";
import { DEFAULT_WEATHER_LOCATION } from "../utils/weatherLocation.js";

const paris = Object.freeze({
  name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522,
  timezone: "Europe/Paris",
});
const tokyo = Object.freeze({
  name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503,
  timezone: "Asia/Tokyo",
});

function createResponse(location = DEFAULT_WEATHER_LOCATION) {
  const offset = { "Europe/Lisbon": 0, "Europe/Paris": 3600, "Asia/Tokyo": 32400 }[location.timezone];
  return { ...createWeatherData("2026-11-17", offset), timezone: location.timezone };
}

function createTestClient(context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  context.after(() => client.clear());
  return client;
}

function observeWeather(client, location, context) {
  const observer = new QueryObserver(client, cityWeatherQueryOptions(location));
  const unsubscribe = observer.subscribe(() => {});
  context.after(unsubscribe);
  return observer;
}

test("uses stable keys covering coordinates, timezone and the cached display label", () => {
  const options = cityWeatherQueryOptions(paris);
  assert.deepEqual(options.queryKey, ["weather", "location", {
    latitude: paris.latitude, longitude: paris.longitude,
    timezone: paris.timezone, label: "Paris, France",
  }]);
  assert.deepEqual(options.queryKey, cityWeatherQueryOptions({ ...paris }).queryKey);
  assert.equal(options.staleTime, 300000);
  assert.notDeepEqual(options.queryKey, cityWeatherQueryOptions({ ...paris, latitude: 48.9 }).queryKey);
  assert.notDeepEqual(options.queryKey, cityWeatherQueryOptions({ ...paris, timezone: "UTC" }).queryKey);
  assert.notDeepEqual(options.queryKey, cityWeatherQueryOptions({ ...paris, admin1: "Île-de-France" }).queryKey);
});

test("normalizes equivalent timezone aliases into the same key", () => {
  const alias = { ...DEFAULT_WEATHER_LOCATION, timezone: " Portugal " };
  assert.deepEqual(cityWeatherQueryOptions(alias).queryKey, cityWeatherQueryOptions().queryKey);
});

test("passes the signal and exposes native loading and adapted success", async (context) => {
  const client = createTestClient(context);
  const response = createResponse(paris);
  context.mock.method(globalThis, "fetch", async (url, { signal }) => {
    assert.equal(new URL(url).searchParams.get("latitude"), String(paris.latitude));
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, false);
    return Response.json(response);
  });
  const observer = observeWeather(client, paris, context);
  assert.equal(observer.getCurrentResult().isLoading, true);
  const data = await client.fetchQuery(cityWeatherQueryOptions(paris));
  assert.deepEqual(data, adaptWeatherData(response, paris));
  assert.equal(data.currentWeather.location, "Paris, France");
  assert.equal(observer.getCurrentResult().isSuccess, true);
  assert.equal(observer.getCurrentResult().isFetching, false);
});

test("equivalent location objects share fresh cache and concurrent requests", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", async () => Response.json(createResponse(paris)));
  const [first, second] = await Promise.all([
    client.fetchQuery(cityWeatherQueryOptions(paris)),
    client.fetchQuery(cityWeatherQueryOptions({ ...paris })),
  ]);
  assert.equal(first, second);
  assert.equal(await client.fetchQuery(cityWeatherQueryOptions(paris)), first);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("different cities have separate cache without previous-city placeholders", async (context) => {
  const client = createTestClient(context);
  let response = Promise.resolve(Response.json(createResponse(paris)));
  const fetchMock = context.mock.method(globalThis, "fetch", () => response);
  const observer = observeWeather(client, paris, context);
  const parisData = await client.fetchQuery(cityWeatherQueryOptions(paris));
  const pending = Promise.withResolvers();
  response = pending.promise;
  observer.setOptions(cityWeatherQueryOptions(tokyo));
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(observer.getCurrentResult().isLoading, true);
  assert.equal(observer.getCurrentResult().isPlaceholderData, false);
  pending.resolve(Response.json(createResponse(tokyo)));
  const tokyoData = await client.fetchQuery(cityWeatherQueryOptions(tokyo));
  assert.equal(tokyoData.location, "Tokyo, Japan");
  assert.equal(client.getQueryData(cityWeatherQueryOptions(paris).queryKey), parisData);
  observer.setOptions(cityWeatherQueryOptions(paris));
  assert.equal(observer.getCurrentResult().data, parisData);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("invalid locations become native errors without HTTP calls or a Porto fallback", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  for (const location of [null, {}, { ...paris, timezone: null }, { ...paris, latitude: "48" },
    { ...paris, longitude: 181 }, { ...paris, timezone: "Unknown/Zone" }]) {
    const options = cityWeatherQueryOptions(location);
    assert.equal(options.retry, false);
    const observer = observeWeather(client, location, context);
    await assert.rejects(client.fetchQuery(options), /Invalid weather location/);
    assert.equal(observer.getCurrentResult().isError, true);
    assert.equal(observer.getCurrentResult().data, undefined);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("service and adapter failures keep the native error state", async (context) => {
  const client = createTestClient(context);
  context.mock.method(globalThis, "fetch", async () => Response.json({ error: true }, { status: 503 }));
  const observer = observeWeather(client, paris, context);
  await assert.rejects(client.fetchQuery(cityWeatherQueryOptions(paris)), /HTTP 503/);
  assert.equal(observer.getCurrentResult().isError, true);
  const payload = createResponse(paris);
  payload.current.relative_humidity_2m = 101;
  context.mock.method(globalThis, "fetch", async () => Response.json(payload));
  await assert.rejects(client.fetchQuery(cityWeatherQueryOptions(paris)), /relative_humidity_2m/);
  assert.equal(observer.getCurrentResult().isError, true);
  assert.equal(client.getQueryData(cityWeatherQueryOptions(paris).queryKey), undefined);
});

test("switching locations aborts the obsolete request", async (context) => {
  const client = createTestClient(context);
  let oldSignal;
  context.mock.method(globalThis, "fetch", (url, { signal }) => {
    if (new URL(url).searchParams.get("latitude") === String(paris.latitude)) {
      oldSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    return Promise.resolve(Response.json(createResponse(tokyo)));
  });
  const observer = observeWeather(client, paris, context);
  observer.setOptions(cityWeatherQueryOptions(tokyo));
  assert.equal(oldSignal.aborted, true);
  const data = await client.fetchQuery(cityWeatherQueryOptions(tokyo));
  assert.equal(data.location, "Tokyo, Japan");
  assert.equal(client.getQueryData(cityWeatherQueryOptions(paris).queryKey), undefined);
});

test("a same-city background refetch retains data even if the refresh fails", async (context) => {
  const client = createTestClient(context);
  const previous = adaptWeatherData(createResponse(paris), paris);
  client.setQueryData(cityWeatherQueryOptions(paris).queryKey, previous);
  const pending = Promise.withResolvers();
  context.mock.method(globalThis, "fetch", () => pending.promise);
  const observer = observeWeather(client, paris, context);
  const refetch = observer.refetch();
  assert.equal(observer.getCurrentResult().isFetching, true);
  assert.equal(observer.getCurrentResult().isLoading, false);
  assert.equal(observer.getCurrentResult().data, previous);
  pending.resolve(Response.json({ error: true }, { status: 503 }));
  await refetch;
  assert.equal(observer.getCurrentResult().isRefetchError, true);
  assert.equal(observer.getCurrentResult().data, previous);
});

test("implicit and explicit Porto options share a single cache entry", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", async () => Response.json(createResponse()));
  assert.deepEqual(cityWeatherQueryOptions(DEFAULT_WEATHER_LOCATION).queryKey, cityWeatherQueryOptions().queryKey);
  const first = await client.fetchQuery(cityWeatherQueryOptions(DEFAULT_WEATHER_LOCATION));
  assert.equal(await client.fetchQuery(cityWeatherQueryOptions()), first);
  assert.equal(first.location, "Porto, Portugal");
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("implicit and explicit Porto hooks return native success from their shared cache", (context) => {
  const client = createTestClient(context);
  const data = adaptWeatherData(createResponse());
  client.setQueryData(cityWeatherQueryOptions().queryKey, data);
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  function HookConsumer() {
    const current = useCityWeather();
    const explicit = useCityWeather(DEFAULT_WEATHER_LOCATION);
    assert.equal(current.data, explicit.data);
    return createElement("output", null, `${current.status}:${current.data.location}`);
  }
  const html = renderToString(createElement(QueryClientProvider, { client }, createElement(HookConsumer)));
  assert.match(html, /success:Porto, Portugal/);
  assert.equal(fetchMock.mock.callCount(), 0);
});


test("Unix hourly forecasts follow city cache isolation without extra queries", async (context) => {
  const client = createTestClient(context);
  const pending = Promise.withResolvers();
  const porto = createUnixWeatherData();
  porto.hourly.temperature_2m.fill(18);
  const tokyoData = createUnixWeatherData("2026-11-17", 32400);
  tokyoData.timezone = "Asia/Tokyo";
  tokyoData.hourly.temperature_2m.fill(9);
  const fetchMock = context.mock.method(globalThis, "fetch", (url) =>
    new URL(url).searchParams.get("timezone") === "Asia/Tokyo"
      ? pending.promise : Promise.resolve(Response.json(porto)),
  );
  const observer = observeWeather(client, DEFAULT_WEATHER_LOCATION, context);
  const first = await client.fetchQuery(cityWeatherQueryOptions());
  assert.equal(first.hourlyForecast.forecasts[0].temperature, 18);
  observer.setOptions(cityWeatherQueryOptions(tokyo));
  assert.equal(observer.getCurrentResult().data, undefined);
  pending.resolve(Response.json(tokyoData));
  const second = await client.fetchQuery(cityWeatherQueryOptions(tokyo));
  assert.equal(second.hourlyForecast.forecasts[0].temperature, 9);
  assert.equal(first.hourlyForecast.solarEvents[0].timestamp, porto.daily.sunrise[0]);
  assert.equal(second.hourlyForecast.solarEvents[0].timestamp, tokyoData.daily.sunrise[0]);
  assert.notEqual(first.hourlyForecast.solarEvents[0].timestamp, second.hourlyForecast.solarEvents[0].timestamp);
  assert.equal(second.hourlyForecast.forecasts[0].time, "00:00");
  observer.setOptions(cityWeatherQueryOptions());
  assert.equal(observer.getCurrentResult().data, first);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("GPS coordinates use automatic timezone resolution and adapt the returned IANA zone", async (context) => {
  const client = createTestClient(context);
  const location = { name: "Current location", latitude: tokyo.latitude, longitude: tokyo.longitude,
    timezone: "auto", source: "geolocation" };
  context.mock.method(globalThis, "fetch", async (url) => {
    const parameters = new URL(url).searchParams;
    assert.equal(parameters.get("latitude"), String(location.latitude));
    assert.equal(parameters.get("longitude"), String(location.longitude));
    assert.equal(parameters.get("timezone"), "auto");
    return Response.json(createResponse(tokyo));
  });
  const data = await client.fetchQuery(cityWeatherQueryOptions(location));
  assert.equal(data.timezone, "Asia/Tokyo");
  assert.notDeepEqual(cityWeatherQueryOptions(location).queryKey, cityWeatherQueryOptions().queryKey);
});

test("automatic timezone is restricted to GPS and must resolve to a valid IANA response", async (context) => {
  const client = createTestClient(context);
  const location = { name: "Current location", latitude: tokyo.latitude, longitude: tokyo.longitude, timezone: "auto" };
  await assert.rejects(client.fetchQuery(cityWeatherQueryOptions(location)), /timezone/);
  context.mock.method(globalThis, "fetch", async () => Response.json({ ...createResponse(tokyo), timezone: "Invalid/Zone" }));
  await assert.rejects(client.fetchQuery(cityWeatherQueryOptions({ ...location, source: "geolocation" })), /timezone/);
});

test("GPS locality enrichment reuses a pending forecast and relabels cached results without refetch", async (context) => {
  const client = createTestClient(context);
  const location = { name: "Current location", latitude: tokyo.latitude, longitude: tokyo.longitude,
    timezone: "auto", source: "geolocation" };
  const namedLocation = { ...location, name: "Tokyo", country: "Japan" };
  const pending = Promise.withResolvers(); let signal;
  const fetchMock = context.mock.method(globalThis, "fetch", (_, options) => {
    signal = options.signal; return pending.promise;
  });
  const observer = observeWeather(client, location, context);
  observer.setOptions(cityWeatherQueryOptions(namedLocation));
  assert.deepEqual(cityWeatherQueryOptions(location).queryKey, cityWeatherQueryOptions(namedLocation).queryKey);
  assert.equal(signal.aborted, false);
  assert.equal(fetchMock.mock.callCount(), 1);
  pending.resolve(Response.json(createResponse(tokyo)));
  const cached = await client.fetchQuery(cityWeatherQueryOptions(location));
  assert.equal(cached.location, "Current location");
  assert.equal(observer.getCurrentResult().data.location, "Tokyo, Japan");
  assert.equal(observer.getCurrentResult().data.currentWeather.location, "Tokyo, Japan");
  observer.setOptions(cityWeatherQueryOptions({ ...namedLocation, admin1: "Tokyo Prefecture" }));
  assert.equal(observer.getCurrentResult().data.location, "Tokyo, Tokyo Prefecture, Japan");
  assert.equal(observer.getCurrentResult().data.dailyForecast, cached.dailyForecast);
  assert.equal(fetchMock.mock.callCount(), 1);
});
