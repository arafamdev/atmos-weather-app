import assert from "node:assert/strict";
import test from "node:test";
import { CircleHelp, CloudMoon, CloudRain, Moon, Sun } from "lucide-react";

import { adaptWeatherData } from "./weatherAdapter.js";
import { getWeatherCondition } from "./weatherConditions.js";
import { createWeatherData } from "../testing/weatherFixtures.js";

test("adapts existing prop contracts without mutating the API response", () => {
  const data = createWeatherData();
  const original = structuredClone(data);
  const result = adaptWeatherData(data);

  assert.deepEqual(result.currentWeather, {
    location: "Porto, Portugal",
    dayLabel: "Tuesday",
    temperature: 18.5,
    feelsLike: 16,
    condition: "Partly cloudy",
    humidity: 64,
    windSpeed: 12,
    sunrise: "07:15",
    sunset: "17:32",
  });
  assert.equal(result.CurrentWeatherIcon, getWeatherCondition(2).WeatherIcon);
  assert.equal(result.location, "Porto, Portugal");
  assert.equal(result.timezone, "Europe/Lisbon");
  assert.equal(result.dailyForecast.length, 4);
  assert.deepEqual(result.dailyForecast[0], {
    id: "2026-11-18",
    dayLabel: "Wednesday",
    condition: "Clear sky",
    WeatherIcon: Sun,
    highTemperature: 21,
    lowTemperature: 11,
  });
  assert.equal(result.dailyForecast[1].WeatherIcon, CloudRain);
  assert.deepEqual(result.rainProbability.map(({ time }) => time), [
    "00:00", "04:00", "08:00", "12:00", "16:00", "20:00",
  ]);
  assert.deepEqual(data, original);
});

test("maps documented WMO codes and provides a neutral unknown condition", () => {
  const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
    71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99];
  for (const code of codes) {
    const result = getWeatherCondition(code);
    assert.notEqual(result.condition, "Unknown conditions");
    assert.ok(result.WeatherIcon);
  }
  assert.deepEqual(getWeatherCondition(123), {
    condition: "Unknown conditions", WeatherIcon: CircleHelp,
  });
  for (const code of [null, undefined, "2", -1, 2.5, NaN, Infinity]) {
    assert.throws(() => getWeatherCondition(code), /weather_code/);
  }
});

test("uses night icons for current conditions and day icons for daily forecasts", () => {
  const data = createWeatherData();
  data.current.is_day = 0;
  assert.equal(adaptWeatherData(data).CurrentWeatherIcon, CloudMoon);
  data.current.weather_code = 0;
  assert.equal(adaptWeatherData(data).CurrentWeatherIcon, Moon);
  assert.equal(adaptWeatherData(data).dailyForecast[0].WeatherIcon, Sun);
});

test("preserves numeric zero, valid percentage limits, and negative temperatures", () => {
  const data = createWeatherData();
  Object.assign(data.current, {
    temperature_2m: -2.5, apparent_temperature: -5, wind_speed_10m: 0,
    relative_humidity_2m: 0,
  });
  data.hourly.precipitation_probability[4] = 100;
  const result = adaptWeatherData(data);
  assert.equal(result.currentWeather.temperature, -2.5);
  assert.equal(result.currentWeather.windSpeed, 0);
  assert.equal(result.currentWeather.humidity, 0);
  assert.equal(result.rainProbability[0].probability, 0);
  assert.equal(result.rainProbability[1].probability, 100);
});

test("rejects missing, non-numeric, non-finite, and out-of-range values", () => {
  for (const value of [null, undefined, "18", NaN, Infinity, -Infinity]) {
    const data = createWeatherData();
    data.current.temperature_2m = value;
    assert.throws(() => adaptWeatherData(data), /current.temperature_2m/);
  }
  for (const value of [null, "20", -1, 101, Infinity]) {
    const data = createWeatherData();
    data.hourly.precipitation_probability[0] = value;
    assert.throws(() => adaptWeatherData(data), /hourly.precipitation_probability/);
  }
  for (const [field, value] of [
    ["relative_humidity_2m", -1], ["relative_humidity_2m", 101],
    ["wind_speed_10m", -1], ["apparent_temperature", null], ["is_day", null],
  ]) {
    const data = createWeatherData();
    data.current[field] = value;
    assert.throws(() => adaptWeatherData(data), new RegExp(field));
  }
});

test("rejects absent sections, mismatched arrays, and missing current or future days", () => {
  for (const section of ["current", "daily", "hourly"]) {
    const data = createWeatherData();
    delete data[section];
    assert.throws(() => adaptWeatherData(data), /Invalid weather data/);
  }
  const data = createWeatherData();
  data.daily.temperature_2m_max.pop();
  assert.throws(() => adaptWeatherData(data), /daily.temperature_2m_max must align/);

  const missingDay = createWeatherData();
  missingDay.current.time = "2026-11-16T12:00";
  assert.throws(() => adaptWeatherData(missingDay), /missing the current local day/);
  const missingFuture = createWeatherData();
  missingFuture.current.time = "2026-11-18T12:00";
  assert.throws(() => adaptWeatherData(missingFuture), /next four days/);
});

