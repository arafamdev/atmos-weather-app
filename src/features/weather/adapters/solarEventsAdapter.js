import { getApiCalendarDate, getLocalWeatherTime, getWeatherTimestamp } from "../utils/weatherTimestamp.js";

export function adaptSolarEvents(daily, offsetSeconds, formatter) {
  if (!Array.isArray(daily?.time)) return [];
  const events = [];
  const ids = new Set();

  for (const type of ["sunrise", "sunset"]) {
    const values = daily[type];
    if (!Array.isArray(values) || values.length !== daily.time.length) continue;
    values.forEach((value, index) => {
      if (value == null) return;
      try {
        const timestamp = getWeatherTimestamp(value, offsetSeconds, `daily.${type}`);
        const local = getLocalWeatherTime(timestamp, formatter);
        const date = getApiCalendarDate(daily.time[index], offsetSeconds);
        const id = `${type}:${timestamp}`;
        // Validate the API's fixed-offset daily bucket, then group by the true local date.
        if (getApiCalendarDate(timestamp, offsetSeconds) !== date || ids.has(id)) return;
        ids.add(id);
        events.push({ type, timestamp, ...local, dateTime: new Date(timestamp * 1000).toISOString() });
      } catch {
        // Invalid optional solar events must not hide valid weather measurements.
      }
    });
  }
  return events.sort((first, second) => first.timestamp - second.timestamp);
}
