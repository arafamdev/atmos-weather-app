const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const currentVariables = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "weather_code",
  "wind_speed_10m",
  "is_day",
];

const dailyVariables = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
];

function hasExpectedWeatherData(data) {
  return (
    typeof data?.current?.time === "string" &&
    currentVariables.every((variable) => Object.hasOwn(data.current, variable)) &&
    Array.isArray(data?.daily?.time) &&
    data.daily.time.length > 0 &&
    dailyVariables.every(
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
export async function fetchPortoWeather({ signal } = {}) {
  const parameters = new URLSearchParams({
    latitude: "41.1496",
    longitude: "-8.6109",
    timezone: "Europe/Lisbon",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    current: currentVariables.join(","),
    daily: dailyVariables.join(","),
    hourly: "precipitation_probability",
    // Include midnight in Lisbon when the response offset changes after DST.
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
