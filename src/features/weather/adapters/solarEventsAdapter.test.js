import assert from "node:assert/strict";
import test from "node:test";

import { adaptHourlyForecast } from "./hourlyWeatherAdapter.js";
import { adaptWeatherData } from "./weatherAdapter.js";
import { fetchWeather } from "../services/weatherService.js";
import { createUnixWeatherData, createWeatherData } from "../testing/weatherFixtures.js";
import { mergeHourlyTimeline, selectHourlyForecastDay } from "../utils/weatherTimestamp.js";

function timeline(data, timezone = data.timezone) {
  const day = adaptHourlyForecast(data, timezone);
  return mergeHourlyTimeline(day.forecasts, day.solarEvents);
}

test("inserts real solar instants between hourly measurements without fabricating weather values", () => {
  const data = createUnixWeatherData();
  const result = timeline(data);
  assert.equal(result.length, 26);
  const index = result.findIndex((entry) => entry.type === "sunrise");
  assert.equal(result[index - 1].time, "07:00");
  assert.equal(result[index].time, "07:15");
  assert.equal(result[index + 1].time, "08:00");
  assert.equal(result[index].timestamp, data.daily.sunrise[0]);
  assert.equal(result[index].dateTime, "2026-11-17T07:15:00.000Z");
  assert.equal(Object.hasOwn(result[index], "temperature"), false);
  assert.equal(Object.hasOwn(result[index], "probability"), false);
  assert.ok(result.every((entry, i) => i === 0 || entry.timestamp >= result[i - 1].timestamp));
});

test("events at an exact hourly boundary retain distinct identities and deterministic ordering", () => {
  const data = createUnixWeatherData();
  data.daily.sunrise[0] = data.hourly.time[7];
  const entries = timeline(data).filter((entry) => entry.timestamp === data.hourly.time[7]);
  assert.deepEqual(entries.map((entry) => entry.type), ["hour", "sunrise"]);
});

test("formats solar events in Tokyo and New York, preserving minutes and API instants", () => {
  for (const [timezone, offset] of [["Asia/Tokyo", 32400], ["America/New_York", -18000]]) {
    const data = createUnixWeatherData("2026-11-17", offset);
    data.timezone = timezone;
    const result = adaptHourlyForecast(data, timezone);
    assert.deepEqual(result.solarEvents.map((event) => event.time), ["07:15", "17:32"]);
    assert.equal(result.solarEvents[0].timestamp, data.daily.sunrise[0]);
    assert.ok(result.solarEvents.every((event) => event.date === result.date));
  }
});

test("fixed-offset legacy ISO timestamps are converted explicitly, not read in the host timezone", () => {
  const data = createWeatherData("2026-11-17", 32400);
  data.timezone = "Asia/Tokyo";
  const result = adaptHourlyForecast(data, data.timezone);
  assert.equal(result.solarEvents[0].time, "07:15");
  assert.equal(result.solarEvents[0].dateTime, "2026-11-16T22:15:00.000Z");
});

test("DST spring and autumn events use the correct offset and remain in chronological order", () => {
  for (const [start, day, expected, count] of [
    ["2026-03-28", "2026-03-29", "08:15", 23],
    ["2026-10-24", "2026-10-25", "07:15", 25],
  ]) {
    const data = createUnixWeatherData(start, 0, 6);
    const forecast = adaptHourlyForecast(data, data.timezone);
    const selected = selectHourlyForecastDay(forecast, data.timezone, Date.parse(`${day}T12:00:00Z`));
    assert.equal(selected.forecasts.length, count);
    assert.equal(selected.solarEvents.length, 2);
    assert.equal(selected.solarEvents[0].time, expected);
    assert.ok(selected.solarEvents.every((event) => event.date === day));
  }
});

test("repeated local hours are ordered by UTC instant, including an event in the second occurrence", () => {
  const data = createUnixWeatherData("2026-10-24", 0, 6);
  data.daily.sunrise[1] = Date.parse("2026-10-25T01:30:00Z") / 1000;
  const forecast = adaptHourlyForecast(data, data.timezone);
  const selected = selectHourlyForecastDay(forecast, data.timezone, Date.parse("2026-10-25T12:00:00Z"));
  const result = mergeHourlyTimeline(selected.forecasts, selected.solarEvents);
  const index = result.findIndex((entry) => entry.type === "sunrise");
  assert.match(result[index - 1].timeLabel, /01:00 GMT(?:\+0)?$/);
  assert.equal(result[index].time, "01:30");
  assert.equal(result[index + 1].time, "02:00");
});

