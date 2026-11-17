import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { adaptHourlyForecast } from "../adapters/hourlyWeatherAdapter.js";
import { createUnixWeatherData } from "../testing/weatherFixtures.js";

let server;
let HourlyForecastContent;
let WeatherDashboardContent;
before(async () => {
  server = await createServer({
    configFile: false, appType: "custom", esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  ({ HourlyForecastContent } = await server.ssrLoadModule("/src/features/weather/components/HourlyForecast.jsx"));
  ({ WeatherDashboardContent } = await server.ssrLoadModule("/src/features/weather/components/WeatherDashboard.jsx"));
});
after(async () => { await server?.close(); });

function createProps() {
  const data = createUnixWeatherData();
  return { forecast: adaptHourlyForecast(data, data.timezone), location: "Porto, Portugal",
    timezone: data.timezone, now: data.current.time * 1000 };
}
function render(props = createProps()) {
  return renderToStaticMarkup(createElement(HourlyForecastContent, props));
}

test("renders a labelled focusable native scroll region with readable values and decorative icons", () => {
  const html = render();
  assert.match(html, /Hourly forecast/);
  assert.match(html, /Porto, Portugal/);
  assert.match(html, /Europe\/Lisbon/);
  assert.match(html, /17 November 2026/);
  assert.match(html, /role="region" aria-labelledby="[^"]+" aria-describedby="[^"]+" tabindex="0"/);
  assert.match(html, /focus-visible:outline-app-accent/);
  assert.match(html, /Precipitation probability:/);
  assert.match(html, /15°C/);
  assert.match(html, /aria-hidden="true"/);
  assert.equal((html.match(/<li /g) ?? []).length, 26);
  assert.equal((html.match(/aria-current="time"/g) ?? []).length, 1);
  assert.match(html, />NOW</);
});

test("does not highlight an hour outside the cached forecast range", () => {
  const props = createProps();
  props.now += 10 * 86400000;
  assert.doesNotMatch(render(props), /aria-current="time"|>NOW</);
});

test("renders partial values as accessible unavailable labels, never null, NaN or invented zeroes", () => {
  const props = createProps();
  props.forecast.forecasts[0] = { ...props.forecast.forecasts[0], temperature: null,
    probability: null, WeatherIcon: null, condition: "Conditions unavailable" };
  props.forecast.isPartial = true;
  const html = render(props);
  assert.match(html, /Some hours or values are unavailable/);
  assert.match(html, /Temperature unavailable/);
  assert.match(html, /Conditions unavailable/);
  assert.doesNotMatch(html, /null|NaN|undefined/);
});

test("empty and invalid hourly data have explicit status messages without a useless focus stop", () => {
  const props = createProps();
  props.forecast.forecasts = [];
  assert.match(render(props), /No hourly forecast is available/);
  assert.doesNotMatch(render(props), /tabindex="0"/);
  props.forecast.error = true;
  assert.match(render(props), /role="status"/);
  assert.match(render(props), /Hourly forecast is unavailable/);
});

test("repeated autumn hours have distinct UTC datetime attributes and visible offset labels", () => {
  const data = createUnixWeatherData("2026-10-24", 0, 6);
  data.current.time = Date.parse("2026-10-25T12:00:00Z") / 1000;
  const props = { ...createProps(), now: data.current.time * 1000, forecast: adaptHourlyForecast(data, data.timezone) };
  const html = render(props);
  assert.match(html, /01:00 GMT\+1/);
  assert.match(html, /01:00 GMT(?:\+0)?</);
  assert.match(html, /dateTime="2026-10-25T00:00:00.000Z"/);
  assert.match(html, /dateTime="2026-10-25T01:00:00.000Z"/);
});

test("dashboard loading and errors do not render old hourly content; same-city updates retain it", () => {
  const query = { data: undefined, isFetching: true, isError: false, isFetched: false };
  const renderDashboard = () => renderToStaticMarkup(createElement(WeatherDashboardContent, { query }));
  assert.match(renderDashboard(), /Loading weather/);
  assert.doesNotMatch(renderDashboard(), /Hourly forecast/);
  query.isError = true;
  assert.match(renderDashboard(), /Retry/);
  assert.doesNotMatch(renderDashboard(), /Hourly forecast/);
  query.isError = false;
  query.data = adaptWeatherData(createUnixWeatherData());
  assert.match(renderDashboard(), /Hourly forecast/);
  assert.match(renderDashboard(), /Updating weather/);
});

test("scrollbar hiding preserves native overflow and disables smooth scrolling for reduced motion", async () => {
  const css = await readFile(new URL("../../../index.css", import.meta.url), "utf8");
  assert.match(css, /\.hourly-scroll\s*\{[^}]*scrollbar-width: none;[^}]*scroll-behavior: smooth;/);
  assert.match(css, /\.hourly-scroll::-webkit-scrollbar\s*\{\s*display: none;/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*scroll-behavior: auto;/);
  assert.match(render(), /overflow-x-auto/);
  assert.match(css, /contain: inline-size layout paint;/);
  assert.match(render(), /flex w-max min-w-full/);
});

test("the displayed local date and current hour advance using already-cached next-day records", () => {
  const props = createProps();
  props.now = Date.parse("2026-11-18T00:00:00Z");
  const html = render(props);
  assert.match(html, /18 November 2026/);
  assert.doesNotMatch(html, /17 November 2026/);
  assert.equal((html.match(/aria-current="time"/g) ?? []).length, 1);
  assert.match(html, /dateTime="2026-11-18T00:00:00.000Z"/);
  assert.equal((html.match(/<li /g) ?? []).length, 26);
});

test("only the current card exposes NOW with soft blue and dark text/icon tokens", () => {
  const html = render();
  const cards = [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)];
  const current = cards.filter(([, attributes]) => attributes.includes('aria-current="time"'));
  assert.equal(current.length, 1);
  assert.match(current[0][1], /aria-\[current=time\]:bg-app-weather-card/);
  assert.match(current[0][1], /aria-\[current=time\]:text-app-weather-card-text/);
  assert.match(current[0][2], />NOW</);
  assert.match(current[0][2], /group-aria-\[current=time\]:text-app-weather-card-text/);
  for (const [text, attributes, body] of cards) {
    assert.match(attributes, /w-28 shrink-0/);
    assert.match(body, /min-h-4/);
    if (!attributes.includes('aria-current="time"')) {
      assert.doesNotMatch(text, />NOW</);
      if (!attributes.includes("data-solar-event")) assert.match(attributes, /bg-app-background/);
    }
  }
});

test("Sunrise and Sunset are distinct chronological cards with exact times and no hourly measurements", () => {
  const html = render();
  const events = [...html.matchAll(/<li data-solar-event="(sunrise|sunset)"([^>]*)>([\s\S]*?)<\/li>/g)];
  assert.equal(events.length, 2);
  assert.match(events[0][3], />Sunrise</);
  assert.match(events[0][3], />07:15</);
  assert.match(events[1][3], />Sunset</);
  assert.match(events[1][3], />17:32</);
  for (const [, , attributes, body] of events) {
    assert.match(attributes, /border-dashed/);
    assert.match(attributes, /bg-app-surface-hover/);
    assert.doesNotMatch(attributes, /aria-current|tabindex/);
    assert.doesNotMatch(body, /NOW|°C|probability|%/);
    assert.match(body, /aria-hidden="true"/);
  }
  assert.ok(html.indexOf('dateTime="2026-11-17T07:00:00.000Z"') < html.indexOf('data-solar-event="sunrise"'));
  assert.ok(html.indexOf('data-solar-event="sunrise"') < html.indexOf('dateTime="2026-11-17T08:00:00.000Z"'));
  assert.equal((html.match(/aria-current="time"/g) ?? []).length, 1);
});

test("event instants never receive NOW even when they occur within the current hour", () => {
  const props = createProps();
  props.now = Date.parse("2026-11-17T07:15:00Z");
  const event = render(props).match(/<li data-solar-event="sunrise"[\s\S]*?<\/li>/)[0];
  assert.doesNotMatch(event, /aria-current|NOW/);
  assert.equal((render(props).match(/aria-current="time"/g) ?? []).length, 1);
});

test("day rollover renders only the selected day's solar events; missing events are omitted", () => {
  const props = createProps();
  props.now = Date.parse("2026-11-18T12:00:00Z");
  const html = render(props);
  assert.match(html, /dateTime="2026-11-18T07:15:00.000Z"/);
  assert.doesNotMatch(html, /2026-11-17/);
  props.forecast.days.find((day) => day.date === "2026-11-18").solarEvents = [];
  assert.doesNotMatch(render(props), /data-solar-event/);
  assert.equal((render(props).match(/<li /g) ?? []).length, 24);
});

test("missing polar solar events keep all weather sections visible with accessible unavailable text", () => {
  const data = createUnixWeatherData();
  delete data.daily.sunrise;
  data.daily.sunset.fill(null);
  const query = { data: adaptWeatherData(data), isFetching: false, isError: false };
  const html = renderToStaticMarkup(createElement(WeatherDashboardContent, { query }));
  assert.match(html, /Unavailable/);
  assert.match(html, /Hourly forecast/);
  assert.match(html, /Daily forecast/);
  assert.match(html, /Rain probability/);
  assert.doesNotMatch(html, /data-solar-event|dateTime="null"|Retry/);
});
