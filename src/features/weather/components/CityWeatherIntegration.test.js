import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { citySearchReducer, handleCitySearchKeyDown, initialCitySearchState } from "./citySearchHelpers.js";

import { cityWeatherQueryOptions } from "../hooks/useCityWeather.js";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { createWeatherData } from "../testing/weatherFixtures.js";
import { DEFAULT_WEATHER_LOCATION } from "../utils/weatherLocation.js";

let server;
let App;
let AppContent;
let CitySearch;
let WeatherDashboardContent;
const lisbon = { name: "Lisbon", country: "Portugal", latitude: 38.7223,
  longitude: -9.1393, timezone: "Europe/Lisbon" };
const tokyo = { name: "Tokyo", country: "Japan", latitude: 35.6762,
  longitude: 139.6503, timezone: "Asia/Tokyo" };

before(async () => {
  server = await createServer({
    configFile: false, appType: "custom", esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ default: App, AppContent } = await server.ssrLoadModule("/src/App.jsx"));
  ({ default: CitySearch } = await server.ssrLoadModule("/src/features/weather/components/CitySearch.jsx"));
  ({ WeatherDashboardContent } = await server.ssrLoadModule("/src/features/weather/components/WeatherDashboard.jsx"));
});
after(async () => { await server?.close(); });

function responseFor(location = DEFAULT_WEATHER_LOCATION, temperature = 18.5) {
  const data = createWeatherData("2026-11-17", location.timezone === "Asia/Tokyo" ? 32400 : 0);
  data.timezone = location.timezone;
  data.current.temperature_2m = temperature;
  return data;
}

function createClient(context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: Infinity } },
  });
  context.after(() => client.clear());
  return client;
}

function findElement(element, predicate) {
  if (!element || typeof element !== "object") return undefined;
  if (predicate(element)) return element;
  return [element.props?.children].flat(Infinity)
    .map((child) => findElement(child, predicate)).find(Boolean);
}

function createIntegration(client, context) {
  let activeLocation = DEFAULT_WEATHER_LOCATION;
  const observer = new QueryObserver(client, cityWeatherQueryOptions(activeLocation));
  const unsubscribe = observer.subscribe(() => {});
  context.after(unsubscribe);
  const onSelectCity = (city) => {
    activeLocation = city;
    observer.setOptions(cityWeatherQueryOptions(city));
  };
  return {
    observer,
    getLocation: () => activeLocation,
    select(city) {
      const tree = AppContent({ activeLocation, onSelectCity });
      findElement(tree, (element) => element.type === CitySearch).props.onSelectCity(city);
    },
    render() {
      return renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AppContent, { activeLocation, onSelectCity })));
    },
  };
}