test("null, absent, malformed, zero and wrong-day solar events never hide valid weather", () => {
  for (const invalid of [null, undefined, "invalid", NaN, 0, "2026-02-30T10:00", Date.parse("2026-11-18T07:15:00Z") / 1000]) {
    const data = createUnixWeatherData();
    data.daily.sunrise[0] = invalid;
    const result = adaptWeatherData(data);
    assert.equal(result.currentWeather.sunrise, null);
    assert.equal(result.currentWeather.sunset, "17:32");
    assert.deepEqual(result.hourlyForecast.solarEvents.map((event) => event.type), ["sunset"]);
    assert.equal(result.hourlyForecast.forecasts.length, 24);
    assert.equal(result.hourlyForecast.error, false);
  }
});

test("missing or misaligned solar arrays are omitted while core daily validation remains strict", () => {
  for (const mutate of [
    (data) => { delete data.daily.sunrise; },
    (data) => { data.daily.sunrise = null; },
    (data) => { data.daily.sunrise = "invalid"; },
    (data) => { data.daily.sunrise.pop(); },
  ]) {
    const data = createUnixWeatherData();
    mutate(data);
    assert.equal(adaptWeatherData(data).currentWeather.sunrise, null);
    assert.deepEqual(adaptHourlyForecast(data, data.timezone).solarEvents.map((event) => event.type), ["sunset"]);
  }
});

test("polar night and midnight sun omit absent solar events without inventing local times", () => {
  for (const [date, offset, isDay] of [["2026-11-17", 3600, 0], ["2026-06-17", 7200, 1]]) {
    const data = createUnixWeatherData(date, offset);
    data.timezone = "Arctic/Longyearbyen";
    data.daily.sunrise.fill(null);
    data.daily.sunset.fill(null);
    data.hourly.is_day.fill(isDay);
    const result = adaptWeatherData(data, { latitude: 78.22, longitude: 15.64, timezone: data.timezone });
    assert.equal(result.currentWeather.sunrise, null);
    assert.equal(result.currentWeather.sunset, null);
    assert.equal(result.dailyForecast.length, 4);
    assert.equal(result.hourlyForecast.forecasts.length, 24);
    assert.deepEqual(result.hourlyForecast.solarEvents, []);
  }
});

test("a solar instant near a DST day boundary belongs to its actual IANA calendar day", () => {
  const data = createUnixWeatherData("2026-10-24", 0, 6);
  data.daily.sunrise[0] = Date.parse("2026-10-24T23:30:00Z") / 1000;
  const forecast = adaptHourlyForecast(data, data.timezone);
  assert.equal(forecast.solarEvents.some((event) => event.timestamp === data.daily.sunrise[0]), false);
  const next = selectHourlyForecastDay(forecast, data.timezone, Date.parse("2026-10-25T12:00:00Z"));
  const event = next.solarEvents.find((entry) => entry.timestamp === data.daily.sunrise[0]);
  assert.equal(event.time, "00:30");
  assert.equal(event.date, "2026-10-25");
});


test("service-to-adapter optional solar failures are independent and do not mutate the response", async (context) => {
  for (const type of ["sunrise", "sunset"]) {
    const otherType = type === "sunrise" ? "sunset" : "sunrise";
    for (const invalid of [null, {}, "invalid", [], [null]]) {
      const payload = createUnixWeatherData();
      payload.daily[type] = invalid;
      const original = structuredClone(payload);
      const fetchMock = context.mock.method(globalThis, "fetch", async () => Response.json(payload));
      const response = await fetchWeather();
      const result = adaptWeatherData(response);
      assert.equal(result.currentWeather[type], null);
      assert.equal(typeof result.currentWeather[otherType], "string");
      assert.deepEqual(result.hourlyForecast.solarEvents.map((event) => event.type), [otherType]);
      assert.equal(result.hourlyForecast.forecasts.length, 24);
      assert.equal(result.dailyForecast.length, 4);
      assert.equal(result.rainProbability.length, 6);
      assert.deepEqual(payload, original);
      assert.deepEqual(response, original);
      assert.equal(fetchMock.mock.callCount(), 1);
      fetchMock.mock.restore();
    }
  }
});

test("a long-lived tab beyond the cached forecast window cannot retain old solar events", () => {
  const data = createUnixWeatherData("2026-11-17", 32400);
  data.timezone = "Asia/Tokyo";
  const forecast = adaptHourlyForecast(data, data.timezone);
  const original = structuredClone(forecast.days.map((day) => day.solarEvents));
  const expired = selectHourlyForecastDay(forecast, data.timezone, Date.parse("2026-12-01T00:00:00Z"));
  assert.equal(expired.date, "2026-12-01");
  assert.deepEqual(mergeHourlyTimeline(expired.forecasts, expired.solarEvents), []);
  assert.deepEqual(forecast.days.map((day) => day.solarEvents), original);
});