test("rejects impossible dates, invalid times, duplicate dates, and inverted temperatures", () => {
  for (const timestamp of ["2026-02-30T12:00", "2026-11-17T24:00", "2026-11-17T12:60", "2026-11-17T12:00Z"]) {
    const data = createWeatherData();
    data.current.time = timestamp;
    assert.throws(() => adaptWeatherData(data), /current.time/);
  }
  const data = createWeatherData();
  data.daily.time[1] = data.daily.time[0];
  assert.throws(() => adaptWeatherData(data), /unique and chronological/);
  const inverted = createWeatherData();
  inverted.daily.temperature_2m_min[0] = 30;
  assert.throws(() => adaptWeatherData(inverted), /temperatures are inverted/);
  const missingSunrise = createWeatherData();
  missingSunrise.daily.sunrise[0] = null;
  assert.equal(adaptWeatherData(missingSunrise).currentWeather.sunrise, null);
});

test("rejects unexpected timezones, offsets, and units instead of mislabelling values", () => {
  for (const data of [null, {}, { ...createWeatherData(), timezone: "UTC" }]) {
    assert.throws(() => adaptWeatherData(data), /timezone/);
  }
  for (const offset of [undefined, "0", 0.5, 60000]) {
    const data = createWeatherData();
    data.utc_offset_seconds = offset;
    assert.throws(() => adaptWeatherData(data), /utc_offset_seconds/);
  }
  const data = createWeatherData();
  data.current_units.temperature_2m = "°F";
  assert.throws(() => adaptWeatherData(data), /requires °C/);
});

test("handles winter, summer, midnight, and calendar year changes independently of host timezone", () => {
  const summer = createWeatherData("2026-07-01", 3600);
  summer.current.time = "2026-07-01T00:15";
  const result = adaptWeatherData(summer);
  assert.equal(result.currentWeather.dayLabel, "Wednesday");
  assert.equal(result.currentWeather.sunrise, "07:15");
  assert.equal(result.rainProbability[0].time, "00:00");

  const newYear = adaptWeatherData(createWeatherData("2026-12-31"));
  assert.equal(newYear.dailyForecast[0].id, "2027-01-01");
  assert.equal(newYear.dailyForecast[0].dayLabel, "Friday");
});

test("corrects fixed-offset timestamps on both DST transition days", () => {
  const spring = createWeatherData("2026-03-29", 0);
  spring.hourly.precipitation_probability[3] = 75;
  const springResult = adaptWeatherData(spring);
  assert.equal(springResult.currentWeather.sunrise, "08:15");
  assert.equal(springResult.currentWeather.sunset, "18:32");
  assert.deepEqual(springResult.rainProbability[1], { time: "04:00", probability: 75 });

  const autumn = createWeatherData("2026-10-25", 3600);
  autumn.hourly.precipitation_probability[5] = 45;
  const autumnResult = adaptWeatherData(autumn);
  assert.equal(autumnResult.currentWeather.sunrise, "06:15");
  assert.equal(autumnResult.currentWeather.sunset, "16:32");
  assert.deepEqual(autumnResult.rainProbability[1], { time: "04:00", probability: 45 });
});

test("accepts leap days and rejects a day missing its midnight slot after an offset change", () => {
  assert.equal(adaptWeatherData(createWeatherData("2028-02-29")).currentWeather.dayLabel, "Tuesday");
  const autumn = createWeatherData("2026-10-25", 0);
  assert.throws(() => adaptWeatherData(autumn), /six four-hour slots/);
});

test("includes Lisbon midnight after autumn DST when the service supplies the previous day", () => {
  const data = createWeatherData("2026-10-24", 0, 6);
  data.current.time = "2026-10-25T12:00";
  data.hourly.precipitation_probability[23] = 75;
  const result = adaptWeatherData(data);
  assert.equal(result.currentWeather.dayLabel, "Sunday");
  assert.deepEqual(result.rainProbability[0], { time: "00:00", probability: 75 });
  assert.equal(result.rainProbability.length, 6);
  assert.equal(result.dailyForecast[0].id, "2026-10-26");
  assert.equal(result.dailyForecast[3].id, "2026-10-29");
});

test("rejects invalid daily dates, misaligned or duplicate hours, and incorrect solar dates", () => {
  const invalidDate = createWeatherData();
  invalidDate.daily.time[4] = "2026-11-31";
  assert.throws(() => adaptWeatherData(invalidDate), /impossible date/);
  const duplicateHour = createWeatherData();
  duplicateHour.hourly.time[1] = duplicateHour.hourly.time[0];
  assert.throws(() => adaptWeatherData(duplicateHour), /unique and chronological/);
  const misaligned = createWeatherData();
  misaligned.hourly.precipitation_probability.pop();
  assert.throws(() => adaptWeatherData(misaligned), /hourly.precipitation_probability must align/);
  const wrongSunrise = createWeatherData();
  wrongSunrise.daily.sunrise[0] = "2026-11-18T07:15";
  assert.equal(adaptWeatherData(wrongSunrise).currentWeather.sunrise, null);
});

