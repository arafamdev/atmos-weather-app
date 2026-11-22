import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppContent } from "../src/App.jsx";

import { createWeatherData } from "../src/features/weather/testing/weatherFixtures.js";
import { DEFAULT_WEATHER_LOCATION } from "../src/features/weather/utils/weatherLocation.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const city = {
  id: 2267057, name: "Lisbon", country: "Portugal", admin1: "Lisbon",
  latitude: 38.7167, longitude: -9.1333, timezone: "Europe/Lisbon",
};
const container = document.getElementById("test-root");
const results = document.getElementById("results");
const runButton = document.getElementById("run-tests");
const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
let root;
let client;
let selections;
let weatherRequests;
const originalFetch = globalThis.fetch;
const originalScrollIntoView = Element.prototype.scrollIntoView;
let scrollRequests;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function SearchHarness() {
  const [location, setLocation] = useState(DEFAULT_WEATHER_LOCATION);
  return (
    <QueryClientProvider client={client}>
      <AppContent activeLocation={location} onSelectCity={(selected) => {
        selections.push(selected);
        setLocation(selected);
      }} />
      <button id="outside-search" type="button">Outside search</button>
    </QueryClientProvider>
  );
}

async function mountSearch() {
  selections = [];
  weatherRequests = [];
  scrollRequests = 0;
  Element.prototype.scrollIntoView = function () { scrollRequests += 1; };
  globalThis.fetch = async (url) => {
    const request = new URL(url);
    assert(request.hostname === "api.open-meteo.com", "Only forecast requests are expected");
    weatherRequests.push(request);
    return Response.json(createWeatherData());
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["cities", "search", "Lisbon"], [city]);
  root = createRoot(container);
  await act(async () => { root.render(<SearchHarness />); });
  const input = container.querySelector("input");
  await act(async () => {
    input.focus();
    inputValueSetter.call(input, "Lisbon");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
  assert(container.querySelector('[role="option"]'), "Suggestions must be mounted");
  return input;
}

async function emit(target, event) {
  await act(async () => { target.dispatchEvent(event); });
  return event;
}

function pointer(type, pointerType = "touch") {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType });
}

function mouse(type) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
}

function assertSelected(input) {
  assert(selections.length === 1 && selections[0].id === city.id, "Select the city exactly once");
  assert(container.querySelector("h2").textContent === "Weather in Lisbon.", "Keep the selected location active");
  assert(input.value === "" && input.placeholder === "Search city...", "Clear input and restore placeholder");
  assert(input.getAttribute("aria-expanded") === "false", "Collapse the combobox");
  assert(!container.querySelector('[role="listbox"]'), "Unmount suggestions");
  assert(document.activeElement === input, "Keep focus on the combobox");
}

