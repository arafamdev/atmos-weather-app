import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { citySearchQueryOptions, useCitySearch } from "./useCitySearch.js";

import { adaptCityResults } from "../adapters/geocodingAdapter.js";

function createTestClient(context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  context.after(() => client.clear());
  return client;
}

function createSearchResponse(name = "Porto", id = 1) {
  return {
    results: [{ id, name, country: "Portugal", latitude: 0, longitude: 0,
      timezone: "Europe/Lisbon" }],
  };
}

function observeSearch(client, searchTerm, context) {
  const observer = new QueryObserver(client, citySearchQueryOptions(searchTerm));
  const unsubscribe = observer.subscribe(() => {});
  context.after(unsubscribe);
  return observer;
}

function HookConsumer({ searchTerm }) {
  const query = useCitySearch(searchTerm);
  return createElement("output", null,
    `${query.status}:${query.fetchStatus}:${query.data?.[0]?.name ?? "empty"}`,
  );
}

test("normalizes only outer whitespace and builds stable dynamic keys", () => {
  for (const term of ["Porto", "porto", "São Paulo", "西安", "L’Haÿ-les-Roses", "St. John's", "New  York", "A & B"]) {
    const options = citySearchQueryOptions(` \t${term}\n `);
    assert.deepEqual(options.queryKey, ["cities", "search", term]);
    assert.deepEqual(options.queryKey, citySearchQueryOptions(term).queryKey);
    assert.equal(options.enabled, true);
  }
  assert.notDeepEqual(citySearchQueryOptions("Porto").queryKey, citySearchQueryOptions("porto").queryKey);
});

test("rejects non-string terms rather than silently coercing them", () => {
  for (const term of [null, undefined, 12, {}, []]) {
    assert.throws(() => citySearchQueryOptions(term), /term must be a string/);
  }
});

test("disabled short Unicode queries remain pending and idle without fetching", (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", () => {
    throw new Error("Disabled searches must not fetch");
  });
  for (const term of ["", "   ", " A ", "京", "𠮷"]) {
    assert.equal(citySearchQueryOptions(term).enabled, false);
    const observer = observeSearch(client, term, context);
    const result = observer.getCurrentResult();
    assert.equal(result.status, "pending");
    assert.equal(result.fetchStatus, "idle");
    assert.equal(result.isLoading, false);
    assert.equal(result.data, undefined);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("enabled two-character and international terms reach the service unchanged", async (context) => {
  const client = createTestClient(context);
  const terms = ["Eu", "西安", "São Paulo", "New  York"];
  const requests = [];
  context.mock.method(globalThis, "fetch", async (url) => {
    requests.push(new URL(url).searchParams.get("name"));
    return Response.json(createSearchResponse());
  });
  for (const term of terms) {
    await client.fetchQuery(citySearchQueryOptions(` ${term} `));
  }
  assert.deepEqual(requests, terms);
});

test("passes the query signal and transitions from loading to adapted success", async (context) => {
  const client = createTestClient(context);
  const response = createSearchResponse();
  context.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, false);
    return Response.json(response);
  });
  const observer = observeSearch(client, "Porto", context);
  assert.equal(observer.getCurrentResult().isPending, true);
  assert.equal(observer.getCurrentResult().isLoading, true);
  const data = await client.fetchQuery(citySearchQueryOptions("Porto"));
  assert.deepEqual(data, adaptCityResults(response));
  assert.equal(data[0].admin1, null);
  assert.equal(observer.getCurrentResult().isSuccess, true);
  assert.equal(observer.getCurrentResult().isFetching, false);
  assert.equal(observer.getCurrentResult().error, null);
});

test("no matches are successful empty arrays, not errors", async (context) => {
  const client = createTestClient(context);
  for (const [index, payload] of [{ results: [] }, { generationtime_ms: 0.2 }].entries()) {
    context.mock.method(globalThis, "fetch", async () => Response.json(payload));
    const term = `NoMatch${index}`;
    const observer = observeSearch(client, term, context);
    assert.deepEqual(await client.fetchQuery(citySearchQueryOptions(term)), []);
    assert.equal(observer.getCurrentResult().isSuccess, true);
    assert.equal(observer.getCurrentResult().error, null);
  }
});

test("exposes service errors through native query state", async (context) => {
  const client = createTestClient(context);
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: true, reason: "Unavailable" }, { status: 503 }),
  );
  const observer = observeSearch(client, "Porto", context);
  await assert.rejects(client.fetchQuery(citySearchQueryOptions("Porto")), /HTTP 503/);
  const result = observer.getCurrentResult();
  assert.equal(result.isError, true);
  assert.equal(result.isLoading, false);
  assert.equal(result.data, undefined);
  assert.match(result.error.message, /Unavailable/);
});

test("adapter failures do not enter the cache as successful results", async (context) => {
  const client = createTestClient(context);
  const payload = createSearchResponse();
  payload.results[0].timezone = "Invalid/Timezone";
  context.mock.method(globalThis, "fetch", async () => Response.json(payload));
  const observer = observeSearch(client, "Porto", context);
  await assert.rejects(client.fetchQuery(citySearchQueryOptions("Porto")), /timezone/);
  assert.equal(observer.getCurrentResult().isError, true);
  assert.equal(client.getQueryData(citySearchQueryOptions("Porto").queryKey), undefined);
});

