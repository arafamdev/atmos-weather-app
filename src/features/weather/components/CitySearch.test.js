import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import {
  citySearchReducer,
  getCityDetails,
  getCitySuggestions,
  handleCitySearchKeyDown,
  initialCitySearchState,
  scheduleCitySearch,
} from "./citySearchHelpers.js";

let server;
let CitySearchContent;
const cities = [
  { id: 1, name: "Springfield", country: "United States", admin1: "Illinois", latitude: 39.8, longitude: -89.6 },
  { id: 2, name: "Springfield", country: "United States", admin1: "Massachusetts", latitude: 42.1, longitude: -72.5 },
];

before(async () => {
  server = await createServer({
    configFile: false,
    appType: "custom",
    esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ CitySearchContent } = await server.ssrLoadModule("/src/features/weather/components/CitySearch.jsx"));
});
after(async () => { await server?.close(); });

function createProps(overrides = {}) {
  return {
    state: citySearchReducer(initialCitySearchState, { type: "input", value: "Springfield" }),
    suggestions: cities,
    statusMessage: "2 suggestions available.",
    isError: false,
    ids: { input: "city-input", list: "city-list", status: "city-status" },
    inputHandlers: { onChange() {} },
    onSelectCity: () => {},
    onActivateCity: () => {},
    ...overrides,
  };
}

function findElements(element, predicate) {
  if (!element || typeof element !== "object") return [];
  const children = [element.props?.children].flat(Infinity);
  return [
    ...(predicate(element) ? [element] : []),
    ...children.flatMap((child) => findElements(child, predicate)),
  ];
}

test("waits 300 ms before publishing a search term", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const onReady = context.mock.fn();
  scheduleCitySearch("Porto", onReady);
  context.mock.timers.tick(299);
  assert.equal(onReady.mock.callCount(), 0);
  context.mock.timers.tick(1);
  assert.equal(onReady.mock.callCount(), 1);
  assert.equal(onReady.mock.calls[0].arguments[0], "Porto");
});

test("cancels superseded debounce timers", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const onReady = context.mock.fn();
  const cleanup = scheduleCitySearch("Por", onReady);
  context.mock.timers.tick(200);
  cleanup();
  scheduleCitySearch("Porto", onReady);
  context.mock.timers.tick(299);
  assert.equal(onReady.mock.callCount(), 0);
  context.mock.timers.tick(1);
  assert.equal(onReady.mock.callCount(), 1);
  assert.equal(onReady.mock.calls[0].arguments[0], "Porto");
});

test("input changes retain Unicode and inner whitespace and clear active selection", () => {
  const previous = { ...initialCitySearchState, activeCityId: 1 };
  const next = citySearchReducer(previous, { type: "input", value: " São  Paulo " });
  assert.equal(next.inputValue, " São  Paulo ");
  assert.equal(next.searchTerm, "São  Paulo");
  assert.equal(next.activeCityId, null);
  assert.equal(next.isOpen, true);
  assert.equal(previous.activeCityId, 1);
});

test("renders a labelled combobox with matching listbox and active option IDs", () => {
  const props = createProps();
  props.state = { ...props.state, activeCityId: 2 };
  const html = renderToStaticMarkup(createElement(CitySearchContent, props));
  assert.match(html, /for="city-input"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="city-list"/);
  assert.match(html, /aria-activedescendant="city-list-option-2"/);
  assert.match(html, /id="city-list" role="listbox"/);
  assert.match(html, /Illinois, United States/);
  assert.match(html, /Massachusetts, United States/);
  assert.match(html, /Location 1, coordinates/);
  assert.match(html, /Location 2, coordinates/);
});

test("a closed or too-short combobox has no popup or active descendant", () => {
  for (const state of [initialCitySearchState, { ...createProps().state, isOpen: false }]) {
    const html = renderToStaticMarkup(createElement(CitySearchContent, createProps({ state })));
    assert.match(html, /aria-expanded="false"/);
    assert.doesNotMatch(html, /role="listbox"|aria-activedescendant|aria-controls/);
  }
});

