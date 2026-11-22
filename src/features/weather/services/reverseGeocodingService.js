import { validateWeatherLocation } from "../utils/weatherLocation.js";

const REVERSE_GEOCODING_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

// Call only from the browser with its freshly consented geolocation coordinates.
export async function reverseGeocodePosition(coordinates, { signal } = {}) {
  const { latitude, longitude } = validateWeatherLocation({ ...coordinates, timezone: "UTC" });
  signal?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const parameters = new URLSearchParams({ latitude, longitude, localityLanguage: "en" });
    const response = await fetch(`${REVERSE_GEOCODING_URL}?${parameters}`, {
      signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error(`Location lookup failed (HTTP ${response.status}).`);
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data) || data.error ||
        !["coordinates", "reverseGeocoding"].includes(data.lookupSource)) {
      throw new Error("Location lookup returned unexpected data.");
    }
    const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
    const name = text(data.city) || text(data.locality);
    if (!name) throw new Error("Location lookup returned no locality.");
    return { name, country: text(data.countryName), admin1: text(data.principalSubdivision) };
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw new Error("Unable to identify your locality. Weather can still use your coordinates.", { cause: error });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
