import { adaptSolarEvents } from "./solarEventsAdapter.js";
import { getWeatherCondition } from "./weatherConditions.js";
import { getLocalWeatherTime, getWeatherTimestamp } from "../utils/weatherTimestamp.js";

function optionalNumber(value, field, minimum = -Infinity, maximum = Infinity) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid hourly weather data: ${field} is outside its valid numeric range.`);
  }
  return value;
}

export function adaptHourlyForecast(data, timezone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
  });
  function localParts(timestamp) {
    return getLocalWeatherTime(timestamp, formatter);
  }
  const currentTimestamp = getWeatherTimestamp(data.current.time, data.utc_offset_seconds, "current.time");
  const date = localParts(currentTimestamp).date;
  const hourly = data.hourly;
  if (!Array.isArray(hourly?.time)) throw new Error("Invalid hourly weather data: time must be an array.");
  for (const field of ["temperature_2m", "weather_code", "precipitation_probability", "is_day"]) {
    if (hourly[field] != null && (!Array.isArray(hourly[field]) || hourly[field].length !== hourly.time.length)) {
      throw new Error(`Invalid hourly weather data: ${field} must align with time.`);
    }
  }
  if (data.hourly_units?.temperature_2m !== "°C" || data.hourly_units?.precipitation_probability !== "%") {
    throw new Error("Invalid hourly weather data: expected °C and % units.");
  }
  const timeUnit = data.hourly_units?.time;
  if (hourly.time.some((value) => typeof value !== (timeUnit === "unixtime" ? "number" : "string")) ||
    !["unixtime", "iso8601"].includes(timeUnit)) {
    throw new Error("Invalid hourly weather data: timestamps must match their declared time unit.");
  }
  let previousTimestamp;
  const entries = hourly.time.map((value, index) => {
    const timestamp = getWeatherTimestamp(value, data.utc_offset_seconds, `hourly.time[${index}]`);
    if (previousTimestamp !== undefined && timestamp <= previousTimestamp) {
      throw new Error("Invalid hourly weather data: timestamps must be unique and chronological.");
    }
    previousTimestamp = timestamp;
    return { timestamp, index, ...localParts(timestamp) };
  });

  const solarEvents = adaptSolarEvents(data.daily, data.utc_offset_seconds, formatter);

  function adaptDay(date) {
    const dayEntries = entries.filter((entry) => entry.date === date);
    const forecasts = dayEntries.map(({ timestamp, index, time, offset }) => {
      const temperature = optionalNumber(hourly.temperature_2m?.[index], "temperature_2m");
      const probability = optionalNumber(hourly.precipitation_probability?.[index], "precipitation_probability", 0, 100);
      const code = hourly.weather_code?.[index];
      const isDay = optionalNumber(hourly.is_day?.[index], "is_day", 0, 1);
      if (isDay !== null && !Number.isInteger(isDay)) throw new Error("Invalid hourly weather data: is_day must be 0 or 1.");
      const weather = code == null ? { condition: "Conditions unavailable", WeatherIcon: null }
        : getWeatherCondition(code, isDay !== 0);
      if (isDay === null && [0, 1, 2].includes(code)) weather.WeatherIcon = null;
      const repeatedHour = dayEntries.some((entry) => entry.timestamp !== timestamp && entry.time === time);
      return { timestamp, dateTime: new Date(timestamp * 1000).toISOString(), time,
        timeLabel: repeatedHour ? `${time} ${offset}` : time,
        temperature, probability, ...weather };
    });
    const first = forecasts[0];
    const last = forecasts.at(-1);
    const isPartial = forecasts.some((entry, index) => entry.temperature === null || entry.probability === null ||
      entry.WeatherIcon === null || (index > 0 && entry.timestamp - forecasts[index - 1].timestamp !== 3600)) ||
      (first && localParts(first.timestamp - 3600).date === date) ||
      (last && localParts(last.timestamp + 3600).date === date);

    return { date, forecasts, solarEvents: solarEvents.filter((event) => event.date === date),
      isPartial: Boolean(isPartial), error: false };
  }

  const days = [...new Set(entries.map((entry) => entry.date))].map(adaptDay);
  return { ...(days.find((day) => day.date === date) ?? adaptDay(date)), days };
}
