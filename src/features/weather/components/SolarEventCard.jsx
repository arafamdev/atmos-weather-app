import { Sunrise, Sunset } from "lucide-react";

function SolarEventCard({ event }) {
  const isSunrise = event.type === "sunrise";
  const EventIcon = isSunrise ? Sunrise : Sunset;
  const label = isSunrise ? "Sunrise" : "Sunset";

  return (
    <li data-solar-event={event.type} className="flex w-28 shrink-0 flex-col items-center gap-3 rounded-2xl border border-dashed border-app-border bg-app-surface-hover px-3 py-4 text-center">
      <span className="min-h-4 text-xs font-semibold text-app-text">{label}</span>
      <time dateTime={event.dateTime} className="text-sm font-medium tabular-nums">{event.time}</time>
      <span className="sr-only">{event.offset}</span>
      <EventIcon size={32} strokeWidth={1.5} className="text-app-accent" aria-hidden="true" />
      <p className="mt-auto text-xs text-app-muted">{isSunrise ? "Daylight begins" : "Daylight ends"}</p>
    </li>
  );
}

export default SolarEventCard;
