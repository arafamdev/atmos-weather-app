import { useState } from "react";

import CitySearch from "./features/weather/components/CitySearch.jsx";
import UserLocationControl from "./features/weather/components/UserLocationControl.jsx";
import WeatherDashboard from "./features/weather/components/WeatherDashboard.jsx";
import Footer from "./shared/components/layout/Footer.jsx";
import Header from "./shared/components/layout/Header.jsx";

import { useUserLocation } from "./features/weather/hooks/useUserLocation.js";

import {
  DEFAULT_WEATHER_LOCATION,
  getWeatherLocationLabel,
} from "./features/weather/utils/weatherLocation.js";

export function AppContent({ activeLocation, onSelectCity, userLocation }) {
  const locationLabel = getWeatherLocationLabel(activeLocation);

  return (
    <div className="flex min-h-screen flex-col bg-app-background px-5 py-8 text-app-text sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <Header locationLabel={locationLabel}>
          <CitySearch onSelectCity={onSelectCity} />
          {userLocation && <UserLocationControl {...userLocation} />}
        </Header>

        <main className="mt-8 flex-1 md:mt-12">
          <div className="mb-8 space-y-3">
            <p className="text-sm font-medium text-app-accent">
              WEATHER OVERVIEW
            </p>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Weather in {activeLocation.name?.trim() || locationLabel}.
            </h2>

            <p className="max-w-xl text-app-muted">
              Stay informed with beautiful, simple weather forecasts for your
              favorite locations.
            </p>
          </div>

          <WeatherDashboard location={activeLocation} />
        </main>

        <Footer />
      </div>
    </div>
  );
}

function App() {
  const [activeLocation, setActiveLocation] = useState(DEFAULT_WEATHER_LOCATION);
  const userLocation = useUserLocation(setActiveLocation);
  function selectCity(city) {
    userLocation.cancel();
    setActiveLocation(city);
  }
  return <AppContent activeLocation={activeLocation} onSelectCity={selectCity} userLocation={userLocation} />;
}

export default App;
