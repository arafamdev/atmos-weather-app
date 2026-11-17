import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { portoWeatherQueryOptions, usePortoWeather } from "./usePortoWeather.js";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { createWeatherData } from "../testing/weatherFixtures.js";

function createTestClient(context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  context.after(() => client.clear());
  return client;
}

function observeWeather(client, context) {
  const observer = new QueryObserver(client, portoWeatherQueryOptions);
  const unsubscribe = observer.subscribe(() => {});
  context.after(unsubscribe);
  return observer;
}

function HookConsumer() {
  const query = usePortoWeather();
  return createElement(
    "output",
    null,
    `${query.status}:${query.data?.currentWeather.temperature ?? "empty"}`,
  );
}

test("exposes the native initial hook state under QueryClientProvider", (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", () => {
    throw new Error("Server rendering must not fetch");
  });
  const html = renderToString(
    createElement(QueryClientProvider, { client }, createElement(HookConsumer)),
  );
  assert.match(html, /pending:empty/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("transitions from loading to success, passes the signal, and caches adapted data", async (context) => {
  const client = createTestClient(context);
  const payload = createWeatherData();
  const fetchMock = context.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(new URL(url).hostname, "api.open-meteo.com");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    return Response.json(payload);
  });
  const observer = observeWeather(client, context);
  assert.equal(observer.getCurrentResult().status, "pending");
  assert.equal(observer.getCurrentResult().isLoading, true);
  assert.equal(observer.getCurrentResult().isFetching, true);

  const data = await client.fetchQuery(portoWeatherQueryOptions);
  const result = observer.getCurrentResult();
  assert.equal(result.status, "success");
  assert.equal(result.isSuccess, true);
  assert.equal(result.isLoading, false);
  assert.equal(result.isFetching, false);
  assert.equal(result.error, null);
  assert.deepEqual(data, adaptWeatherData(payload));
  assert.equal(client.getQueryData(portoWeatherQueryOptions.queryKey), data);
  assert.equal(fetchMock.mock.callCount(), 1);

  const html = renderToString(
    createElement(QueryClientProvider, { client }, createElement(HookConsumer)),
  );
  assert.match(html, /success:18.5/);
});

test("shares fresh cache across equivalent keys and simultaneous requests", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json(createWeatherData()),
  );
  const [first, second] = await Promise.all([
    client.fetchQuery(portoWeatherQueryOptions),
    client.fetchQuery({
      ...portoWeatherQueryOptions,
      queryKey: [...portoWeatherQueryOptions.queryKey],
    }),
  ]);
  assert.equal(first, second);
  assert.equal(await client.fetchQuery(portoWeatherQueryOptions), first);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("treats the cache as stale after five minutes and refetches", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json(createWeatherData()),
  );
  const data = await client.fetchQuery(portoWeatherQueryOptions);
  assert.equal(portoWeatherQueryOptions.staleTime, 300000);
  client.setQueryData(portoWeatherQueryOptions.queryKey, data, {
    updatedAt: Date.now() - portoWeatherQueryOptions.staleTime - 1,
  });
  await client.fetchQuery(portoWeatherQueryOptions);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("exposes service failures through native error state", async (context) => {
  const client = createTestClient(context);
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: true, reason: "Service unavailable" }, { status: 503 }),
  );
  const observer = observeWeather(client, context);
  await assert.rejects(client.fetchQuery(portoWeatherQueryOptions), /HTTP 503/);
  const result = observer.getCurrentResult();
  assert.equal(result.status, "error");
  assert.equal(result.isError, true);
  assert.equal(result.isLoading, false);
  assert.equal(result.isFetching, false);
  assert.equal(result.data, undefined);
  assert.match(result.error.message, /Service unavailable/);
});

test("rejects adapter failures without caching invalid success data", async (context) => {
  const client = createTestClient(context);
  const payload = createWeatherData();
  payload.current.relative_humidity_2m = 101;
  context.mock.method(globalThis, "fetch", async () => Response.json(payload));
  const observer = observeWeather(client, context);
  await assert.rejects(client.fetchQuery(portoWeatherQueryOptions), /relative_humidity_2m/);
  assert.equal(observer.getCurrentResult().isError, true);
  assert.equal(client.getQueryData(portoWeatherQueryOptions.queryKey), undefined);
});

test("cancels the in-flight fetch through the query's AbortSignal", async (context) => {
  const client = createTestClient(context);
  let requestSignal;
  context.mock.method(globalThis, "fetch", (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const observer = observeWeather(client, context);
  assert.equal(requestSignal.aborted, false);
  await client.cancelQueries({ queryKey: portoWeatherQueryOptions.queryKey });
  assert.equal(requestSignal.aborted, true);
  assert.equal(observer.getCurrentResult().fetchStatus, "idle");
  assert.equal(observer.getCurrentResult().error, null);
  assert.equal(client.getQueryData(portoWeatherQueryOptions.queryKey), undefined);
});

test("keeps cached data during a background refetch", async (context) => {
  const client = createTestClient(context);
  const cached = adaptWeatherData(createWeatherData());
  client.setQueryData(portoWeatherQueryOptions.queryKey, cached);
  const response = Promise.withResolvers();
  context.mock.method(globalThis, "fetch", () => response.promise);
  const observer = observeWeather(client, context);
  const refetch = observer.refetch();
  const fetching = observer.getCurrentResult();
  assert.equal(fetching.isFetching, true);
  assert.equal(fetching.isLoading, false);
  assert.equal(fetching.isSuccess, true);
  assert.equal(fetching.data, cached);

  const payload = createWeatherData();
  payload.current.temperature_2m = 20;
  response.resolve(Response.json(payload));
  await refetch;
  assert.equal(observer.getCurrentResult().data.currentWeather.temperature, 20);
});

test("aborts the request when its last observer unsubscribes", (context) => {
  const client = createTestClient(context);
  let requestSignal;
  context.mock.method(globalThis, "fetch", (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const observer = new QueryObserver(client, portoWeatherQueryOptions);
  const unsubscribe = observer.subscribe(() => {});
  assert.equal(requestSignal.aborted, false);
  unsubscribe();
  assert.equal(requestSignal.aborted, true);
  assert.equal(client.getQueryState(portoWeatherQueryOptions.queryKey).fetchStatus, "idle");
});

test("retains cached data and exposes a native refetch error after a failed refresh", async (context) => {
  const client = createTestClient(context);
  const cached = adaptWeatherData(createWeatherData());
  client.setQueryData(portoWeatherQueryOptions.queryKey, cached);
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: true, reason: "Service unavailable" }, { status: 503 }),
  );
  const observer = observeWeather(client, context);
  await observer.refetch();
  const result = observer.getCurrentResult();
  assert.equal(result.isRefetchError, true);
  assert.equal(result.data, cached);
  assert.match(result.error.message, /HTTP 503/);
});
