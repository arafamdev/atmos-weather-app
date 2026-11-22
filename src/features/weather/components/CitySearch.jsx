import { useEffect, useId, useReducer, useRef, useState } from "react";
import { Search } from "lucide-react";

import { useCitySearch } from "../hooks/useCitySearch.js";
import {
  citySearchReducer,
  getCityDetails,
  getCitySuggestions,
  handleCitySearchKeyDown,
  initialCitySearchState,
  scheduleCitySearch,
} from "./citySearchHelpers.js";

export function CitySearchContent({
  state, suggestions, statusMessage, isError, ids, listRef, rootRef,
  inputHandlers, onSelectCity, onActivateCity,
}) {
  const isExpanded = state.isOpen && [...state.searchTerm].length >= 2;
  const activeCity = suggestions.find(({ id }) => id === state.activeCityId);
  const activeOptionId = isExpanded && activeCity
    ? `${ids.list}-option-${activeCity.id}` : undefined;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label htmlFor={ids.input} className="sr-only">Search city</label>
      <div className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-app-accent">
        <Search size={19} className="shrink-0 text-app-muted" aria-hidden="true" />
        <input
          {...inputHandlers}
          id={ids.input}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? ids.list : undefined}
          aria-activedescendant={activeOptionId}
          aria-describedby={ids.status}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={state.inputValue}
          placeholder="Search city..."
          className="w-full min-w-0 bg-transparent text-sm text-app-text outline-none placeholder:text-app-muted"
        />
      </div>

      <p id={ids.status} role={isError ? "alert" : "status"} aria-atomic="true" className="sr-only">
        {isExpanded ? statusMessage : ""}
      </p>

      {isExpanded && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-2xl border border-app-border bg-app-surface shadow-xl">
          <p className="px-4 py-3 text-xs text-app-muted" aria-hidden="true">
            {statusMessage}
          </p>
          <ul ref={listRef} id={ids.list} role="listbox" aria-label="City suggestions" className="max-h-72 overflow-y-auto overscroll-contain rounded-b-2xl">
            {suggestions.map((city) => (
              <li
                key={city.id}
                id={`${ids.list}-option-${city.id}`}
                role="option"
                aria-selected={city.id === state.activeCityId}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse") onActivateCity(city.id);
                }}
                onClick={() => onSelectCity(city)}
                className="cursor-pointer break-words px-4 py-3 text-sm text-app-text hover:bg-app-surface-hover aria-selected:bg-app-surface-hover aria-selected:text-app-accent"
              >
                <span className="block font-medium">{city.name}</span>
                <span className="mt-1 block text-xs text-app-muted">{getCityDetails(city)}</span>
                <span className="sr-only">
                  {`Location ${city.id}, coordinates ${city.latitude}, ${city.longitude}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CitySearch({ onSelectCity }) {
  const [state, dispatch] = useReducer(citySearchReducer, initialCitySearchState);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const listRef = useRef(null);
  const rootRef = useRef(null);
  const keyboardNavigation = useRef(false);
  const selectionCommitted = useRef(false);
  const id = useId();
  const ids = { input: `${id}-input`, list: `${id}-list`, status: `${id}-status` };
  const canSearch = [...state.searchTerm].length >= 2;
  const isDebouncing = state.searchTerm !== debouncedSearchTerm;
  const query = useCitySearch(canSearch && !isDebouncing ? debouncedSearchTerm : "");
  const suggestions = getCitySuggestions(query, canSearch, isDebouncing);
  let statusMessage;

  if (isDebouncing || query.isLoading) {
    statusMessage = "Searching cities…";
  } else if (query.isPaused) {
    statusMessage = "Waiting for a connection…";
  } else if (query.isError) {
    statusMessage = "Unable to search cities. Please try again.";
  } else if (suggestions.length === 0) {
    statusMessage = "No cities found.";
  } else if (query.isFetching) {
    statusMessage = "Updating suggestions…";
  } else {
    statusMessage = `${suggestions.length} suggestions available. Use Up and Down to navigate.`;
  }

  useEffect(() => {
    return scheduleCitySearch(state.searchTerm, setDebouncedSearchTerm);
  }, [state.searchTerm]);

  useEffect(() => {
    const root = rootRef.current;
    const ownerDocument = root.ownerDocument;
    // Input blur can precede an option click; dismiss only on an outside interaction.
    function dismissOutside(event) {
      if (!root.contains(event.target)) dispatch({ type: "close" });
    }
    ownerDocument.addEventListener("pointerdown", dismissOutside, true);
    ownerDocument.addEventListener("click", dismissOutside, true);
    ownerDocument.addEventListener("focusin", dismissOutside, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", dismissOutside, true);
      ownerDocument.removeEventListener("click", dismissOutside, true);
      ownerDocument.removeEventListener("focusin", dismissOutside, true);
    };
  }, []);

  useEffect(() => {
    if (!keyboardNavigation.current) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [state.activeCityId]);

  function handleSelectCity(city) {
    if (selectionCommitted.current) return;
    selectionCommitted.current = true;
    // Restore input focus before closing so focus does not reopen stale suggestions.
    rootRef.current.querySelector("input").focus({ preventScroll: true });
    dispatch({ type: "select", city });
    onSelectCity(city);
  }

  return (
    <CitySearchContent
      state={state}
      suggestions={suggestions}
      statusMessage={statusMessage}
      isError={query.isError && !isDebouncing}
      ids={ids}
      listRef={listRef}
      rootRef={rootRef}
      inputHandlers={{
        onChange: (event) => {
          selectionCommitted.current = false;
          dispatch({ type: "input", value: event.target.value });
        },
        onFocus: () => dispatch({ type: "open" }),
        onKeyDown: (event) => {
          keyboardNavigation.current = event.key === "ArrowDown" || event.key === "ArrowUp";
          handleCitySearchKeyDown(event, {
            state, suggestions, dispatch, onSelectCity: handleSelectCity,
          });
        },
      }}
      onSelectCity={handleSelectCity}
      onActivateCity={(id) => {
        keyboardNavigation.current = false;
        dispatch({ type: "activate", id });
      }}
    />
  );
}

export default CitySearch;
