import {
  DEFAULT_WEATHER_LOCATION,
  validateWeatherLocation,
} from "../utils/weatherLocation.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const currentVariables = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "weather_code",
  "wind_speed_10m",
  "is_day",
];

const dailyWeatherVariables = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
];
const dailyVariables = [...dailyWeatherVariables, "sunrise", "sunset"];

function hasExpectedWeatherData(data) {
  return (
    (typeof data?.current?.time === "string" || Number.isSafeInteger(data?.current?.time)) &&
    currentVariables.every((variable) => Object.hasOwn(data.current, variable)) &&
    Array.isArray(data?.daily?.time) &&
    data.daily.time.length > 0 &&
    dailyWeatherVariables.every(
      (variable) =>
        Array.isArray(data.daily[variable]) &&
        data.daily[variable].length === data.daily.time.length,
    ) &&
    Array.isArray(data?.hourly?.time) &&
    data.hourly.time.length > 0 &&
    Array.isArray(data.hourly.precipitation_probability) &&
    data.hourly.precipitation_probability.length === data.hourly.time.length
  );
}

// Return the API payload unchanged; presentation mapping belongs outside this service.
export async function fetchWeather(location = DEFAULT_WEATHER_LOCATION, { signal } = {}) {
  signal?.throwIfAborted();
  const { latitude, longitude, timezone } = validateWeatherLocation(location);
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    current: currentVariables.join(","),
    daily: dailyVariables.join(","),
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    timeformat: "unixtime",
    // Include local midnight when the response offset changes after DST.
    past_days: "1",
    forecast_days: "5",
  });

  let response;

  try {
    response = await fetch(`${FORECAST_URL}?${parameters}`, { signal });
  } catch (error) {
    if (signal?.aborted || error.name === "AbortError") {
      throw error;
    }

    throw new Error("Unable to reach Open-Meteo. Check your connection.", {
      cause: error,
    });
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    if (signal?.aborted || error.name === "AbortError") {
      throw error;
    }

    const message = response.ok
      ? "Open-Meteo returned invalid JSON."
      : `Open-Meteo request failed (HTTP ${response.status}).`;

    throw new Error(message, { cause: error });
  }

  if (!response.ok || data?.error === true) {
    const reason = typeof data?.reason === "string" ? ` ${data.reason}` : "";
    throw new Error(
      `Open-Meteo request failed (HTTP ${response.status}).${reason}`,
    );
  }

  if (!hasExpectedWeatherData(data)) {
    throw new Error("Open-Meteo returned an unexpected weather data structure.");
  }

  return data;
}

export function fetchPortoWeather({ signal } = {}) {
  return fetchWeather(DEFAULT_WEATHER_LOCATION, { signal });
}