test("loading, errors and no-match states have accessible messages and no suggestions", () => {
  for (const [statusMessage, isError] of [
    ["Searching cities…", false], ["Unable to search cities. Please try again.", true],
    ["No cities found.", false],
  ]) {
    const html = renderToStaticMarkup(createElement(CitySearchContent, createProps({
      suggestions: [], statusMessage, isError,
    })));
    assert.ok(html.includes(statusMessage));
    assert.match(html, new RegExp(`role="${isError ? "alert" : "status"}"`));
    assert.doesNotMatch(html, /role="option"|aria-activedescendant/);
  }
});

test("arrow keys navigate suggestions and Enter selects the exact city", (context) => {
  let state = createProps().state;
  const onSelectCity = context.mock.fn();
  const dispatch = (action) => { state = citySearchReducer(state, action); };
  const press = (key) => handleCitySearchKeyDown({
    key, preventDefault() {}, stopPropagation() {},
  }, { state, suggestions: cities, dispatch, onSelectCity });
  press("ArrowDown");
  assert.equal(state.activeCityId, 1);
  press("ArrowDown");
  assert.equal(state.activeCityId, 2);
  press("Enter");
  assert.equal(onSelectCity.mock.callCount(), 1);
  assert.equal(onSelectCity.mock.calls[0].arguments[0], cities[1]);
  press("ArrowUp");
  assert.equal(state.activeCityId, 1);
});

test("Escape closes the popup and Tab keeps native focus navigation", (context) => {
  for (const key of ["Escape", "Tab"]) {
    let state = { ...createProps().state, activeCityId: 2 };
    const preventDefault = context.mock.fn();
    handleCitySearchKeyDown({ key, preventDefault, stopPropagation() {} }, {
      state, suggestions: cities, onSelectCity() {},
      dispatch: (action) => { state = citySearchReducer(state, action); },
    });
    assert.equal(state.isOpen, false);
    assert.equal(state.activeCityId, null);
    assert.equal(preventDefault.mock.callCount(), key === "Tab" ? 0 : 1);
  }
});

test("arrow keys retain native input behavior without selectable suggestions", (context) => {
  const selectedState = citySearchReducer(createProps().state, { type: "select", city: cities[0] });
  for (const state of [initialCitySearchState, selectedState, createProps().state]) {
    for (const key of ["ArrowDown", "ArrowUp"]) {
      const preventDefault = context.mock.fn();
      const dispatch = context.mock.fn();
      handleCitySearchKeyDown({ key, preventDefault }, {
        state, suggestions: [], dispatch, onSelectCity() {},
      });
      assert.equal(preventDefault.mock.callCount(), 0);
      assert.equal(dispatch.mock.callCount(), 0);
    }
  }
});

test("Enter without a visible active result and IME composition do not select", (context) => {
  const onSelectCity = context.mock.fn();
  const dispatch = context.mock.fn();
  for (const event of [
    { key: "Enter" }, { key: "Enter", nativeEvent: { isComposing: true } },
    { key: "Enter", keyCode: 229 },
  ]) {
    handleCitySearchKeyDown({ preventDefault() {}, ...event }, {
      state: createProps().state, suggestions: cities, dispatch, onSelectCity,
    });
  }
  assert.equal(onSelectCity.mock.callCount(), 0);
  assert.equal(dispatch.mock.callCount(), 0);
});

test("mouse interaction retains input focus and communicates the exact selected city", (context) => {
  const onSelectCity = context.mock.fn();
  const onActivateCity = context.mock.fn();
  const tree = CitySearchContent(createProps({ onSelectCity, onActivateCity }));
  const options = findElements(tree, (element) => element.props?.role === "option");
  const preventDefault = context.mock.fn();
  options[1].props.onPointerDown({ preventDefault });
  options[1].props.onPointerMove();
  options[1].props.onClick();
  assert.equal(preventDefault.mock.callCount(), 1);
  assert.equal(onActivateCity.mock.calls[0].arguments[0], cities[1].id);
  assert.equal(onSelectCity.mock.calls[0].arguments[0], cities[1]);
});

test("selection clears the input, closes the popup and stops the search", () => {
  const state = citySearchReducer(createProps().state, { type: "select", city: cities[1] });
  assert.equal(state.inputValue, "");
  assert.equal(state.searchTerm, "");
  assert.equal(state.isOpen, false);
  assert.equal(state.activeCityId, null);
});

