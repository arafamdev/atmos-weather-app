import { MapPin, Moon } from "lucide-react";

import AtmosBrand from "./AtmosBrand.jsx";

function Header({ locationLabel, children }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 md:flex md:flex-wrap md:justify-between md:gap-5">
      <AtmosBrand nameTag="h1" />

      <div className="col-span-2 row-start-2 flex min-w-0 max-w-full items-center gap-2 text-sm text-app-muted" aria-live="polite" aria-atomic="true">
        <MapPin size={17} className="shrink-0" aria-hidden="true" />

        <span className="min-w-0 truncate" title={locationLabel}>{locationLabel}</span>
      </div>

      <div className="col-span-2 row-start-3 w-full min-w-0 md:max-w-sm">
        {children}
      </div>

      <div
        role="img"
        className="col-start-2 row-start-1 flex size-11 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text"
        aria-label="Dark theme enabled"
        title="Dark theme enabled"
      >
        <Moon size={20} aria-hidden="true" />
      </div>
    </header>
  );
}

export default Header;
