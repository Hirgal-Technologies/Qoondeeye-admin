import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Info,
  type LucideIcon,
} from "lucide-react";

export type MetricChange = {
  value: string;
  direction: "up" | "down" | "neutral";
  label: string;
};

type StatTileProps = {
  label: string;
  value?: string;
  sublabel?: string;
  change?: MetricChange;
  icon?: LucideIcon;
  tooltip?: string;
  status?: "default" | "critical";
  isLoading?: boolean;
  error?: string | null;
};

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: ArrowRight,
};

export function StatTile({
  label,
  value = "—",
  sublabel,
  change,
  icon: Icon,
  tooltip,
  status = "default",
  isLoading = false,
  error = null,
}: StatTileProps) {
  const TrendIcon = change ? trendIcons[change.direction] : null;

  return (
    <article className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
          <span className="truncate">{label}</span>
          {tooltip ? (
            <span className="group relative shrink-0" tabIndex={0}>
              <Info aria-label={`About ${label}`} className="size-3.5" />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-56 -translate-x-1/2 rounded-md border bg-popover p-2 text-[11px] font-normal leading-4 text-popover-foreground shadow-lg group-hover:block group-focus:block"
              >
                {tooltip}
              </span>
            </span>
          ) : null}
        </div>
        {status === "critical" ? (
          <CircleAlert aria-label="Critical metric" className="size-4 shrink-0 text-destructive" />
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2" aria-label={`${label} loading`}>
          <div className="skeleton h-8 w-28 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      ) : error ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-destructive">Unavailable</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <>
          <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          <div className="mt-1.5 flex min-h-4 items-center gap-1.5 text-xs text-muted-foreground">
            {change && TrendIcon ? (
              <>
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                  <TrendIcon aria-hidden="true" className="size-3.5" />
                  {change.value}
                </span>
                <span>{change.label}</span>
              </>
            ) : (
              <span className="truncate">{sublabel ?? "Current period"}</span>
            )}
          </div>
        </>
      )}
    </article>
  );
}
