import {
  CircleHelp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";

const weatherConditions = {
  0: ["Clear sky", Sun],
  1: ["Mainly clear", Sun],
  2: ["Partly cloudy", CloudSun],
  3: ["Overcast", Cloud],
  45: ["Fog", CloudFog],
  48: ["Depositing rime fog", CloudFog],
  51: ["Light drizzle", CloudDrizzle],
  53: ["Moderate drizzle", CloudDrizzle],
  55: ["Dense drizzle", CloudDrizzle],
  56: ["Light freezing drizzle", CloudDrizzle],
  57: ["Dense freezing drizzle", CloudDrizzle],
  61: ["Slight rain", CloudRain],
  63: ["Moderate rain", CloudRain],
  65: ["Heavy rain", CloudRain],
  66: ["Light freezing rain", CloudRain],
  67: ["Heavy freezing rain", CloudRain],
  71: ["Slight snowfall", CloudSnow],
  73: ["Moderate snowfall", CloudSnow],
  75: ["Heavy snowfall", CloudSnow],
  77: ["Snow grains", CloudSnow],
  80: ["Slight rain showers", CloudRain],
  81: ["Moderate rain showers", CloudRain],
  82: ["Violent rain showers", CloudRain],
  85: ["Slight snow showers", CloudSnow],
  86: ["Heavy snow showers", CloudSnow],
  95: ["Thunderstorm", CloudLightning],
  96: ["Thunderstorm with slight hail", CloudHail],
  97: ["Heavy thunderstorm", CloudLightning],
  99: ["Thunderstorm with heavy hail", CloudHail],
};

export function getWeatherCondition(code, isDay = true) {
  if (!Number.isInteger(code) || code < 0) {
    throw new Error(
      "Invalid weather data: weather_code must be a non-negative integer.",
    );
  }

  const [condition, DayIcon] = weatherConditions[code] ?? [
    "Unknown conditions",
    CircleHelp,
  ];
  let WeatherIcon = DayIcon;

  if (!isDay && (code === 0 || code === 1)) {
    WeatherIcon = Moon;
  }
  if (!isDay && code === 2) {
    WeatherIcon = CloudMoon;
  }

  return { condition, WeatherIcon };
}
