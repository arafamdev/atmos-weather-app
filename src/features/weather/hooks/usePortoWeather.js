import { useQuery } from "@tanstack/react-query";

import { adaptWeatherData } from "../adapters/weatherAdapter.js";
import { fetchPortoWeather } from "../services/weatherService.js";

export const portoWeatherQueryOptions = {
  queryKey: ["weather", "porto", "Europe/Lisbon"],
  queryFn: async ({ signal }) => {
    const data = await fetchPortoWeather({ signal });
    return adaptWeatherData(data);
  },
  staleTime: 5 * 60 * 1000,
};

export function usePortoWeather() {
  return useQuery(portoWeatherQueryOptions);
}
