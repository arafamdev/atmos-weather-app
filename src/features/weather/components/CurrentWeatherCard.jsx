import { CloudSun, Droplets, Sunrise, Sunset, Wind } from "lucide-react";
import { useId } from "react";

// Temperatures use Celsius, wind uses km/h, and times are local HH:mm values.
function CurrentWeatherCard({ weather, WeatherIcon = CloudSun }) {
  const titleId = useId();

  return (
    <article
      aria-labelledby={titleId}
      className="flex min-h-80 flex-col justify-between rounded-3xl bg-app-weather-card p-6 text-app-weather-card-text"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 id={titleId} className="text-sm font-medium">
            {weather.location}
          </h3>
          <p className="mt-1 text-xs text-app-weather-card-text/70">{weather.dayLabel}</p>
        </div>

        {weather.isDemo && (
          <span className="shrink-0 rounded-full bg-app-text/40 px-3 py-1 text-xs font-medium">
            Demo data
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 py-8">
        <div>
          <p className="text-6xl font-semibold tracking-tighter sm:text-7xl">
            {weather.temperature}
            <span aria-hidden="true">°</span>
            <span className="sr-only"> degrees Celsius</span>
          </p>

          <p className="mt-3 text-sm font-medium">{weather.condition}</p>

          <p className="mt-1 text-xs text-app-weather-card-text/70">
            Feels like {weather.feelsLike}°C
          </p>
        </div>

        <WeatherIcon
          size={100}
          strokeWidth={1.2}
          className="size-20 shrink-0 text-app-weather-card-text sm:size-25"
          aria-hidden="true"
        />
      </div>

      <dl className="grid grid-cols-1 gap-4 border-t border-app-weather-card-text/15 pt-5 min-[360px]:grid-cols-2">
        <div className="text-xs">
          <dt className="flex items-center gap-2">
            <Droplets size={17} aria-hidden="true" />
            Humidity
          </dt>
          <dd className="mt-1 pl-6 font-semibold">
            {weather.humidity}%
          </dd>
        </div>

        <div className="text-xs">
          <dt className="flex items-center gap-2">
            <Wind size={17} aria-hidden="true" />
            Wind
          </dt>
          <dd className="mt-1 pl-6 font-semibold">
            {weather.windSpeed} km/h
          </dd>
        </div>

        <div className="text-xs">
          <dt className="flex items-center gap-2">
            <Sunrise size={17} aria-hidden="true" />
            Sunrise
          </dt>
          <dd className="mt-1 pl-6 font-semibold">
            {weather.sunrise ? <time dateTime={weather.sunrise}>{weather.sunrise}</time> : "Unavailable"}
          </dd>
        </div>

        <div className="text-xs">
          <dt className="flex items-center gap-2">
            <Sunset size={17} aria-hidden="true" />
            Sunset
          </dt>
          <dd className="mt-1 pl-6 font-semibold">
            {weather.sunset ? <time dateTime={weather.sunset}>{weather.sunset}</time> : "Unavailable"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default CurrentWeatherCard;
