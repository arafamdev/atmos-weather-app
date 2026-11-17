import WeatherDashboard from "./features/weather/components/WeatherDashboard.jsx";
import Footer from "./shared/components/layout/Footer.jsx";
import Header from "./shared/components/layout/Header.jsx";

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-app-background px-5 py-8 text-app-text sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <Header />

        <main className="mt-8 flex-1 md:mt-12">
          <div className="mb-8 space-y-3">
            <p className="text-sm font-medium text-app-accent">
              WEATHER OVERVIEW
            </p>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your weather, at a glance.
            </h2>

            <p className="max-w-xl text-app-muted">
              Stay informed with beautiful, simple weather forecasts for your
              favorite locations.
            </p>
          </div>

          <WeatherDashboard />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default App;
