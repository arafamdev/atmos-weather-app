import assert from "node:assert/strict";
import test from "node:test";

import { adaptHourlyForecast } from "./hourlyWeatherAdapter.js";
import { adaptWeatherData } from "./weatherAdapter.js";
import { createUnixWeatherData } from "../testing/weatherFixtures.js";
import { isCurrentForecastHour, scheduleForecastClock, selectHourlyForecastDay } from "../utils/weatherTimestamp.js";

function localDay(data, date, timezone) {
  data.timezone = timezone;
  data.current.time = Date.parse(`${date}T12:00:00Z`) / 1000;
  return adaptHourlyForecast(data, timezone);
}

test("maps a full local day with real Unix IDs, units, conditions and day/night icons", () => {
  const data = createUnixWeatherData();
  const result = adaptHourlyForecast(data, data.timezone);
  assert.equal(result.date, "2026-11-17");
  assert.equal(result.forecasts.length, 24);
  assert.equal(result.forecasts[0].time, "00:00");
  assert.equal(result.forecasts.at(-1).time, "23:00");
  assert.equal(result.forecasts[0].temperature, 15);
  assert.equal(result.forecasts[0].probability, 0);
  assert.equal(result.forecasts[0].condition, "Partly cloudy");
  assert.notEqual(result.forecasts[0].WeatherIcon, result.forecasts[12].WeatherIcon);
  assert.equal(result.forecasts[0].dateTime, new Date(data.hourly.time[0] * 1000).toISOString());
  assert.equal(result.isPartial, false);
});

test("selects the city's calendar day independently of the browser timezone, including fractional offsets", () => {
  for (const [timezone, offset] of [["Asia/Tokyo", 32400], ["America/New_York", -18000], ["Asia/Kolkata", 19800]]) {
    const data = createUnixWeatherData("2026-11-17", offset, 6);
    data.current.time = data.hourly.time[0] + 1800;
    const result = adaptHourlyForecast(data, timezone);
    assert.equal(result.date, "2026-11-17");
    assert.equal(result.forecasts.length, 24);
    assert.equal(result.forecasts[0].time, "00:00");
  }
});

test("handles 23-hour spring days and 25-hour autumn days with unambiguous repeated labels", () => {
  for (const entry of [
    { timezone: "Europe/Lisbon", start: "2026-03-28", date: "2026-03-29", offset: 0, count: 23 },
    { timezone: "Europe/Lisbon", start: "2026-10-24", date: "2026-10-25", offset: 0, count: 25 },
    { timezone: "America/New_York", start: "2026-03-07", date: "2026-03-08", offset: -18000, count: 23 },
    { timezone: "America/New_York", start: "2026-10-31", date: "2026-11-01", offset: -18000, count: 25 },
    { timezone: "Australia/Sydney", start: "2026-10-03", date: "2026-10-04", offset: 36000, count: 23 },
    { timezone: "Australia/Sydney", start: "2026-04-04", date: "2026-04-05", offset: 36000, count: 25 },
  ]) {
    const data = createUnixWeatherData(entry.start, entry.offset, 6);
    const result = localDay(data, entry.date, entry.timezone);
    assert.equal(result.forecasts.length, entry.count, entry.timezone);
    assert.equal(result.isPartial, false);
    const dashboard = adaptWeatherData(data, { latitude: 0, longitude: 0, timezone: entry.timezone });
    assert.equal(dashboard.hourlyForecast.forecasts.length, entry.count);
    assert.equal(dashboard.dailyForecast.length, 4);
    assert.equal(dashboard.rainProbability.length, 6);
    assert.equal(new Set(result.forecasts.map((hour) => hour.timestamp)).size, entry.count);
    assert.equal(new Set(result.forecasts.map((hour) => hour.timeLabel)).size, entry.count);
    if (entry.count === 25) {
      const repeated = result.forecasts.filter((hour) => hour.timeLabel.includes("GMT"));
      assert.equal(repeated.length, 2);
      assert.equal(repeated[0].time, repeated[1].time);
      assert.notEqual(repeated[0].timeLabel, repeated[1].timeLabel);
      const now = repeated[1].timestamp * 1000 + 15000;
      assert.equal(result.forecasts.filter((hour) => isCurrentForecastHour(hour.timestamp, now)).length, 1);
    }
  }
});

test("current hour uses absolute interval boundaries and does not highlight stale or future days", () => {
  const timestamp = 1794916800;
  assert.equal(isCurrentForecastHour(timestamp, timestamp * 1000), true);
  assert.equal(isCurrentForecastHour(timestamp, timestamp * 1000 + 3599999), true);
  assert.equal(isCurrentForecastHour(timestamp, timestamp * 1000 - 1), false);
  assert.equal(isCurrentForecastHour(timestamp, timestamp * 1000 + 3600000), false);
  assert.equal(isCurrentForecastHour(timestamp, timestamp * 1000 + 86400000), false);
});

