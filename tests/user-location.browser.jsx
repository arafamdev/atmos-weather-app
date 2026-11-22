import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "../src/App.jsx";

import { createWeatherData } from "../src/features/weather/testing/weatherFixtures.js";

import "../src/index.css";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const container = document.getElementById("test-root");
const results = document.getElementById("results");
const runButton = document.getElementById("run-tests");
const nativeFetch = globalThis.fetch;
const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, "geolocation");
const permissionsDescriptor = Object.getOwnPropertyDescriptor(navigator, "permissions");
const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
const position = { coords: { latitude: 35.6895, longitude: 139.6917 } };
const lisbon = { id: 2267057, name: "Lisbon", country: "Portugal", admin1: null,
  latitude: 38.7223, longitude: -9.1393, timezone: "Europe/Lisbon" };
let root;
let client;
let gps;
let forecasts;
let reverseSignal;
let resolveReverse;

function assert(value, message) {
  if (!value) throw new Error(message);
}
async function mount({ permission = "prompt", supported = true, reverse = "success" } = {}) {
  gps = []; forecasts = []; reverseSignal = null;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: supported ? {
    getCurrentPosition: (success, fail) => gps.push({ success, fail }),
  } : undefined });
  Object.defineProperty(navigator, "permissions", { configurable: true, value: permission === null ? undefined : {
    query: async () => ({ state: permission }),
  } });
  globalThis.fetch = async (url, { signal } = {}) => {
    const request = new URL(url);
    if (request.hostname === "api.bigdatacloud.net") {
      reverseSignal = signal;
      if (reverse === "failure") throw new TypeError("Offline");
      if (reverse === "pending") await new Promise((resolve) => { resolveReverse = resolve; });
      return Response.json({ lookupSource: "coordinates", city: "Tokyo", countryName: "Japan" });
    }
    assert(request.hostname === "api.open-meteo.com", "No unexpected HTTP requests");
    forecasts.push(request);
    const timezone = request.searchParams.get("timezone") === "auto" ? "Asia/Tokyo" : request.searchParams.get("timezone");
    return Response.json({ ...createWeatherData("2026-11-17", timezone === "Asia/Tokyo" ? 32400 : 0), timezone });
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["cities", "search", "Lisbon"], [lisbon]);
  root = createRoot(container);
  await act(async () => { root.render(<StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></StrictMode>); });
}
function button() { return [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Use my location")); }
async function request() { await act(async () => { button().click(); }); }
async function manualCity() {
  const input = container.querySelector('[role="combobox"]');
  await act(async () => {
    input.focus(); valueSetter.call(input, "Lisbon"); input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
  await act(async () => { container.querySelector('[role="option"]').click(); });
  assert(input.value === "", "Manual city selection must still clear input");
  assert(container.querySelector("main h2").textContent === "Weather in Lisbon.", "Manual city must stay active");
}
async function finishGps(index = 0) {
  await act(async () => { await gps[index].success(position); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const tests = [
  ["slow locality lookup cannot delay weather or refetch it when the name arrives", async () => {
    await mount({ reverse: "pending" }); await request();
    let pending;
    await act(async () => { pending = gps[0].success(position); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    assert(container.querySelector("main h2").textContent === "Weather in Current location.", "Publish GPS coordinates before the locality resolves");
    const card = container.querySelector('[aria-label="Current weather"]');
    assert(card && card.textContent.includes("Current location"), "Coordinate weather must load while BigDataCloud is still pending");
    const requestCount = forecasts.length;
    assert(forecasts.filter((url) => url.searchParams.get("timezone") === "auto").length === 1, "Request one GPS forecast");
    assert(button().getAttribute("aria-busy") === "true", "Keep locality progress accessible");
    await act(async () => { resolveReverse(); await pending; });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    assert(container.querySelector("main h2").textContent === "Weather in Tokyo.", "Enrich the App identification");
    assert(container.querySelector('[aria-label="Current weather"]').textContent.includes("Tokyo, Japan"), "Relabel the current card without replacing its forecast");
    assert(!container.querySelector("main").textContent.includes("Current location"), "All forecast sections must use the enriched identification");
    assert(forecasts.length === requestCount, "Locality-only changes must never restart weather fetching");
  }],
  ["first visit never prompts; button loads GPS and can return after a manual city", async () => {
    await mount(); assert(gps.length === 0, "Prompt permission must not auto-request GPS");
    await request(); assert(button().disabled && button().getAttribute("aria-busy") === "true", "Announce and disable pending request");
    await request(); assert(gps.length === 1, "Avoid duplicate requests");
    await finishGps();
    assert(container.querySelector("main h2").textContent === "Weather in Tokyo.", "GPS locality updates the shared App state");
    const forecast = forecasts.find((url) => url.searchParams.get("timezone") === "auto");
    assert(forecast.searchParams.get("latitude") === String(position.coords.latitude), "Forecast must use GPS latitude");
    assert(forecast.searchParams.get("longitude") === String(position.coords.longitude), "Forecast must use GPS longitude");
    await manualCity(); await request(); await finishGps(1);
    assert(container.querySelector("main h2").textContent === "Weather in Tokyo.", "Button returns from manual search to GPS");
  }],
  ["granted permission auto-locates only once in StrictMode", async () => {
    await mount({ permission: "granted" }); assert(gps.length === 1, "Only one GPS request after StrictMode replay");
    await finishGps(); assert(container.querySelector("main h2").textContent.includes("Tokyo"), "Granted permission uses real coordinates");
  }],
  ["manual selection wins over an outstanding GPS callback", async () => {
    await mount(); await request(); await manualCity(); await finishGps();
    assert(container.querySelector("main h2").textContent === "Weather in Lisbon.", "Late GPS cannot override manual city");
    assert(!forecasts.some((url) => url.searchParams.get("timezone") === "auto"), "Ignored GPS cannot start a forecast");
  }],
  ["manual selection aborts pending reverse lookup and ignores its late response", async () => {
    await mount({ reverse: "pending" }); await request();
    let pending;
    await act(async () => { pending = gps[0].success(position); });
    await manualCity(); assert(reverseSignal.aborted, "Manual selection cancels the HTTP lookup");
    await act(async () => { resolveReverse(); await pending; });
    assert(container.querySelector("main h2").textContent === "Weather in Lisbon.", "Late locality cannot overwrite the selected city");
  }],
  ["reverse lookup failure still loads coordinate weather with an honest fallback", async () => {
    await mount({ reverse: "failure" }); await request(); await finishGps();
    assert(container.querySelector("main h2").textContent === "Weather in Current location.", "Do not invent a locality");
    assert(container.textContent.includes("Locality unavailable"), "Explain the locality fallback");
    assert(!container.querySelector("main").textContent.includes("Porto"), "Never substitute Porto for GPS weather");
    assert(container.querySelector('[aria-label="Current weather"]'), "Forecast survives locality failure");
  }],
  ["missing Permissions API leaves the explicit button usable", async () => {
    await mount({ permission: null }); assert(gps.length === 0, "No automatic permission prompt without Permissions API");
    await request(); await finishGps(); assert(container.querySelector("main h2").textContent.includes("Tokyo"), "Explicit geolocation still works");
  }],
  ["denial is accessible and preserves the active city", async () => {
    await mount({ permission: "denied" }); assert(gps.length === 0, "Do not auto-request denied permission");
    await request(); await act(async () => { gps[0].fail({ code: 1 }); });
    assert(container.querySelector('[role="alert"]').textContent.includes("denied"), "Announce denial");
    assert(container.querySelector("main h2").textContent.includes("Porto"), "Keep initial fallback on denial");
    assert(!button().disabled, "Permit user retry");
  }],
  ["unsupported geolocation gives guidance without breaking manual search", async () => {
    await mount({ supported: false }); await request();
    assert(container.querySelector('[role="alert"]').textContent.includes("not supported"), "Explain unsupported browser");
    await manualCity();
  }],
];
runButton.addEventListener("click", async () => {
  runButton.disabled = true; results.textContent = "Running…";
  const lines = [];
  for (const [name, run] of tests) {
    try { await run(); lines.push(`PASS: ${name}`); }
    catch (error) { lines.push(`FAIL: ${name}: ${error.message}`); }
    finally {
      await act(async () => { root?.unmount(); }); client?.clear();
      globalThis.fetch = nativeFetch;
      for (const [key, descriptor] of [["geolocation", geolocationDescriptor], ["permissions", permissionsDescriptor]]) {
        if (descriptor) Object.defineProperty(navigator, key, descriptor);
        else delete navigator[key];
      }
    }
  }
  results.textContent = lines.join("\n"); runButton.disabled = false;
});


document.getElementById("show-preview").addEventListener("click", async () => {
  await mount();
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
