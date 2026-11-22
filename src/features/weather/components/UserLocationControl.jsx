import { useId } from "react";
import { LocateFixed } from "lucide-react";

function UserLocationControl({ status, message, requestLocation }) {
  const id = useId();
  const privacyId = `${id}-privacy`;
  const statusId = `${id}-status`;
  const isLoading = status === "locating" || status === "resolving";
  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={requestLocation}
        disabled={isLoading}
        aria-label="Use my location"
        aria-busy={isLoading}
        aria-describedby={`${privacyId} ${statusId}`}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text hover:bg-app-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-wait disabled:opacity-70"
      >
        <LocateFixed size={17} aria-hidden="true" />
        <span>Use my location</span>
        {isLoading && <span className="text-xs text-app-muted">Loading…</span>}
      </button>
      <p id={statusId} role={status === "error" ? "alert" : "status"} aria-atomic="true" className="text-xs text-app-muted">
        {message}
      </p>
      <p id={privacyId} className="text-xs text-app-muted">
        Coordinates are shared with Open-Meteo and BigDataCloud, not saved to browser storage.
      </p>
    </div>
  );
}

export default UserLocationControl;