test("keeps missing values as null and flags incomplete day coverage without inventing hours", () => {
  const data = createUnixWeatherData();
  data.hourly.temperature_2m[1] = null;
  data.hourly.weather_code[2] = null;
  data.hourly.precipitation_probability[3] = null;
  let result = adaptHourlyForecast(data, data.timezone);
  assert.equal(result.forecasts[1].temperature, null);
  assert.equal(result.forecasts[2].WeatherIcon, null);
  assert.equal(result.forecasts[3].probability, null);
  assert.equal(result.isPartial, true);
  for (const field of Object.keys(data.hourly)) data.hourly[field].splice(0, 1);
  result = adaptHourlyForecast(data, data.timezone);
  assert.equal(result.forecasts.length, 23);
  assert.equal(result.forecasts[0].time, "01:00");
  assert.equal(result.isPartial, true);
});

test("missing series and inner gaps are explicit partial data; empty series stay empty", () => {
  const data = createUnixWeatherData();
  delete data.hourly.temperature_2m;
  assert.equal(adaptHourlyForecast(data, data.timezone).forecasts[0].temperature, null);
  for (const field of Object.keys(data.hourly)) data.hourly[field].splice(5, 1);
  assert.equal(adaptHourlyForecast(data, data.timezone).isPartial, true);
  for (const field of Object.keys(data.hourly)) data.hourly[field] = [];
  assert.deepEqual(adaptHourlyForecast(data, data.timezone).forecasts, []);
});

test("rejects malformed, out-of-order, duplicate timestamps, misaligned arrays, units and invalid values", () => {
  const mutations = [
    (data) => { data.hourly.time[1] = data.hourly.time[0]; },
    (data) => { data.hourly.time.reverse(); },
    (data) => { data.hourly.time[0] = NaN; },
    (data) => { data.hourly.temperature_2m.pop(); },
    (data) => { data.hourly.temperature_2m[0] = Infinity; },
    (data) => { data.hourly.precipitation_probability[0] = 101; },
    (data) => { data.hourly.weather_code[0] = -1; },
    (data) => { data.hourly.is_day[0] = 0.5; },
    (data) => { data.hourly_units.temperature_2m = "°F"; },
    (data) => { data.hourly_units.time = "milliseconds"; },
  ];
  for (const mutate of mutations) {
    const data = createUnixWeatherData();
    mutate(data);
    assert.throws(() => adaptHourlyForecast(data, data.timezone), /Invalid/);
  }
});

test("Unix responses preserve current, daily, precipitation and hourly dashboard contracts", () => {
  const data = createUnixWeatherData();
  const result = adaptWeatherData(data);
  assert.equal(result.currentWeather.sunrise, "07:15");
  assert.equal(result.dailyForecast.length, 4);
  assert.equal(result.dailyForecast[0].id, "2026-11-18");
  assert.equal(result.rainProbability.length, 6);
  assert.equal(result.hourlyForecast.forecasts.length, 24);
  data.hourly.temperature_2m[0] = Infinity;
  const partial = adaptWeatherData(data);
  assert.equal(partial.hourlyForecast.error, true);
  assert.equal(partial.currentWeather.temperature, 18.5);
  assert.equal(partial.dailyForecast.length, 4);
});


test("local midnight selects the next cached day without another API request", () => {
  const data = createUnixWeatherData("2026-11-17", 32400);
  data.timezone = "Asia/Tokyo";
  const forecast = adaptHourlyForecast(data, data.timezone);
  const before = selectHourlyForecastDay(forecast, data.timezone, Date.parse("2026-11-17T14:59:59Z"));
  const after = selectHourlyForecastDay(forecast, data.timezone, Date.parse("2026-11-17T15:00:00Z"));
  assert.equal(before.date, "2026-11-17");
  assert.equal(after.date, "2026-11-18");
  assert.equal(after.forecasts.length, 24);
  assert.equal(after.forecasts[0].time, "00:00");
  assert.equal(after.forecasts.filter((hour) => isCurrentForecastHour(hour.timestamp, Date.parse("2026-11-17T15:00:00Z"))).length, 1);
  const expired = selectHourlyForecastDay(forecast, data.timezone, Date.parse("2026-12-01T00:00:00Z"));
  assert.equal(expired.date, "2026-12-01");
  assert.deepEqual(expired.forecasts, []);
});

test("cached day selection preserves 23/25-hour DST days and repeated-hour highlighting", () => {
  for (const [start, date, count] of [["2026-03-28", "2026-03-29", 23], ["2026-10-24", "2026-10-25", 25]]) {
    const data = createUnixWeatherData(start, 0, 6);
    const forecast = adaptHourlyForecast(data, data.timezone);
    const selected = selectHourlyForecastDay(forecast, data.timezone, Date.parse(`${date}T12:00:00Z`));
    assert.equal(selected.date, date);
    assert.equal(selected.forecasts.length, count);
    assert.equal(selected.isPartial, false);
  }
});

test("clock ticks at the next minute boundary and stops on cleanup", (context) => {
  const start = Date.parse("2026-11-17T23:59:55Z");
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: start });
  const onTick = context.mock.fn();
  const cleanup = scheduleForecastClock(onTick);
  context.mock.timers.tick(4999);
  assert.equal(onTick.mock.callCount(), 0);
  context.mock.timers.tick(1);
  assert.equal(onTick.mock.callCount(), 1);
  assert.equal(onTick.mock.calls[0].arguments[0], start + 5000);
  context.mock.timers.tick(60000);
  assert.equal(onTick.mock.callCount(), 2);
  cleanup();
  context.mock.timers.tick(60000);
  assert.equal(onTick.mock.callCount(), 2);
});
