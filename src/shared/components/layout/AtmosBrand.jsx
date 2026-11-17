import { CloudSun } from "lucide-react";

function AtmosBrand({ nameTag: NameTag = "p" }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-app-accent text-app-background">
        <CloudSun size={25} strokeWidth={1.8} aria-hidden="true" />
      </div>

      <div>
        <NameTag className="text-xl font-semibold tracking-tight">Atmos</NameTag>
        <p className="text-xs text-app-muted">
          Weather, beautifully simplified.
        </p>
      </div>
    </div>
  );
}

export default AtmosBrand;
