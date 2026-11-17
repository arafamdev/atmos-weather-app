export const initialCitySearchState = {
  inputValue: "",
  searchTerm: "",
  isOpen: false,
  activeCityId: null,
};

export function citySearchReducer(state, action) {
  switch (action.type) {
    case "input":
      return {
        inputValue: action.value,
        searchTerm: action.value.trim(),
        isOpen: true,
        activeCityId: null,
      };
    case "open":
      return { ...state, isOpen: true };
    case "close":
      return { ...state, isOpen: false, activeCityId: null };
    case "activate":
      return { ...state, activeCityId: action.id };
    case "move": {
      const ids = action.suggestionIds;
      const currentIndex = state.isOpen ? ids.indexOf(state.activeCityId) : -1;
      let nextIndex;
      if (currentIndex === -1) {
        nextIndex = action.direction === 1 ? 0 : ids.length - 1;
      } else {
        nextIndex = (currentIndex + action.direction + ids.length) % ids.length;
      }
      return { ...state, isOpen: true, activeCityId: ids[nextIndex] ?? null };
    }
    case "select":
      return {
        inputValue: action.city.name,
        searchTerm: "",
        isOpen: false,
        activeCityId: null,
      };
    default:
      return state;
  }
}

export function scheduleCitySearch(searchTerm, onReady) {
  const timer = setTimeout(() => onReady(searchTerm), 300);
  return () => clearTimeout(timer);
}

export function getCityDetails(city) {
  return [city.admin1, city.country].filter(Boolean).join(", ") ||
    `${city.latitude}, ${city.longitude}`;
}

export function getCitySuggestions(query, canSearch, isDebouncing) {
  if (!canSearch || isDebouncing || query.isError) return [];
  return (query.data ?? []).slice(0, 10);
}

export function handleCitySearchKeyDown(event, { state, suggestions, dispatch, onSelectCity }) {
  if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
  const isExpanded = state.isOpen && [...state.searchTerm].length >= 2;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if ([...state.searchTerm].length < 2 || suggestions.length === 0) return;
    event.preventDefault();
    dispatch({
      type: "move",
      direction: event.key === "ArrowDown" ? 1 : -1,
      suggestionIds: suggestions.map(({ id }) => id),
    });
  } else if (event.key === "Enter" && isExpanded) {
    event.preventDefault();
    const city = suggestions.find(({ id }) => id === state.activeCityId);
    if (city) onSelectCity(city);
  } else if (event.key === "Escape" && isExpanded) {
    event.preventDefault();
    event.stopPropagation();
    dispatch({ type: "close" });
  } else if (event.key === "Tab") {
    dispatch({ type: "close" });
  }
}