const tests = [
  ["touch blur before compatibility mouse events still selects exactly once", async (input) => {
    const option = container.querySelector('[role="option"]');
    await emit(option, new Event("touchstart", { bubbles: true }));
    await emit(option, pointer("pointerdown"));
    await act(async () => { input.blur(); });
    assert(option.isConnected, "Early blur must not destroy the click target");
    await emit(option, pointer("pointerup"));
    await emit(option, new Event("touchend", { bubbles: true }));
    await emit(option, mouse("mousedown"));
    await emit(option, mouse("mouseup"));
    await emit(option, mouse("click"));
    assertSelected(input);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const forecast = weatherRequests.find((url) => url.searchParams.get("latitude") === String(city.latitude));
    assert(forecast?.searchParams.get("longitude") === String(city.longitude), "Selection must request the selected longitude");
    assert(forecast.searchParams.get("timezone") === city.timezone, "Selection must request the selected timezone");
    assert(!container.querySelector("main").textContent.includes("Porto"), "The new city must not show old weather");
  }],
  ["outside pointer dismisses even when input already lost focus", async (input) => {
    await act(async () => { input.blur(); });
    await emit(container.querySelector("#outside-search"), pointer("pointerdown"));
    assert(!container.querySelector('[role="option"]'), "Outside pointer closes the popup");
    assert(selections.length === 0, "Outside pointer never selects");
  }],
  ["Tab closes the popup without trapping focus", async (input) => {
    const tab = await emit(input, new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    assert(!tab.defaultPrevented, "Preserve native Tab navigation");
    assert(!container.querySelector('[role="option"]'), "Tab closes suggestions");
  }],

  ["touch sequence does not cancel pointerdown and selects once on compatibility click", async (input) => {
    const option = container.querySelector('[role="option"]');
    const down = await emit(option, pointer("pointerdown"));
    assert(!down.defaultPrevented, "Do not cancel touch pointerdown: some WebKit versions suppress the subsequent click");
    await emit(option, pointer("pointerup"));
    await emit(option, new Event("touchend", { bubbles: true, cancelable: true }));
    assert(selections.length === 0, "Do not select on touchend or pointerup");
    const mouseDown = await emit(option, mouse("mousedown"));
    // Model the focus default action separately: dispatchEvent does not perform it.
    if (!mouseDown.defaultPrevented) await act(async () => { input.blur(); });
    assert(option.isConnected, "The blur default action must not remove the option before click");
    await emit(option, mouse("mouseup"));
    await emit(option, mouse("click"));
    await emit(option, mouse("click"));
    assertSelected(input);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    assert(!container.querySelector('[role="option"]'), "Clearing the debounce must not reopen stale results");
  }],
  ["mouse blur before click does not dismiss the option", async (input) => {
    const option = container.querySelector('[role="option"]');
    await emit(option, pointer("pointerdown", "mouse"));
    const down = await emit(option, mouse("mousedown"));
    assert(!down.defaultPrevented, "Do not cancel native mouse events");
    await act(async () => { input.blur(); });
    assert(option.isConnected, "Blur must not unmount a pending option");
    assert(selections.length === 0, "Do not select on mousedown");
    await emit(option, mouse("mouseup"));
    await emit(option, mouse("click"));
    assertSelected(input);
  }],
  ["touch scrolling and pointer cancellation never select a city", async (input) => {
    const option = container.querySelector('[role="option"]');
    const down = await emit(option, pointer("pointerdown"));
    const move = await emit(option, pointer("pointermove"));
    assert(scrollRequests === 0, "Touch movement must not trigger programmatic scrolling");
    assert(input.getAttribute("aria-activedescendant") === null, "Touch movement must not activate options");
    await emit(container.querySelector('[role="listbox"]'), new Event("scroll"));
    await emit(option, pointer("pointercancel"));
    await emit(option, new Event("touchend", { bubbles: true }));
    assert(!down.defaultPrevented && !move.defaultPrevented, "Leave touch gestures available to the browser");
    assert(selections.length === 0 && input.value === "Lisbon", "A cancelled gesture must not select or clear");
    assert(container.querySelector("h2").textContent === "Weather in Porto.", "Preserve active city while scrolling");
  }],
  ["outside blur dismisses suggestions without selecting", async (input) => {
    await act(async () => { container.querySelector("#outside-search").focus(); });
    assert(document.activeElement !== input, "Allow focus to leave search");
    assert(input.getAttribute("aria-expanded") === "false", "Close on outside blur");
    assert(!container.querySelector('[role="option"]') && selections.length === 0, "Dismiss without selection");
  }],
  ["keyboard navigation, Escape and repeated Enter remain safe", async (input) => {
    await emit(input, new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert(selections.length === 0, "Unmatched Enter must not select");
    await emit(input, new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    assert(scrollRequests === 1, "Keyboard navigation scrolls the active option into view");
    assert(document.getElementById(input.getAttribute("aria-activedescendant")), "Active descendant must exist");
    await emit(input, new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert(input.getAttribute("aria-expanded") === "false" && document.activeElement === input, "Escape closes without losing focus");
    await emit(input, new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    await emit(input, new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));
    assert(selections.length === 0, "Ignore held Enter");
    await emit(input, new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await emit(input, new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assertSelected(input);
  }],
];

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  results.textContent = "Running…";
  const lines = [];
  for (const [name, run] of tests) {
    try {
      const input = await mountSearch();
      await run(input);
      lines.push(`PASS: ${name}`);
    } catch (error) {
      lines.push(`FAIL: ${name}: ${error.message}`);
    } finally {
      await act(async () => { root?.unmount(); });
      client?.clear();
      globalThis.fetch = originalFetch;
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  }
  results.textContent = lines.join("\n");
  runButton.disabled = false;
});
