import CurrentWeatherCard from "./CurrentWeatherCard.jsx";
import DailyForecastList from "./DailyForecastList.jsx";
import RainProbabilityChart from "./RainProbabilityChart.jsx";

import { usePortoWeather } from "../hooks/usePortoWeather.js";

export function WeatherDashboardContent({ query }) {
  const { data, isError, isFetched, isFetching, isPaused, refetch } = query;
  const showError = isError || (!data && isFetched);
  const retryUnavailable = isFetching || isPaused;
  const errorMessage = data
    ? "We couldn't update the weather. Showing the last available data."
    : "We couldn't load the weather for Porto. Please try again.";
  let statusMessage = "";

  if (isPaused) {
    statusMessage = "Waiting for a connection…";
  } else if (isFetching && data) {
    statusMessage = "Updating weather…";
  } else if (!data && !isError) {
    statusMessage = "Loading weather for Porto…";
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
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            aria-disabled={retryUnavailable}
            className="min-h-11 rounded-xl bg-app-accent px-5 py-2 text-sm font-semibold text-app-background hover:bg-app-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
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
              isDemo={data.isDemo}
            />
          </div>

          <RainProbabilityChart
            forecasts={data.rainProbability}
            location={data.location}
            isDemo={data.isDemo}
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

function WeatherDashboard() {
  const query = usePortoWeather();
  return <WeatherDashboardContent query={query} />;
}

export default WeatherDashboard;
