import { reverseGeocodePosition } from "../services/reverseGeocodingService.js";
import { validateWeatherLocation } from "../utils/weatherLocation.js";

const idle = { status: "idle", message: "" };
const errors = {
  1: "Location permission was denied. Allow location access in your browser settings or search for a city.",
  2: "Your location is unavailable. Please try again or search for a city.",
  3: "Finding your location timed out. Please try again or search for a city.",
};

export function createUserLocationController({ geolocation, permissions, onLocation, onStatus,
  reverseGeocode = reverseGeocodePosition }) {
  let revision = 0;
  let disposed = false;
  let phase = "idle";
  let controller;
  const current = (request) => !disposed && request === revision;

  function cancel() {
    revision += 1;
    controller?.abort();
    phase = "idle";
    if (!disposed) onStatus(idle);
  }

  function start() {
    if (disposed || phase === "locating" || phase === "resolving") return;
    if (!geolocation?.getCurrentPosition) {
      onStatus({ status: "error", message: "Location is not supported in this browser. Search for a city instead." });
      return;
    }
    const request = ++revision;
    controller = new AbortController();
    phase = "locating";
    onStatus({ status: "locating", message: "Finding your location…" });
    function fail(error) {
      if (!current(request) || phase !== "locating") return;
      phase = "idle";
      onStatus({ status: "error", message: errors[error?.code] || "Unable to access your location. Search for a city or try again." });
    }
    async function located(position) {
      if (!current(request) || phase !== "locating") return;
      let location;
      try {
        location = validateWeatherLocation({
          latitude: position?.coords?.latitude, longitude: position?.coords?.longitude,
          name: "Current location", timezone: "auto", source: "geolocation",
        });
      } catch {
        fail({ code: 2 });
        return;
      }
      phase = "resolving";
      onStatus({ status: "resolving", message: "Identifying your locality…" });
      let message = "Using your device location. Accuracy varies by device and conditions.";
      try {
        const { name, country, admin1 } = await reverseGeocode(location, { signal: controller.signal });
        location = { ...location, name, country, admin1 };
      } catch {
        message = "Locality unavailable. Showing weather for your device coordinates.";
      }
      if (!current(request)) return;
      phase = "idle";
      onLocation(location);
      onStatus({ status: "success", message });
    }
    try {
      geolocation.getCurrentPosition(located, fail, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
    } catch (error) {
      fail(error);
    }
  }

  async function startIfGranted() {
    const request = revision;
    if (!permissions?.query || !geolocation?.getCurrentPosition) return;
    try {
      const permission = await permissions.query({ name: "geolocation" });
      if (current(request) && permission.state === "granted") start();
    } catch {
      // Unsupported permission descriptors must leave the explicit button usable.
    }
  }

  function dispose() {
    disposed = true;
    cancel();
  }
  return { start, startIfGranted, cancel, dispose };
}
