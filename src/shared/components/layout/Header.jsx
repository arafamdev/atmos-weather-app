import { MapPin, Moon, Search } from "lucide-react";

import AtmosBrand from "./AtmosBrand.jsx";

function Header() {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 md:flex md:flex-wrap md:justify-between md:gap-5">
      <AtmosBrand nameTag="h1" />

      <div className="col-span-2 row-start-2 flex items-center gap-2 text-sm text-app-muted">
        <MapPin size={17} aria-hidden="true" />

        <span>Porto, Portugal</span>
      </div>

      <div className="col-span-2 row-start-3 flex w-full min-w-0 items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-app-accent md:max-w-sm">
        <Search size={19} className="shrink-0 text-app-muted" aria-hidden="true" />

        <input
          type="search"
          placeholder="Search city..."
          aria-label="Search city"
          className="w-full min-w-0 bg-transparent text-sm text-app-text outline-none placeholder:text-app-muted"
        />
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
