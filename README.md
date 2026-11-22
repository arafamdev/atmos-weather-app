# Atmos Weather App

**Weather, beautifully simplified.**

A modern, responsive weather app built with React 19, featuring current weather and forecasts, city search, device location and Dark/Soft Light themes.

**[Live Demo](https://atmos-by-arafam.vercel.app)**

## Application Preview

### Desktop

![Atmos Desktop Dark](docs/screenshots/desktop-dark.png)

![Atmos Desktop Light](docs/screenshots/desktop-light.png)

### Responsive Design

|                       Tablet                       |                       Mobile                       |
| :------------------------------------------------: | :------------------------------------------------: |
| ![Atmos Tablet](docs/screenshots/tablet.png) | ![Atmos Mobile](docs/screenshots/mobile.png) |

## Features

- **Weather:** Current conditions, hourly forecasts and a four-day daily forecast.
- **Rain and daylight:** Precipitation probability, sunrise and sunset in local time.
- **City search:** Search worldwide with autocomplete suggestions.
- **Device location:** Request local weather with consent; retrieve it automatically
  when the browser reports an existing permission grant.
- **Dark & Soft Light themes:** Persistent theme preferences.
- **Responsive design:** Optimized for desktop, tablet and mobile.
- **Accessibility:** Keyboard navigation, semantic HTML and visible focus states.

## Tech Stack

- **Frontend:** React 19, JavaScript (JSX), Vite 8
- **Styling:** Tailwind CSS v4
- **State Management:** TanStack Query v5
- **APIs:** Open-Meteo, BigDataCloud
- **Icons:** Lucide React
- **Testing & CI/CD:** Node.js Test Runner, ESLint, GitHub Actions
- **Deployment:** Vercel

## Getting Started

```bash
git clone https://github.com/arafamdev/atmos-weather-app.git
cd atmos-weather-app
npm ci
npm run dev
```

Requires Node.js 24. Open the local URL printed by Vite; no API key or environment
file is needed. See [validation instructions](tests/README.md) for tests, lint and build.

## Author

Developed by **Arafam Mussa Silla**.

[GitHub](https://github.com/arafamdev) · [LinkedIn](https://www.linkedin.com/in/arafam-mussa-silla-5a7866446/) · [Live Demo](https://atmos-by-arafam.vercel.app)

Weather data provided by [Open-Meteo](https://open-meteo.com/).
