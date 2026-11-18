import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { cityWeatherQueryOptions } from "../hooks/useCityWeather.js";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { createWeatherData } from "../testing/weatherFixtures.js";

let server;
let WeatherDashboardContent;

before(async () => {
  server = await createServer({
    configFile: false,
    appType: "custom",
    esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ WeatherDashboardContent } = await server.ssrLoadModule(
    "/src/features/weather/components/WeatherDashboard.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function createQuery(overrides = {}) {
  return {
    data: undefined,
    isError: false,
    isFetching: true,
    isPaused: false,
    refetch: async () => ({}),
    ...overrides,
  };
}

function renderDashboard(query) {
  return renderToStaticMarkup(createElement(WeatherDashboardContent, { query }));
}

function findRetryButton(element) {
  if (!element || typeof element !== "object") return undefined;
  if (element.type === "button") return element;
  const children = [element.props?.children].flat(Infinity);
  return children.map(findRetryButton).find(Boolean);
}

test("announces initial loading without displaying fabricated weather", () => {
  const html = renderDashboard(createQuery());
  assert.match(html, /role="status"/);
  assert.match(html, /Loading weather for Porto/);
  assert.doesNotMatch(html, /aria-label="Current weather"|Demo data|Retry/);
});

test("announces a paused request instead of claiming an active update", () => {
  const html = renderDashboard(createQuery({ isFetching: false, isPaused: true }));
  assert.match(html, /Waiting for a connection/);
  assert.doesNotMatch(html, /Updating weather|Loading weather/);
});

test("shows an accessible initial error and a working Retry handler", (context) => {
  const refetch = context.mock.fn(async () => ({}));
  const query = createQuery({ isError: true, isFetching: false, refetch });
  const html = renderDashboard(query);
  assert.match(html, /role="alert"/);
  assert.match(html, /couldn&#x27;t load the weather for Porto/);
  assert.match(html, />Retry<\/button>/);
  assert.doesNotMatch(html, /aria-label="Current weather"|Demo data/);
  const retryButton = findRetryButton(WeatherDashboardContent({ query }));
  assert.equal(retryButton.props.type, "button");
  assert.equal(retryButton.props["aria-disabled"], false);
  retryButton.props.onClick();
  assert.equal(refetch.mock.callCount(), 1);
});

test("renders all three sections using adapted data without demo labels", () => {
  const data = adaptWeatherData(createWeatherData());
  const html = renderDashboard(createQuery({ data, isFetching: false }));
  assert.match(html, /aria-label="Current weather"/);
  assert.match(html, /18\.5/);
  assert.match(html, /Wednesday|Thursday/);
  assert.match(html, /Daily forecast/);
  assert.match(html, /Rain probability/);
  assert.match(html, /https:\/\/open-meteo.com\//);
  assert.doesNotMatch(html, /Demo data|Loading weather|Updating weather|Retry/);
});

test("keeps weather visible while announcing a background update", () => {
  const data = adaptWeatherData(createWeatherData());
  const html = renderDashboard(createQuery({ data }));
  assert.match(html, /Updating weather/);
  assert.match(html, /aria-label="Current weather"/);
  assert.match(html, /18\.5/);
  assert.doesNotMatch(html, /Loading weather/);
});

test("retains previous weather after a failed refresh and disables Retry during retry", () => {
  const data = adaptWeatherData(createWeatherData());
  const query = createQuery({ data, isError: true, isFetching: false });
  const html = renderDashboard(query);
  assert.match(html, /Showing the last available data/);
  assert.match(html, /aria-label="Current weather"/);
  assert.match(html, /18\.5/);

  const retrying = createQuery({ ...query, isFetching: true });
  const retryButton = findRetryButton(WeatherDashboardContent({ query: retrying }));
  assert.equal(retryButton.props["aria-disabled"], true);
  assert.equal(retryButton.props.children, "Retrying…");
});

test("preserves Retry during an initial retry and prevents duplicate activation", async (context) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  context.after(() => client.clear());
  let response = Promise.resolve(Response.json({ error: true }, { status: 503 }));
  const fetchMock = context.mock.method(globalThis, "fetch", () => response);
  const observer = new QueryObserver(client, cityWeatherQueryOptions());
  const unsubscribe = observer.subscribe(() => {});
  context.after(unsubscribe);
  await observer.refetch({ cancelRefetch: false });

  const pending = Promise.withResolvers();
  response = pending.promise;
  findRetryButton(WeatherDashboardContent({ query: observer.getCurrentResult() }))
    .props.onClick();
  const retrying = observer.getCurrentResult();
  assert.equal(retrying.isError, false);
  assert.equal(retrying.isFetched, true);
  const busyButton = findRetryButton(WeatherDashboardContent({ query: retrying }));
  assert.equal(busyButton.props["aria-disabled"], true);
  assert.equal(busyButton.props.children, "Retrying…");
  busyButton.props.onClick();
  assert.equal(fetchMock.mock.callCount(), 2);

  pending.resolve(Response.json({ error: true }, { status: 503 }));
  await observer.refetch({ cancelRefetch: false });
  const retryButton = findRetryButton(
    WeatherDashboardContent({ query: observer.getCurrentResult() }),
  );
  assert.equal(retryButton.props["aria-disabled"], false);
});

test("renders real query transitions and recovers through the Retry handler", async (context) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  context.after(() => client.clear());
  let response = Promise.withResolvers();
  const fetchMock = context.mock.method(globalThis, "fetch", () => response.promise);
  const observer = new QueryObserver(client, cityWeatherQueryOptions());
  const unsubscribe = observer.subscribe(() => {});
  context.after(unsubscribe);
  assert.match(renderDashboard(observer.getCurrentResult()), /Loading weather/);

  response.resolve(Response.json(createWeatherData()));
  await observer.refetch({ cancelRefetch: false });
  assert.match(renderDashboard(observer.getCurrentResult()), /18\.5/);

  response = Promise.withResolvers();
  const refreshing = observer.refetch();
  const updatingHtml = renderDashboard(observer.getCurrentResult());
  assert.match(updatingHtml, /Updating weather/);
  assert.match(updatingHtml, /18\.5/);
  response.resolve(Response.json({ error: true, reason: "Unavailable" }, { status: 503 }));
  await refreshing;
  assert.match(renderDashboard(observer.getCurrentResult()), /Showing the last available data/);

  response = Promise.withResolvers();
  const retryButton = findRetryButton(
    WeatherDashboardContent({ query: observer.getCurrentResult() }),
  );
  retryButton.props.onClick();
  const payload = createWeatherData();
  payload.current.temperature_2m = 22;
  response.resolve(Response.json(payload));
  await observer.refetch({ cancelRefetch: false });
  const recovered = renderDashboard(observer.getCurrentResult());
  assert.match(recovered, /22/);
  assert.doesNotMatch(recovered, /Showing the last available data|Retry/);
  assert.equal(fetchMock.mock.callCount(), 3);
});
