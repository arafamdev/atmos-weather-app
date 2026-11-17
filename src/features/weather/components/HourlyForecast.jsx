import { useEffect, useId, useState } from "react";
import { CircleHelp, Droplets } from "lucide-react";

import SolarEventCard from "./SolarEventCard.jsx";

import { isCurrentForecastHour, mergeHourlyTimeline, scheduleForecastClock, selectHourlyForecastDay } from "../utils/weatherTimestamp.js";

export function HourlyForecastContent({ forecast, location, timezone, now }) {
  const titleId = useId();
  const descriptionId = useId();
  const { date, forecasts, solarEvents, isPartial, error } = selectHourlyForecastDay(forecast, timezone, now);
  const timeline = mergeHourlyTimeline(forecasts, solarEvents);
  const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T00:00:00Z`));

  return (
    <section aria-labelledby={titleId} className="mt-8 min-w-0 rounded-3xl border border-app-border bg-app-surface p-4 sm:p-6">
      <div className="mb-5 space-y-1">
        <h3 id={titleId} className="text-lg font-semibold">Hourly forecast</h3>
        <p className="break-words text-sm text-app-muted">{location}</p>
        <p className="text-xs text-app-muted">
          <time dateTime={date}>{dateLabel}</time> · {timezone}
        </p>
      </div>

      {error || forecasts.length === 0 ? (
        <p role="status" className="text-sm text-app-muted">
          {error ? "Hourly forecast is unavailable. Try refreshing the weather." : "No hourly forecast is available for this local day."}
        </p>
      ) : (
        <>
          <p id={descriptionId} className="mb-4 text-xs text-app-muted">
            {isPartial ? "Partial local day" : "Full local day"} · Scroll horizontally or focus this area and use the arrow keys.
            {isPartial && " Some hours or values are unavailable; missing values are marked with a dash."}
          </p>
          <div
            role="region"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={0}
            className="hourly-scroll overflow-x-auto rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
          >
            <ul className="flex w-max min-w-full gap-3 p-1">
              {timeline.map((hour) => {
                if (hour.type !== "hour") {
                  return <SolarEventCard key={`${hour.type}:${hour.timestamp}`} event={hour} />;
                }
                const WeatherIcon = hour.WeatherIcon ?? CircleHelp;
                const isCurrent = isCurrentForecastHour(hour.timestamp, now);
                return (
                  <li
                    key={`hour:${hour.timestamp}`}
                    aria-current={isCurrent ? "time" : undefined}
                    className="group flex w-28 shrink-0 flex-col items-center gap-3 rounded-2xl border border-app-border bg-app-background px-3 py-4 text-center aria-[current=time]:border-app-weather-card aria-[current=time]:bg-app-weather-card aria-[current=time]:text-app-weather-card-text"
                  >
                    <span className="min-h-4 rounded-full px-2 text-xs font-semibold text-app-accent group-aria-[current=time]:bg-app-weather-card-text/10 group-aria-[current=time]:text-app-weather-card-text">{isCurrent ? "NOW" : ""}</span>
                    <time dateTime={hour.dateTime} className="text-sm font-medium tabular-nums">{hour.timeLabel}</time>
                    <WeatherIcon size={32} strokeWidth={1.5} className="text-app-accent group-aria-[current=time]:text-app-weather-card-text" aria-hidden="true" />
                    <span className="sr-only">{hour.condition}</span>
                    <p className="text-lg font-semibold tabular-nums">
                      {hour.temperature === null ? <><span aria-hidden="true">—</span><span className="sr-only">Temperature unavailable</span></> : `${hour.temperature}°C`}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-app-muted group-aria-[current=time]:text-app-weather-card-text">
                      <Droplets size={14} aria-hidden="true" />
                      <span className="sr-only">Precipitation probability: </span>
                      {hour.probability === null ? <><span aria-hidden="true">—</span><span className="sr-only">unavailable</span></> : `${hour.probability}%`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

function HourlyForecast(props) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const stopClock = scheduleForecastClock(setNow);
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") setNow(Date.now());
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopClock();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  return <HourlyForecastContent {...props} now={now} />;
}

export default HourlyForecast;
