function invalidData(message) {
  throw new Error(`Invalid geocoding data: ${message}.`);
}

function normalizeText(value, field, required = false) {
  if (value === undefined || value === null) {
    if (required) invalidData(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") invalidData(`${field} must be a string`);

  const text = value.trim();
  if (required && !text) invalidData(`${field} must not be empty`);
  return text || null;
}

function requireCoordinate(value, field, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    invalidData(`${field} must be a finite number between ${minimum} and ${maximum}`);
  }
  return value;
}

function normalizeTimezone(value, field) {
  const timezone = normalizeText(value, field);
  if (timezone === null) return null;
  if (/^[+-]/.test(timezone)) invalidData(`${field} must be a supported IANA timezone`);

  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    invalidData(`${field} must be a supported IANA timezone`);
  }
  return timezone;
}

export function adaptCityResults(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    invalidData("response must be an object");
  }
  if (response.error === true) {
    const reason = typeof response.reason === "string" ? `: ${response.reason}` : "";
    invalidData(`the API returned an error${reason}`);
  }
  if (!Object.hasOwn(response, "results")) return [];
  if (!Array.isArray(response.results)) invalidData("results must be an array");

  const locationIds = new Set();

  return Array.from(response.results, (city, index) => {
    const field = `results[${index}]`;
    if (!city || typeof city !== "object" || Array.isArray(city)) {
      invalidData(`${field} must be an object`);
    }
    if (!Number.isSafeInteger(city.id) || city.id <= 0) {
      invalidData(`${field}.id must be a positive safe integer`);
    }
    if (locationIds.has(city.id)) invalidData(`${field}.id duplicates location ${city.id}`);
    locationIds.add(city.id);

    return {
      id: city.id,
      name: normalizeText(city.name, `${field}.name`, true),
      country: normalizeText(city.country, `${field}.country`),
      admin1: normalizeText(city.admin1, `${field}.admin1`),
      latitude: requireCoordinate(city.latitude, `${field}.latitude`, -90, 90),
      longitude: requireCoordinate(city.longitude, `${field}.longitude`, -180, 180),
      timezone: normalizeTimezone(city.timezone, `${field}.timezone`),
    };
  });
}
