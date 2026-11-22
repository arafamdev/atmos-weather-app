import { useQuery } from "@tanstack/react-query";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { fetchWeather } from "../services/weatherService.js";
import {
  DEFAULT_WEATHER_LOCATION,
  getWeatherLocationLabel,
  validateWeatherLocation,
} from "../utils/weatherLocation.js";

export function cityWeatherQueryOptions(location = DEFAULT_WEATHER_LOCATION) {
  let validatedLocation;
  let locationError;
  try {
    validatedLocation = validateWeatherLocation(location);
  } catch (error) {
    locationError = error;
  }

  const isDeviceLocation = validatedLocation?.source === "geolocation";
  const locationLabel = locationError ? "" : getWeatherLocationLabel(validatedLocation);
  const weatherLocation = isDeviceLocation
    ? { ...validatedLocation, name: "Current location", country: null, admin1: null }
    : validatedLocation;
  const queryKey = locationError
    ? ["weather", "invalid-location", locationError.message]
    : ["weather", "location", {
      latitude: validatedLocation.latitude,
      longitude: validatedLocation.longitude,
      timezone: validatedLocation.timezone,
      label: getWeatherLocationLabel(weatherLocation),
    }];

  return {
    queryKey,
    queryFn: async ({ signal }) => {
      if (locationError) throw locationError;
      const response = await fetchWeather(weatherLocation, { signal });
      return adaptWeatherData(response, weatherLocation);
    },
    // Locality enrichment changes presentation, not the coordinate forecast cache.
    ...(isDeviceLocation ? { select: (data) => ({
      ...data,
      location: locationLabel,
      currentWeather: { ...data.currentWeather, location: locationLabel },
    }) } : {}),
    staleTime: 5 * 60 * 1000,
    ...(locationError ? { retry: false } : {}),
  };
}

export function useCityWeather(location) {
  return useQuery(cityWeatherQueryOptions(location));
}
