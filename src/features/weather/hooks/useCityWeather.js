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

  const queryKey = locationError
    ? ["weather", "invalid-location", locationError.message]
    : ["weather", "location", {
      latitude: validatedLocation.latitude,
      longitude: validatedLocation.longitude,
      timezone: validatedLocation.timezone,
      label: getWeatherLocationLabel(validatedLocation),
    }];

  return {
    queryKey,
    queryFn: async ({ signal }) => {
      if (locationError) throw locationError;
      const response = await fetchWeather(validatedLocation, { signal });
      return adaptWeatherData(response, validatedLocation);
    },
    staleTime: 5 * 60 * 1000,
    ...(locationError ? { retry: false } : {}),
  };
}

export function useCityWeather(location) {
  return useQuery(cityWeatherQueryOptions(location));
}