test("rejects missing chart slots and invalid future values explicitly", () => {
  const missingSlot = createWeatherData();
  missingSlot.hourly.time.shift();
  missingSlot.hourly.precipitation_probability.shift();
  assert.throws(() => adaptWeatherData(missingSlot), /six four-hour slots/);
  const invalidFuture = createWeatherData();
  invalidFuture.daily.temperature_2m_max[4] = null;
  assert.throws(() => adaptWeatherData(invalidFuture), /daily.temperature_2m_max/);
  const missingCalendarDay = createWeatherData();
  missingCalendarDay.daily.time[4] = "2026-11-22";
  assert.throws(() => adaptWeatherData(missingCalendarDay), /consecutive calendar days/);
});

test("adapts labels and timestamps for multiple requested locations", () => {
  const locations = [
    { name: "Paris", country: "France", latitude: 48.85, longitude: 2.35,
      timezone: "Europe/Paris", offset: 3600 },
    { name: "New York", country: "United States", latitude: 40.71, longitude: -74,
      timezone: "America/New_York", offset: -18000 },
    { name: "Tokyo", country: "Japan", latitude: 35.67, longitude: 139.65,
      timezone: "Asia/Tokyo", offset: 32400 },
    { name: "Kolkata", country: "India", latitude: 22.57, longitude: 88.36,
      timezone: "Asia/Kolkata", offset: 19800 },
  ];
  for (const location of locations) {
    const data = createWeatherData("2026-11-17", location.offset);
    data.timezone = location.timezone;
    const result = adaptWeatherData(data, Object.freeze(location));
    assert.equal(result.location, `${location.name}, ${location.country}`);
    assert.equal(result.currentWeather.location, result.location);
    assert.equal(result.currentWeather.dayLabel, "Tuesday");
    assert.equal(result.currentWeather.sunrise, "07:15");
    assert.equal(result.rainProbability.length, 6);
    assert.equal(result.rainProbability[0].time, "00:00");
    assert.equal(result.dailyForecast[0].id, "2026-11-18");
    assert.equal(result.currentWeather.location, result.location);
  }
});

test("validates the requested timezone, response timezone and optional labels explicitly", () => {
  const location = { latitude: 48.85, longitude: 2.35, timezone: "Europe/Paris" };
  const data = { ...createWeatherData("2026-11-17", 3600), timezone: "Europe/Paris" };
  assert.equal(adaptWeatherData(data, location).location, "48.85, 2.35");
  assert.throws(() => adaptWeatherData(data, { ...location, timezone: null }), /timezone is required/);
  assert.throws(() => adaptWeatherData({ ...data, timezone: null }, location), /timezone/);
  assert.throws(() => adaptWeatherData(createWeatherData(), location), /timezone must be Europe\/Paris/);
  assert.throws(() => adaptWeatherData(data, { ...location, name: 123 }), /name must be a string/);

  const porto = { name: "Porto", admin1: "Porto", country: "Portugal",
    latitude: 41.1496, longitude: -8.6109, timezone: "Europe/Lisbon" };
  assert.equal(adaptWeatherData(createWeatherData(), porto).location, "Porto, Portugal");
});

test("handles equivalent timezone aliases without mismatching the response", () => {
  const data = { ...createWeatherData("2026-11-17", 19800), timezone: "Asia/Kolkata" };
  const location = { latitude: 22.57, longitude: 88.36, timezone: "Asia/Calcutta" };
  assert.equal(adaptWeatherData(data, location).currentWeather.sunrise, "07:15");
});

test("preserves DST correction and midnight coverage in New York and Sydney", () => {
  const cases = [
    { start: "2026-03-07", today: "2026-03-08", timezone: "America/New_York",
      latitude: 40.71, longitude: -74, offset: -18000, sunrise: "08:15" },
    { start: "2026-10-31", today: "2026-11-01", timezone: "America/New_York",
      latitude: 40.71, longitude: -74, offset: -18000, sunrise: "07:15" },
    { start: "2026-10-03", today: "2026-10-04", timezone: "Australia/Sydney",
      latitude: -33.86, longitude: 151.2, offset: 36000, sunrise: "08:15" },
    { start: "2026-04-04", today: "2026-04-05", timezone: "Australia/Sydney",
      latitude: -33.86, longitude: 151.2, offset: 36000, sunrise: "07:15" },
  ];
  for (const location of cases) {
    const data = createWeatherData(location.start, location.offset, 6);
    data.timezone = location.timezone;
    data.current.time = `${location.today}T12:00`;
    const result = adaptWeatherData(data, location);
    assert.equal(result.currentWeather.sunrise, location.sunrise);
    assert.equal(result.rainProbability[0].time, "00:00");
    assert.equal(result.rainProbability.length, 6);
    assert.equal(result.dailyForecast.length, 4);
  }
});
