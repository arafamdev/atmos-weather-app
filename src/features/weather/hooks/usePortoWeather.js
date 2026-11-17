import { cityWeatherQueryOptions, useCityWeather } from "./useCityWeather.js";

export const portoWeatherQueryOptions = cityWeatherQueryOptions();

export function usePortoWeather() {
  return useCityWeather();
}
