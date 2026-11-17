import { useQuery } from "@tanstack/react-query";

import { adaptCityResults } from "../adapters/geocodingAdapter.js";
import { searchCities } from "../services/geocodingService.js";

export function citySearchQueryOptions(searchTerm) {
  if (typeof searchTerm !== "string") {
    throw new TypeError("City search term must be a string.");
  }
  const normalizedSearchTerm = searchTerm.trim();

  return {
    queryKey: ["cities", "search", normalizedSearchTerm],
    enabled: [...normalizedSearchTerm].length >= 2,
    queryFn: async ({ signal }) => {
      const response = await searchCities(normalizedSearchTerm, { signal });
      return adaptCityResults(response);
    },
    staleTime: 30 * 60 * 1000,
  };
}

export function useCitySearch(searchTerm) {
  return useQuery(citySearchQueryOptions(searchTerm));
}