test("App initially uses Porto and renders one accessible city search", (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(App)));
  assert.match(html, /Weather in Porto\./);
  assert.match(html, /Porto, Portugal/);
  assert.equal((html.match(/role="combobox"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Demo data/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("selection updates the shared location, hides old weather while loading and reuses Porto cache", async (context) => {
  const client = createClient(context);
  const pending = Promise.withResolvers();
  const fetchMock = context.mock.method(globalThis, "fetch", (url) =>
    new URL(url).searchParams.get("latitude") === String(lisbon.latitude)
      ? pending.promise : Promise.resolve(Response.json(responseFor())),
  );
  const app = createIntegration(client, context);
  await client.fetchQuery(cityWeatherQueryOptions());
  app.select(lisbon);
  assert.equal(app.getLocation(), lisbon);
  const loading = app.render();
  assert.match(loading, /Weather in Lisbon\./);
  assert.match(loading, /Loading weather for Lisbon, Portugal/);
  assert.doesNotMatch(loading, /Porto|aria-label="Current weather"/);
  pending.resolve(Response.json(responseFor(lisbon, 22)));
  await client.fetchQuery(cityWeatherQueryOptions(lisbon));
  assert.match(app.render(), /Lisbon, Portugal/);
  assert.match(app.render(), /aria-label="Current weather"/);
  app.select(DEFAULT_WEATHER_LOCATION);
  assert.match(app.render(), /Weather in Porto\./);
  assert.doesNotMatch(app.render(), /Lisbon, Portugal|Weather in Lisbon/);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("rapid selection cancels an obsolete city and ignores its late response", async (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  let obsoleteSignal;
  let resolveObsolete;
  context.mock.method(globalThis, "fetch", (url, { signal }) => {
    if (new URL(url).searchParams.get("latitude") === String(lisbon.latitude)) {
      obsoleteSignal = signal;
      return new Promise((resolve, reject) => {
        resolveObsolete = resolve;
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    return Promise.resolve(Response.json(responseFor(tokyo, 27)));
  });
  const app = createIntegration(client, context);
  app.select(lisbon);
  app.select(tokyo);
  assert.equal(obsoleteSignal.aborted, true);
  assert.doesNotMatch(app.render(), /Lisbon|Porto/);
  await client.fetchQuery(cityWeatherQueryOptions(tokyo));
  resolveObsolete(Response.json(responseFor(lisbon, 99)));
  assert.match(app.render(), /Weather in Tokyo\./);
  assert.match(app.render(), /Tokyo, Japan/);
  assert.doesNotMatch(app.render(), /Lisbon|>99</);
  assert.equal(client.getQueryData(cityWeatherQueryOptions(lisbon).queryKey), undefined);
});

test("a selected-city HTTP failure offers Retry and recovers that same city", async (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  let response = Promise.resolve(Response.json({ error: true }, { status: 503 }));
  context.mock.method(globalThis, "fetch", () => response);
  const app = createIntegration(client, context);
  app.select(tokyo);
  await assert.rejects(client.fetchQuery(cityWeatherQueryOptions(tokyo)), /HTTP 503/);
  assert.match(app.render(), /couldn&#x27;t load the weather for Tokyo, Japan/);
  assert.doesNotMatch(app.render(), /Porto|aria-label="Current weather"/);
  const pending = Promise.withResolvers();
  response = pending.promise;
  const tree = WeatherDashboardContent({ query: app.observer.getCurrentResult(), location: tokyo });
  findElement(tree, (element) => element.type === "button").props.onClick();
  assert.match(app.render(), /Retrying/);
  pending.resolve(Response.json(responseFor(tokyo, 25)));
  await app.observer.refetch({ cancelRefetch: false });
  assert.match(app.render(), /Tokyo, Japan/);
  assert.match(app.render(), /aria-label="Current weather"/);
  assert.doesNotMatch(app.render(), /Retry|Porto/);
});

test("same-city refetch retains matching weather with a discreet update indicator", async (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  client.setQueryData(cityWeatherQueryOptions(tokyo).queryKey, adaptWeatherData(responseFor(tokyo), tokyo));
  const pending = Promise.withResolvers();
  context.mock.method(globalThis, "fetch", () => pending.promise);
  const app = createIntegration(client, context);
  app.select(tokyo);
  const refreshing = app.observer.refetch();
  const html = app.render();
  assert.match(html, /Updating weather/);
  assert.match(html, /Tokyo, Japan/);
  assert.match(html, /aria-label="Current weather"/);
  assert.doesNotMatch(html, /Porto/);
  pending.resolve(Response.json(responseFor(tokyo, 26)));
  await refreshing;
});

test("a null timezone displays a selection error instead of falling back to Porto", async (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  const fetchMock = context.mock.method(globalThis, "fetch", () => {});
  const app = createIntegration(client, context);
  const invalid = { ...tokyo, country: null, admin1: null, timezone: null };
  app.select(invalid);
  await assert.rejects(client.fetchQuery(cityWeatherQueryOptions(invalid)), /timezone is required/);
  const html = app.render();
  assert.match(html, /Weather in Tokyo\./);
  assert.match(html, /location or timezone is invalid/);
  assert.match(html, /Please choose another city/);
  assert.doesNotMatch(html, /Porto|aria-label="Current weather"|>Retry</);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("missing country and region remain safe in the header and weather panels", async (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  context.mock.method(globalThis, "fetch", async () => Response.json(responseFor(tokyo)));
  const app = createIntegration(client, context);
  const selected = { ...tokyo, country: null, admin1: null };
  app.select(selected);
  await client.fetchQuery(cityWeatherQueryOptions(selected));
  const html = app.render();
  assert.match(html, /Weather in Tokyo\./);
  assert.doesNotMatch(html, /Japan|null|undefined|Porto/);
});


test("clearing search after Enter preserves the selected location and its isolated weather query", async (context) => {
  const client = createClient(context);
  client.setQueryData(cityWeatherQueryOptions().queryKey, adaptWeatherData(responseFor()));
  const pending = Promise.withResolvers();
  const fetchMock = context.mock.method(globalThis, "fetch", () => pending.promise);
  const app = createIntegration(client, context);
  let searchState = { inputValue: "Tokyo", searchTerm: "Tokyo", isOpen: true, activeCityId: 1850147 };
  const suggestion = { ...tokyo, id: 1850147 };
  const onSelectCity = (city) => {
    searchState = citySearchReducer(searchState, { type: "select", city });
    app.select(city);
  };
  handleCitySearchKeyDown({ key: "Enter", preventDefault() {} }, {
    state: searchState, suggestions: [suggestion], dispatch() {}, onSelectCity,
  });
  assert.deepEqual(searchState, initialCitySearchState);
  assert.equal(app.getLocation(), suggestion);
  assert.match(app.render(), /Weather in Tokyo\./);
  assert.doesNotMatch(app.render(), /aria-label="Current weather"|Porto/);
  pending.resolve(Response.json(responseFor(tokyo, 24)));
  await client.fetchQuery(cityWeatherQueryOptions(suggestion));
  assert.match(app.render(), /Tokyo, Japan/);
  assert.match(app.render(), /aria-label="Current weather"/);
  searchState = citySearchReducer(searchState, { type: "input", value: "" });
  assert.equal(searchState.inputValue, "");
  assert.equal(app.getLocation(), suggestion);
  assert.match(app.render(), /Weather in Tokyo\./);
  assert.equal(fetchMock.mock.callCount(), 1);
});