test("missing location metadata uses real coordinates, not invented regions", () => {
  assert.equal(getCityDetails({ admin1: null, country: null, latitude: 0, longitude: 0 }), "0, 0");
});

test("empty lists and stale active IDs do not produce invalid active descendants", () => {
  const state = { ...createProps().state, activeCityId: 999 };
  const html = renderToStaticMarkup(createElement(CitySearchContent, createProps({ state })));
  assert.doesNotMatch(html, /aria-activedescendant/);
  const moved = citySearchReducer(state, { type: "move", suggestionIds: [], direction: 1 });
  assert.equal(moved.activeCityId, null);
});

test("limits suggestions to ten and hides old results while typing a new term", () => {
  const data = Array.from({ length: 12 }, (_, index) => ({ ...cities[0], id: index + 1 }));
  const query = { data, isError: false };
  assert.deepEqual(getCitySuggestions(query, true, false), data.slice(0, 10));
  assert.equal(data.length, 12);
  assert.deepEqual(getCitySuggestions(query, true, true), []);
  assert.deepEqual(getCitySuggestions(query, false, false), []);
  assert.deepEqual(getCitySuggestions({ ...query, isError: true }, true, false), []);
});

test("Enter selects once, clears the input and stale suggestions, and restores the placeholder", (context) => {
  let state = { ...createProps().state, activeCityId: cities[1].id };
  let activeCity = null;
  const onSelected = context.mock.fn();
  const dispatch = (action) => { state = citySearchReducer(state, action); };
  const onSelectCity = (city) => {
    dispatch({ type: "select", city });
    activeCity = city;
    onSelected(city);
  };
  const pressEnter = (repeat = false) => handleCitySearchKeyDown({
    key: "Enter", repeat, preventDefault() {},
  }, { state, suggestions: cities, dispatch, onSelectCity });
  pressEnter();
  pressEnter(true);
  pressEnter();
  assert.equal(onSelected.mock.callCount(), 1);
  assert.equal(activeCity, cities[1]);
  assert.equal(state.inputValue, "");
  assert.equal(state.searchTerm, "");
  assert.equal(state.isOpen, false);
  const suggestions = getCitySuggestions({ data: cities }, false, true);
  assert.deepEqual(suggestions, []);
  const html = renderToStaticMarkup(createElement(CitySearchContent, createProps({ state, suggestions })));
  assert.match(html, /placeholder="Search city\.\.\."/);
  assert.match(html, /value=""/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /role="listbox"|aria-activedescendant/);
});

test("mouse and touch pointer selection clear only search state and retain the chosen city", (context) => {
  for (const pointerType of ["mouse", "touch"]) {
    let state = createProps().state;
    let activeCity = cities[0];
    const selected = context.mock.fn();
    const onSelectCity = (city) => {
      state = citySearchReducer(state, { type: "select", city });
      activeCity = city;
      selected(city);
    };
    const tree = CitySearchContent(createProps({ state, onSelectCity }));
    const option = findElements(tree, (element) => element.props?.role === "option")[1];
    const preventDefault = context.mock.fn();
    option.props.onPointerDown({ pointerType, preventDefault });
    option.props.onClick();
    assert.equal(preventDefault.mock.callCount(), 1);
    assert.equal(selected.mock.callCount(), 1);
    assert.equal(activeCity, cities[1]);
    assert.deepEqual(state, initialCitySearchState);
  }
});

test("Enter cannot submit empty, unmatched, closed or repeating searches", (context) => {
  const onSelectCity = context.mock.fn();
  for (const [state, suggestions, repeat] of [
    [initialCitySearchState, [], false],
    [createProps().state, [], false],
    [{ ...createProps().state, activeCityId: 999 }, cities, false],
    [{ ...createProps().state, activeCityId: 1, isOpen: false }, cities, false],
    [{ ...createProps().state, activeCityId: 1 }, cities, true],
  ]) {
    const preventDefault = context.mock.fn();
    handleCitySearchKeyDown({ key: "Enter", repeat, preventDefault }, {
      state, suggestions, dispatch() {}, onSelectCity,
    });
    assert.equal(preventDefault.mock.callCount(), 1);
  }
  assert.equal(onSelectCity.mock.callCount(), 0);
});
