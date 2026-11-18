import CurrentWeatherCard from "./CurrentWeatherCard.jsx";
import DailyForecastList from "./DailyForecastList.jsx";
import HourlyForecast from "./HourlyForecast.jsx";
import RainProbabilityChart from "./RainProbabilityChart.jsx";

import { useCityWeather } from "../hooks/useCityWeather.js";

import { DEFAULT_WEATHER_LOCATION, getWeatherLocationLabel } from "../utils/weatherLocation.js";

export function WeatherDashboardContent({ query, location = DEFAULT_WEATHER_LOCATION }) {
  const locationLabel = getWeatherLocationLabel(location);
  const { data, isError, isFetched, isFetching, isPaused, refetch } = query;
  const invalidLocation = query.error?.message.startsWith("Invalid weather location:") ?? false;
  const showError = isError || (!data && isFetched);
  const retryUnavailable = isFetching || isPaused;
  const errorMessage = data
    ? "We couldn't update the weather. Showing the last available data."
    : `We couldn't load the weather for ${locationLabel}. Please try again.`;
  let statusMessage = "";

  if (isPaused) {
    statusMessage = "Waiting for a connection…";
  } else if (isFetching && data) {
    statusMessage = "Updating weather…";
  } else if (!data && !isError) {
    statusMessage = `Loading weather for ${locationLabel}…`;
  }

  function handleRetry() {
    if (retryUnavailable) return;
    void refetch();
  }

  return (
    <div>
      <p
        role="status"
        aria-atomic="true"
        className="mb-3 min-h-5 text-sm text-app-muted"
      >
        {statusMessage}
      </p>

      {showError && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-app-border bg-app-surface p-5">
          <p role="alert" className="max-w-xl text-sm text-app-text">
            {invalidLocation
              ? `Weather is unavailable for ${locationLabel}: the location or timezone is invalid. Please choose another city.`
              : errorMessage}
          </p>
          {!invalidLocation && (
            <button
              type="button"
              onClick={handleRetry}
              aria-disabled={retryUnavailable}
              className="min-h-11 rounded-xl bg-app-accent px-5 py-2 text-sm font-semibold text-app-background hover:bg-app-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            >
              {isFetching ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <section aria-label="Current weather" className="min-w-0">
              <CurrentWeatherCard
                weather={data.currentWeather}
                WeatherIcon={data.CurrentWeatherIcon}
              />
            </section>

            <DailyForecastList
              forecasts={data.dailyForecast}
              location={data.location}
            />
          </div>

          <HourlyForecast
            forecast={data.hourlyForecast}
            location={data.location}
            timezone={data.timezone}
          />

          <RainProbabilityChart
            forecasts={data.rainProbability}
            location={data.location}
          />
          <p className="mt-3 text-xs text-app-muted">
            Weather data by{" "}
            <a
              href="https://open-meteo.com/"
              className="rounded underline underline-offset-4 hover:text-app-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
            >
              Open-Meteo
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}

function WeatherDashboard({ location = DEFAULT_WEATHER_LOCATION }) {
  const query = useCityWeather(location);
  return <WeatherDashboardContent query={query} location={location} />;
}

export default WeatherDashboard;
