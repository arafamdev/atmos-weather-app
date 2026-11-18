import { useId } from "react";

function RainProbabilityChart({ forecasts, location }) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="mt-8 min-w-0 rounded-3xl border border-app-border bg-app-surface p-4 sm:p-6"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id={titleId} className="text-lg font-semibold">
            Rain probability
          </h3>
          <p className="mt-1 text-sm text-app-muted">{location}</p>
        </div>
      </div>

      <p id={descriptionId} className="mb-4 text-xs text-app-muted">
        Chance of precipitation · 0–100% · Local time
      </p>

      <div
        role="region"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={0}
        className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
      >
        <ul className="grid auto-cols-[minmax(2.5rem,1fr)] grid-flow-col gap-2 pb-2">
          {forecasts.map((forecast) => (
            <li key={forecast.time} className="flex flex-col items-center gap-3">
              <time
                dateTime={forecast.time}
                className="order-last text-xs text-app-muted"
              >
                {forecast.time}
              </time>
              <span className="text-sm font-medium tabular-nums">
                {forecast.probability}%
              </span>
              <div
                aria-hidden="true"
                className="flex h-40 w-full max-w-12 items-end rounded-t-lg bg-app-background"
              >
                <div
                  className="w-full rounded-t-lg bg-app-accent"
                  style={{ height: `${forecast.probability}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default RainProbabilityChart;
