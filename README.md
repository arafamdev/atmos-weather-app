# Atmos Weather App

**Weather, beautifully simplified.**

A responsive weather dashboard built with React 19, focused on clear information,
accessible interactions and reliable client-side data handling. Atmos combines
current conditions, daily and hourly forecasts, city search, and two visual themes
using real Open-Meteo data.

**[Explore the live application](https://atmos-weather-app-kohl.vercel.app)**

## Features

- **City search:** debounced suggestions, region/country details for similarly
  named locations, keyboard navigation and pointer selection. Selecting a city
  clears the search field while preserving the active location in the dashboard.
- **Current weather:** temperature, condition, feels-like temperature, humidity,
  wind speed, sunrise and sunset. Porto, Portugal is the initial location.
- **Daily forecast:** conditions and maximum/minimum temperatures for the next four days.
- **Hourly timeline:** the selected city's current local calendar day, with
  temperatures, weather icons, precipitation probabilities and a distinct NOW
  indicator. Sunrise and sunset appear chronologically as separate events.
- **Location-aware time:** IANA timezones, Unix timestamps, daylight saving
  transitions and repeated local hours with explicit offsets.
- **Rain probability:** a lightweight HTML/CSS bar chart with visible percentages.
- **Dark and Soft Light themes:** Dark is the default; preferences persist in
  localStorage and are applied before the initial render.
- **Resilient states:** accessible loading messages, errors, Retry and background
  update feedback. Cached data for one city is not presented as another city's weather.
- **Responsive presentation:** mobile, tablet and desktop layouts, a horizontally
  scrollable timeline, reusable branding, social links and a custom SVG favicon.

## Technology

| Area | Tools |
| --- | --- |
| Interface | React 19, JavaScript and JSX |
| Build tooling | Vite 8 |
| Styling | Tailwind CSS v4 and semantic CSS theme tokens |
| Server state | TanStack Query v5 |
| Icons | Lucide React and a local SVG social-icon sprite |
| Data | Open-Meteo Forecast and Geocoding APIs, native fetch |
| Testing | Node.js test runner, node:assert/strict, React DOM and Vite SSR |
| Quality and delivery | ESLint, GitHub Actions and Vercel |

## Architecture

Weather-specific code lives in a feature module. Shared layout and theme concerns
remain separate, and components receive presentation data through props.

```text
.github/workflows/ci.yml       # Automated tests, lint and production build
public/                       # Standalone favicon and SVG icon sprite
src/
  app/providers/              # Shared QueryClient provider
  features/weather/
    adapters/                 # API validation, weather codes, hourly and solar mapping
    components/               # Search, dashboard, cards, timeline and chart
    hooks/                    # City search and location-specific weather queries
    services/                 # Forecast/geocoding HTTP requests and errors
    testing/                  # Controlled API fixtures for tests
    utils/                    # Location, timestamp and local-day utilities
  shared/
    components/layout/        # Header, Footer and reusable Atmos identity
    hooks/                    # Theme hook
    theme/                    # Theme state helpers and tests
  App.jsx                     # Active location state and interface composition
  index.css                   # Tailwind integration, theme tokens and global styles
  main.jsx                    # React entry point
tests/                        # Browser-only mounted DOM regression checks
docs/PROJECT_CLOSEOUT.md       # Project closeout record in Portuguese
```

Node test files are colocated with the code they validate.

### Data flow

1. `App` owns the active location; `CitySearch` reports a valid selection through
   `onSelectCity`.
2. `useCitySearch` calls the geocoding service and adapter. Queries require at
   least two Unicode characters, wait approximately 300 ms in the interface and
   request up to ten suggestions in English.
3. `useCityWeather` uses a location-specific query key and passes TanStack Query's
   AbortSignal to the forecast service.
4. Pure adapters validate units and values, map weather codes to descriptions and
   icons, and format timestamps for the selected city's timezone.
5. The dashboard renders adapted API data. Controlled test fixtures live in
   `testing/` and are not used as a production fallback.

Weather queries have a five-minute staleTime; city-search queries have a
thirty-minute staleTime. These are cache freshness windows, not polling intervals.
Requests can be cancelled, and different locations/searches have separate cache
entries. Focus-triggered refetching is disabled by the provider.

`fetchWeather` and `useCityWeather` both default to Porto when no location is
provided. There are no separate Porto-only service/hook wrappers or demo-data
modules. The location utility remains responsible for coordinates, labels and
timezone validation. The hook lifecycle tests exercise this current API directly.

## Open-Meteo integration

- [Forecast API](https://open-meteo.com/en/docs): current conditions, daily
  temperatures and solar events, plus hourly temperatures, weather codes,
  precipitation probabilities and day/night indicators.
- [Geocoding API](https://open-meteo.com/en/docs/geocoding-api): city names,
  coordinates, optional administrative details and IANA timezones.

Requests run directly in the browser using native fetch and async/await. Services
return API payloads; adapters handle the UI contract. Network failures, HTTP/API
errors, invalid JSON and unexpected structures receive explicit handling.
Cancelled requests preserve cancellation rather than becoming ordinary errors.

Forecast requests use Celsius, km/h, the selected timezone and Unix timestamps.
They include five forecast days and one past day to retain local-day boundary
coverage around offset changes. The timeline groups actual instants by local
calendar day instead of assuming every day contains 24 records. Solar events
reuse the daily response; unavailable events are omitted rather than invented.

The current public endpoints require no API key in this implementation. Network
access is required to load new weather or search results; there is no backend,
authentication or geolocation permission flow.

## Run locally

Use **Node.js 24** and npm to match the GitHub Actions configuration.

```bash
git clone https://github.com/arafamdev/atmos-weather-app.git
cd atmos-weather-app
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment file is required for the
current API integration. Never put secrets in client-side `VITE_*` variables.

### Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm test` | Run the Node.js test suite |
| `npm run lint` | Run ESLint |
| `npm run build` | Generate the production site in `dist/` |
| `npm run preview` | Serve the production build locally after building |

## Tests and validation

```bash
npm test
npm run lint
npm run build
git diff --check
```

The closeout validation passed **178 Node tests**, ESLint and the production build.
The runner is **Node.js, not Vitest**. Tests cover services, adapters, cache and
cancellation, timezone/DST handling, component markup, states, city switching and
themes. Many component checks use rendered HTML rather than a browser DOM.

Additional mounted React interaction checks are available at
`/tests/city-search.html` while the development server is running. These five
checks use synthetic DOM events and run separately from npm test and CI. See
[browser test instructions and limitations](tests/README.md).

Following [PR #9](https://github.com/arafamdev/atmos-weather-app/pull/9), the project
owner confirmed city search and selection on a physical iPhone using Safari,
including the production deployment. This validates the reported issue; it is
not a claim of exhaustive support across all Safari releases or assistive tools.

## Accessibility and responsive design

- Labelled combobox with active-descendant navigation, ArrowUp/ArrowDown, Enter,
  Escape and native Tab navigation.
- Visible focus indicators, semantic landmarks/headings and status/error messages.
- Text equivalents for chart values and decorative icons hidden from screen readers.
- Focusable horizontal scroll region, hidden visual scrollbar and reduced-motion support.
- A NOW label and aria-current state identify the current hour without color alone.
- Shared theme tokens keep cards, inputs, charts and feedback consistent.

These are implemented accessibility practices, not a WCAG certification.
Comprehensive screen-reader and device-matrix testing remains a separate task.

## Continuous integration and deployment

GitHub Actions runs on pull requests targeting main and pushes to main. It uses
Node.js 24, npm ci, npm test, ESLint and a production build, with read-only
repository permissions, SHA-pinned actions and cancellation of superseded runs.

The repository is connected to Vercel. Pull requests receive preview deployments;
changes merged into main trigger automatic production deployments. Vite builds
the static application into `dist/`. CI checks and Vercel deployments are separate
signals and should both be reviewed before considering a release validated.

Production: [atmos-weather-app-kohl.vercel.app](https://atmos-weather-app-kohl.vercel.app)

## Scope and known limitations

- Forecast availability depends on Open-Meteo and connectivity. Cached weather is
  not continuously polled; a long-lived tab can outlast its cached forecast range.
- Missing hourly values and solar events have explicit partial/unavailable states.
- The Footer's LinkedIn link is clearly marked temporary and currently leads to
  the generic LinkedIn homepage, pending a confirmed personal URL.
- The repository does not currently include a license file; no open-source license
  is implied by this README.

## Author and credits

Built by **Arafam Mussa Silla** as a Frontend project.

- [GitHub profile](https://github.com/arafamdev)
- Weather and location data: [Open-Meteo](https://open-meteo.com/)
- Weather/interface icons: [Lucide](https://lucide.dev/)
- Custom Atmos favicon and local social-icon assets are included in `public/`.

For the final validation record, Safari incident notes and remaining handoff
items, see [Project closeout — Portuguese](docs/PROJECT_CLOSEOUT.md).
