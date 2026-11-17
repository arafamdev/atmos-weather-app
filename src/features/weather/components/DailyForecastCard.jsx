import { CloudSun } from "lucide-react";
import { useId } from "react";

function DailyForecastCard({ forecast }) {
  const titleId = useId();
  const WeatherIcon = forecast.WeatherIcon ?? CloudSun;

  return (
    <article
      aria-labelledby={titleId}
      className="flex h-full flex-col items-center rounded-3xl border border-app-border bg-app-surface px-4 py-6 text-center"
    >
      <h4 id={titleId} className="text-sm font-medium">
        {forecast.dayLabel}
      </h4>

      <WeatherIcon
        size={48}
        strokeWidth={1.5}
        className="my-6 shrink-0 text-app-accent"
        aria-hidden="true"
      />

      <p className="mb-6 text-sm text-app-muted">{forecast.condition}</p>

      <dl className="mt-auto flex flex-wrap justify-center gap-4">
        <div>
          <dt className="text-xs text-app-muted">High</dt>
          <dd className="mt-1 text-lg font-semibold">
            {forecast.highTemperature}°C
          </dd>
        </div>
        <div>
          <dt className="text-xs text-app-muted">Low</dt>
          <dd className="mt-1 text-lg text-app-muted">
            {forecast.lowTemperature}°C
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default DailyForecastCard;
