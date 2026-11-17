export function getWeatherTimestamp(value, offsetSeconds, field) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value * 1000).getTime())) {
      throw new Error(`Invalid weather data: ${field} must be a valid Unix timestamp.`);
    }
    return value;
  }

  // Retain compatibility with fixed-offset ISO payloads; production requests use Unix time.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error(`Invalid weather data: ${field} must be an ISO local timestamp or Unix timestamp.`);
  }
  const date = new Date(`${value}Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== value) {
    throw new Error(`Invalid weather data: ${field} contains an impossible date or time.`);
  }
  return date.getTime() / 1000 - offsetSeconds;
}

export function isCurrentForecastHour(timestamp, now) {
  return timestamp * 1000 <= now && now < (timestamp + 3600) * 1000;
}

export function selectHourlyForecastDay(forecast, timezone, now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  if (date === forecast.date) return forecast;
  return forecast.days?.find((day) => day.date === date) ?? {
    date, forecasts: [], isPartial: false, error: forecast.error,
  };
}

export function scheduleForecastClock(onTick) {
  let timer;
  function schedule() {
    timer = setTimeout(() => {
      onTick(Date.now());
      schedule();
    }, 60000 - Date.now() % 60000);
  }
  schedule();
  return () => clearTimeout(timer);
}

export function getLocalWeatherTime(timestamp, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(timestamp * 1000)
    .map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`, offset: parts.timeZoneName };
}

export function getApiCalendarDate(value, offsetSeconds) {
  return typeof value === "number"
    ? new Date((getWeatherTimestamp(value, offsetSeconds, "daily.time") + offsetSeconds) * 1000).toISOString().slice(0, 10)
    : value;
}

export function mergeHourlyTimeline(forecasts, solarEvents = []) {
  return [...forecasts.map((hour) => ({ ...hour, type: "hour" })), ...solarEvents]
    .sort((first, second) => first.timestamp - second.timestamp ||
      Number(first.type !== "hour") - Number(second.type !== "hour") ||
      first.type.localeCompare(second.type));
}
