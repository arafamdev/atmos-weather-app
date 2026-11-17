import { Cloud, CloudRain, CloudSun, Sun } from "lucide-react";

export const demoWeather = {
  isDemo: true,
  dayLabel: "Monday",
  location: "Porto, Portugal",
  temperature: 18,
  feelsLike: 16,
  condition: "Partly cloudy",
  humidity: 64,
  windSpeed: 12,
  sunrise: "07:15",
  sunset: "17:32",
};
export const demoDailyForecast = [
  {
    id: "tuesday",
    dayLabel: "Tuesday",
    condition: "Sunny",
    highTemperature: 21,
    lowTemperature: 13,
    WeatherIcon: Sun,
  },
  {
    id: "wednesday",
    dayLabel: "Wednesday",
    condition: "Partly cloudy",
    highTemperature: 19,
    lowTemperature: 12,
    WeatherIcon: CloudSun,
  },
  {
    id: "thursday",
    dayLabel: "Thursday",
    condition: "Rainy",
    highTemperature: 17,
    lowTemperature: 11,
    WeatherIcon: CloudRain,
  },
  {
    id: "friday",
    dayLabel: "Friday",
    condition: "Cloudy",
    highTemperature: 18,
    lowTemperature: 12,
    WeatherIcon: Cloud,
  },
];

export const demoRainProbability = [
  { time: "00:00", probability: 0 },
  { time: "04:00", probability: 20 },
  { time: "08:00", probability: 45 },
  { time: "12:00", probability: 100 },
  { time: "16:00", probability: 65 },
  { time: "20:00", probability: 10 },
];
