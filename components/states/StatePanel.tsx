import {
  CircleAlert,
  CircleOff,
  LockKeyhole,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

type StatePanelProps = {
  kind?: "empty" | "error" | "permission";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

const icons: Record<NonNullable<StatePanelProps["kind"]>, LucideIcon> = {
  empty: CircleOff,
  error: CircleAlert,
  permission: LockKeyhole,
};

export function StatePanel({
  kind = "empty",
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: StatePanelProps) {
  const Icon = icons[kind];
  return (
    <div
      className={`flex w-full flex-col items-center justify-center rounded-md border border-dashed bg-muted/25 text-center ${
        compact ? "min-h-36 px-4 py-6" : "min-h-56 px-6 py-10"
      }`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className="mb-3 grid size-9 place-items-center rounded-md border bg-card text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex min-h-64 flex-col justify-end gap-3" aria-label="Loading chart">
      <div className="skeleton h-3 w-28 rounded" />
      <div className="flex h-48 items-end gap-2 border-b border-l px-3 pb-3">
        {[42, 72, 56, 88, 64, 76, 92, 68, 84, 58, 73, 90].map((height, index) => (
          <div
            className="skeleton flex-1 rounded-t-sm"
            key={`${height}-${index}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}
