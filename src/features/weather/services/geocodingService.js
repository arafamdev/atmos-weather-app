const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

function hasExpectedGeocodingData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;

  // Open-Meteo omits empty fields, including results when no locations match.
  if (!Object.hasOwn(data, "results")) return true;
  if (!Array.isArray(data.results)) return false;

  return data.results.every((city) =>
    city !== null &&
    typeof city === "object" &&
    !Array.isArray(city) &&
    Number.isInteger(city.id) &&
    city.id > 0 &&
    typeof city.name === "string" &&
    city.name.trim().length > 0 &&
    Number.isFinite(city.latitude) &&
    city.latitude >= -90 &&
    city.latitude <= 90 &&
    Number.isFinite(city.longitude) &&
    city.longitude >= -180 &&
    city.longitude <= 180,
  );
}

export async function searchCities(query, { signal } = {}) {
  if (typeof query !== "string") {
    throw new TypeError("City search query must be a string.");
  }
  signal?.throwIfAborted();

  const normalizedQuery = query.trim();
  if ([...normalizedQuery].length < 2) return { results: [] };

  const parameters = new URLSearchParams({
    name: normalizedQuery,
    count: "10",
    language: "en",
    format: "json",
  });

  let response;

  try {
    response = await fetch(`${GEOCODING_URL}?${parameters}`, { signal });
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw error;

    throw new Error("Unable to reach Open-Meteo geocoding. Check your connection.", {
      cause: error,
    });
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw error;

    const message = response.ok
      ? "Open-Meteo geocoding returned invalid JSON."
      : `Open-Meteo geocoding request failed (HTTP ${response.status}).`;
    throw new Error(message, { cause: error });
  }

  if (!response.ok || data?.error === true) {
    const reason = typeof data?.reason === "string" ? ` ${data.reason}` : "";
    throw new Error(
      `Open-Meteo geocoding request failed (HTTP ${response.status}).${reason}`,
    );
  }

  if (!hasExpectedGeocodingData(data)) {
    throw new Error("Open-Meteo returned an unexpected geocoding data structure.");
  }

  return data;
}
