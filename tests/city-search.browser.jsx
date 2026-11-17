import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import CitySearch from "../src/features/weather/components/CitySearch.jsx";

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function SearchHarness() {
  const [location, setLocation] = useState({ name: "Porto" });
  return (
    <QueryClientProvider client={client}>
      <h2>Weather in {location.name}.</h2>
      <CitySearch onSelectCity={(selected) => {
        selections.push(selected);
        setLocation(selected);
      }} />
      <button type="button">Outside search</button>
    </QueryClientProvider>
  );
}

async function mountSearch() {
  selections = [];
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
  ["mouse retains focus until click without selecting on press", async (input) => {
    const option = container.querySelector('[role="option"]');
    await emit(option, pointer("pointerdown", "mouse"));
    const down = await emit(option, mouse("mousedown"));
    assert(down.defaultPrevented, "Prevent mouse focus transfer before click");
    assert(selections.length === 0, "Do not select on mousedown");
    await emit(option, mouse("mouseup"));
    await emit(option, mouse("click"));
    assertSelected(input);
  }],
  ["touch scrolling and pointer cancellation never select a city", async (input) => {
    const option = container.querySelector('[role="option"]');
    const down = await emit(option, pointer("pointerdown"));
    const move = await emit(option, pointer("pointermove"));
    await emit(option, pointer("pointercancel"));
    await emit(option, new Event("touchend", { bubbles: true }));
    assert(!down.defaultPrevented && !move.defaultPrevented, "Leave touch gestures available to the browser");
    assert(selections.length === 0 && input.value === "Lisbon", "A cancelled gesture must not select or clear");
    assert(container.querySelector("h2").textContent === "Weather in Porto.", "Preserve active city while scrolling");
  }],
  ["outside blur dismisses suggestions without selecting", async (input) => {
    await act(async () => { container.querySelector("button").focus(); });
    assert(document.activeElement !== input, "Allow focus to leave search");
    assert(input.getAttribute("aria-expanded") === "false", "Close on outside blur");
    assert(!container.querySelector('[role="option"]') && selections.length === 0, "Dismiss without selection");
  }],
  ["keyboard navigation, Escape and repeated Enter remain safe", async (input) => {
    await emit(input, new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert(selections.length === 0, "Unmatched Enter must not select");
    await emit(input, new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
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
    }
  }
  results.textContent = lines.join("\n");
  runButton.disabled = false;
});
