import { useId } from "react";

import DailyForecastCard from "./DailyForecastCard.jsx";

function DailyForecastList({ forecasts, location }) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id={titleId} className="text-lg font-semibold">
            Daily forecast
          </h3>
          <p className="mt-1 text-sm text-app-muted">{location}</p>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {forecasts.map((forecast) => (
          <li key={forecast.id} className="min-w-0">
            <DailyForecastCard forecast={forecast} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default DailyForecastList;
