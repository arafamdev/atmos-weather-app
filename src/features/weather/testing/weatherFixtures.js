export function createWeatherData(
  startDate = "2026-11-17",
  offsetSeconds = 0,
  dayCount = 5,
) {
  const startTime = Date.parse(`${startDate}T00:00:00Z`);
  const dates = Array.from({ length: dayCount }, (_, index) =>
    new Date(startTime + index * 86400000).toISOString().slice(0, 10),
  );
  const hours = Array.from({ length: dayCount * 24 }, (_, index) =>
    new Date(startTime + index * 3600000).toISOString().slice(0, 16),
  );

  return {
    timezone: "Europe/Lisbon",
    utc_offset_seconds: offsetSeconds,
    current_units: {
      temperature_2m: "°C",
      apparent_temperature: "°C",
      relative_humidity_2m: "%",
      wind_speed_10m: "km/h",
    },
    daily_units: { temperature_2m_max: "°C", temperature_2m_min: "°C" },
    hourly_units: { precipitation_probability: "%" },
    current: {
      time: `${startDate}T12:00`,
      temperature_2m: 18.5,
      apparent_temperature: 16,
      relative_humidity_2m: 64,
      wind_speed_10m: 12,
      weather_code: 2,
      is_day: 1,
    },
    daily: {
      time: dates,
      temperature_2m_max: dates.map((_, index) => 20 + index),
      temperature_2m_min: dates.map((_, index) => 10 + index),
      weather_code: dates.map((_, index) => [2, 0, 61, 3, 95][index % 5]),
      sunrise: dates.map((date) => `${date}T07:15`),
      sunset: dates.map((date) => `${date}T17:32`),
    },
    hourly: {
      time: hours,
      precipitation_probability: hours.map((_, index) => index % 2 === 0 ? 0 : 100),
    },
  };
}
