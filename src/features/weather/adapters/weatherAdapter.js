import { adaptHourlyForecast } from "./hourlyWeatherAdapter.js";
import { adaptSolarEvents } from "./solarEventsAdapter.js";
import { getWeatherCondition } from "./weatherConditions.js";
import {
  DEFAULT_WEATHER_LOCATION,
  getWeatherLocationLabel,
  normalizeWeatherTimezone,
  validateWeatherLocation,
} from "../utils/weatherLocation.js";
import { getApiCalendarDate, getLocalWeatherTime, getWeatherTimestamp } from "../utils/weatherTimestamp.js";

const dailyFields = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
];
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "long",
});

function invalidData(message) {
  throw new Error(`Invalid weather data: ${message}.`);
}

function requireNumber(value, field, minimum = -Infinity, maximum = Infinity) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    invalidData(
      `${field} must be a finite number between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function parseCalendarDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalidData(`${field} must be a YYYY-MM-DD date`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    invalidData(`${field} contains an impossible date`);
  }
  return date;
}

function getLocalDateTime(value, offsetSeconds, field, localDateTimeFormatter) {
  return getLocalWeatherTime(getWeatherTimestamp(value, offsetSeconds, field), localDateTimeFormatter);
}

function requireSeries(series, fields, name) {
  if (!Array.isArray(series?.time) || series.time.length === 0) {
    invalidData(`${name}.time must be a non-empty array`);
  }
  for (const field of fields) {
    if (
      !Array.isArray(series[field]) ||
      series[field].length !== series.time.length
    ) {
      invalidData(`${name}.${field} must align with ${name}.time`);
    }
  }
  for (let index = 1; index < series.time.length; index++) {
    if (series.time[index] <= series.time[index - 1]) {
      invalidData(`${name}.time must be unique and chronological`);
    }
  }
}

function validateUnits(data) {
  const expectedUnits = [
    [data.current_units, "temperature_2m", "°C"],
    [data.current_units, "apparent_temperature", "°C"],
    [data.current_units, "relative_humidity_2m", "%"],
    [data.current_units, "wind_speed_10m", "km/h"],
    [data.daily_units, "temperature_2m_max", "°C"],
    [data.daily_units, "temperature_2m_min", "°C"],
    [data.hourly_units, "precipitation_probability", "%"],
  ];
  for (const [units, field, expected] of expectedUnits) {
    if (units?.[field] !== expected) {
      invalidData(`${field} requires ${expected} units`);
    }
  }
}

function adaptDailyForecast(daily, offsetSeconds, formatter) {
  requireSeries(daily, dailyFields, "daily");
  // Daily boundaries use the response's fixed offset, unlike DST-aware hourly instants.
  const dates = daily.time.map((value) => getApiCalendarDate(value, offsetSeconds));
  const solarEvents = adaptSolarEvents(daily, offsetSeconds, formatter);
  return dates.map((date, index) => {
    const calendarDate = parseCalendarDate(date, `daily.time[${index}]`);
    if (index > 0) {
      const previousDate = parseCalendarDate(dates[index - 1], "daily.time");
      if (calendarDate.getTime() - previousDate.getTime() !== 86400000) {
        invalidData("daily.time must contain consecutive calendar days");
      }
    }
    const highTemperature = requireNumber(
      daily.temperature_2m_max[index],
      "daily.temperature_2m_max",
    );
    const lowTemperature = requireNumber(
      daily.temperature_2m_min[index],
      "daily.temperature_2m_min",
    );
    if (lowTemperature > highTemperature) {
      invalidData(`daily temperatures are inverted for ${date}`);
    }

    const sunrise = solarEvents.find((event) => event.date === date && event.type === "sunrise");
    const sunset = solarEvents.find((event) => event.date === date && event.type === "sunset");

    return {
      id: date,
      dayLabel: weekdayFormatter.format(calendarDate),
      ...getWeatherCondition(daily.weather_code[index]),
      highTemperature,
      lowTemperature,
      sunrise: sunrise?.time ?? null,
      sunset: sunset?.time ?? null,
    };
  });
}

function adaptRainProbability(hourly, currentDate, offsetSeconds, formatter) {
  requireSeries(hourly, ["precipitation_probability"], "hourly");
  const entries = hourly.time.map((timestamp, index) => ({
    ...getLocalDateTime(timestamp, offsetSeconds, `hourly.time[${index}]`, formatter),
    probability: requireNumber(
      hourly.precipitation_probability[index],
      "hourly.precipitation_probability",
      0,
      100,
    ),
  }));
  // Match the dashboard's four-hour slots without averaging probabilities.
  const forecasts = entries
    .filter(({ date, time }) =>
      date === currentDate &&
      time.endsWith(":00") &&
      Number(time.slice(0, 2)) % 4 === 0,
    )
    .map(({ time, probability }) => ({ time, probability }));

  if (
    forecasts.length !== 6 ||
    new Set(forecasts.map(({ time }) => time)).size !== 6
  ) {
    invalidData("hourly data must contain six four-hour slots for the current local day");
  }
  return forecasts;
}

export function adaptWeatherData(data, location = DEFAULT_WEATHER_LOCATION) {
  const validatedLocation = validateWeatherLocation(location);
  const requestedTimezone = validatedLocation.timezone;
  let responseTimezone;
  try {
    responseTimezone = normalizeWeatherTimezone(data?.timezone);
  } catch {
    invalidData("timezone must be a supported IANA timezone");
  }
  if (requestedTimezone !== "auto" && responseTimezone !== requestedTimezone) {
    invalidData(`timezone must be ${requestedTimezone}`);
  }
  const timezone = responseTimezone;
  const locationLabel = getWeatherLocationLabel(validatedLocation);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const offsetSeconds = requireNumber(
    data.utc_offset_seconds, "utc_offset_seconds", -50400, 50400,
  );
  if (!Number.isInteger(offsetSeconds)) {
    invalidData("utc_offset_seconds must be an integer");
  }
  validateUnits(data);

  const current = data.current;
  const currentDateTime = getLocalDateTime(
    current?.time, offsetSeconds, "current.time", formatter,
  );
  if (current.is_day !== 0 && current.is_day !== 1) {
    invalidData("current.is_day must be 0 or 1");
  }
  const { condition, WeatherIcon } = getWeatherCondition(
    current.weather_code, current.is_day === 1,
  );
  const dailyForecast = adaptDailyForecast(data.daily, offsetSeconds, formatter);
  const currentDay = dailyForecast.find(({ id }) => id === currentDateTime.date);
  if (!currentDay) {
    invalidData("daily data is missing the current local day");
  }
  const nextDays = dailyForecast
    .filter(({ id }) => id > currentDateTime.date)
    .slice(0, 4);
  if (nextDays.length !== 4) {
    invalidData("daily data must contain the next four days");
  }

  let hourlyForecast;
  try {
    hourlyForecast = adaptHourlyForecast(data, timezone);
  } catch {
    hourlyForecast = { date: currentDateTime.date, forecasts: [], isPartial: false, error: true };
  }

  return {
    hourlyForecast,
    location: locationLabel,
    timezone,
    currentWeather: {
      location: locationLabel,
      dayLabel: currentDay.dayLabel,
      temperature: requireNumber(
        current.temperature_2m, "current.temperature_2m",
      ),
      feelsLike: requireNumber(
        current.apparent_temperature, "current.apparent_temperature",
      ),
      condition,
      humidity: requireNumber(
        current.relative_humidity_2m, "current.relative_humidity_2m", 0, 100,
      ),
      windSpeed: requireNumber(
        current.wind_speed_10m, "current.wind_speed_10m", 0,
      ),
      sunrise: currentDay.sunrise,
      sunset: currentDay.sunset,
    },
    CurrentWeatherIcon: WeatherIcon,
    dailyForecast: nextDays.map((day) => ({
      id: day.id,
      dayLabel: day.dayLabel,
      condition: day.condition,
      WeatherIcon: day.WeatherIcon,
      highTemperature: day.highTemperature,
      lowTemperature: day.lowTemperature,
    })),
    rainProbability: adaptRainProbability(data.hourly, currentDateTime.date, offsetSeconds, formatter),
  };
}