test("deduplicates simultaneous trimmed-equivalent searches and reuses fresh cache", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json(createSearchResponse()),
  );
  const [first, second] = await Promise.all([
    client.fetchQuery(citySearchQueryOptions(" Porto ")),
    client.fetchQuery(citySearchQueryOptions("Porto")),
  ]);
  assert.equal(first, second);
  assert.equal(await client.fetchQuery(citySearchQueryOptions("Porto")), first);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("refetches a cache entry after its thirty-minute freshness window", async (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json(createSearchResponse()),
  );
  const options = citySearchQueryOptions("Porto");
  const data = await client.fetchQuery(options);
  assert.equal(options.staleTime, 30 * 60 * 1000);
  client.setQueryData(options.queryKey, data, { updatedAt: Date.now() - options.staleTime - 1 });
  await client.fetchQuery(options);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("changing terms uses separate cache and never substitutes the previous city's results", async (context) => {
  const client = createTestClient(context);
  let response = Promise.resolve(Response.json(createSearchResponse()));
  const fetchMock = context.mock.method(globalThis, "fetch", () => response);
  const observer = observeSearch(client, "Porto", context);
  const porto = await client.fetchQuery(citySearchQueryOptions("Porto"));
  const pending = Promise.withResolvers();
  response = pending.promise;
  observer.setOptions(citySearchQueryOptions("Lisbon"));
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(observer.getCurrentResult().isPending, true);
  assert.equal(observer.getCurrentResult().isPlaceholderData, false);
  assert.equal(client.getQueryData(citySearchQueryOptions("Porto").queryKey), porto);

  pending.resolve(Response.json(createSearchResponse("Lisbon", 2)));
  const lisbon = await client.fetchQuery(citySearchQueryOptions("Lisbon"));
  assert.equal(lisbon[0].name, "Lisbon");
  assert.notEqual(lisbon, porto);
  observer.setOptions(citySearchQueryOptions(" Porto "));
  assert.equal(observer.getCurrentResult().data, porto);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("switching from an in-flight search aborts the obsolete request", async (context) => {
  const client = createTestClient(context);
  let obsoleteSignal;
  context.mock.method(globalThis, "fetch", (url, { signal }) => {
    if (new URL(url).searchParams.get("name") === "Porto") {
      obsoleteSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    return Promise.resolve(Response.json(createSearchResponse("Lisbon", 2)));
  });
  const observer = observeSearch(client, "Porto", context);
  assert.equal(obsoleteSignal.aborted, false);
  observer.setOptions(citySearchQueryOptions("Lisbon"));
  assert.equal(obsoleteSignal.aborted, true);
  const results = await client.fetchQuery(citySearchQueryOptions("Lisbon"));
  assert.equal(results[0].name, "Lisbon");
  assert.equal(client.getQueryData(citySearchQueryOptions("Porto").queryKey), undefined);
  assert.equal(observer.getCurrentResult().isSuccess, true);
});

test("clearing a search aborts its request and returns to a disabled idle query", (context) => {
  const client = createTestClient(context);
  let requestSignal;
  context.mock.method(globalThis, "fetch", (_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const observer = observeSearch(client, "Porto", context);
  observer.setOptions(citySearchQueryOptions(" "));
  assert.equal(requestSignal.aborted, true);
  assert.equal(observer.getCurrentResult().fetchStatus, "idle");
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(observer.getCurrentResult().error, null);
});

test("late obsolete responses cannot replace current suggestions even if fetch ignores abort", async (context) => {
  const client = createTestClient(context);
  const obsolete = Promise.withResolvers();
  let obsoleteSignal;
  context.mock.method(globalThis, "fetch", (url, { signal }) => {
    if (new URL(url).searchParams.get("name") === "Lisboa") {
      obsoleteSignal = signal;
      return obsolete.promise;
    }
    return Promise.resolve(Response.json(createSearchResponse("Lisbon", 2267057)));
  });
  const observer = observeSearch(client, "Lisboa", context);
  observer.setOptions(citySearchQueryOptions("Lisbon"));
  const current = await client.fetchQuery(citySearchQueryOptions("Lisbon"));
  assert.equal(obsoleteSignal.aborted, true);
  obsolete.resolve(Response.json(createSearchResponse("Lisboa", 1043652)));
  await setImmediate();
  assert.equal(observer.getCurrentResult().data, current);
  assert.equal(current[0].id, 2267057);
  assert.equal(client.getQueryData(citySearchQueryOptions("Lisboa").queryKey), undefined);
});

test("the hook returns native disabled and cached states under its provider", (context) => {
  const client = createTestClient(context);
  const fetchMock = context.mock.method(globalThis, "fetch", () => {
    throw new Error("Server rendering must not fetch");
  });
  const renderHook = (searchTerm) => renderToString(createElement(
    QueryClientProvider, { client }, createElement(HookConsumer, { searchTerm }),
  ));
  assert.match(renderHook(" "), /pending:idle:empty/);
  client.setQueryData(citySearchQueryOptions("Porto").queryKey, adaptCityResults(createSearchResponse()));
  assert.match(renderHook(" Porto "), /success:idle:Porto/);
  assert.equal(fetchMock.mock.callCount(), 0);
});
