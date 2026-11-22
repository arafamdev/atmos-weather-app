export const DEFAULT_WEATHER_LOCATION = Object.freeze({
  name: "Porto",
  country: "Portugal",
  latitude: 41.1496,
  longitude: -8.6109,
  timezone: "Europe/Lisbon",
});

export function normalizeWeatherTimezone(timezone) {
  if (timezone === null || timezone === undefined) {
    throw new Error(
      "Invalid weather location: timezone is required and cannot be null.",
    );
  }
  if (typeof timezone !== "string" || !timezone.trim() || /^[+-]/.test(timezone.trim())) {
    throw new Error("Invalid weather location: timezone must be a supported IANA timezone.");
  }
  try {
    return new Intl.DateTimeFormat("en", { timeZone: timezone.trim() })
      .resolvedOptions().timeZone;
  } catch {
    throw new Error("Invalid weather location: timezone must be a supported IANA timezone.");
  }
}

export function validateWeatherLocation(location) {
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    throw new Error("Invalid weather location: location must be an object.");
  }
  for (const [field, limit] of [["latitude", 90], ["longitude", 180]]) {
    if (!Number.isFinite(location[field]) || Math.abs(location[field]) > limit) {
      throw new Error(
        `Invalid weather location: ${field} must be a finite number between ${-limit} and ${limit}.`,
      );
    }
  }
  for (const field of ["name", "admin1", "country"]) {
    if (location[field] != null && typeof location[field] !== "string") {
      throw new Error(`Invalid weather location: ${field} must be a string when provided.`);
    }
  }
  // Only device coordinates may ask Open-Meteo to resolve the geographic timezone.
  const timezone = location.source === "geolocation" && location.timezone === "auto"
    ? "auto" : normalizeWeatherTimezone(location.timezone);
  return { ...location, timezone };
}

export function getWeatherLocationLabel(location) {
  if (!location.name?.trim()) return `${location.latitude}, ${location.longitude}`;
  return [...new Set([location.name, location.admin1, location.country]
    .filter((value) => value?.trim())
    .map((value) => value.trim()))].join(", ");
}
