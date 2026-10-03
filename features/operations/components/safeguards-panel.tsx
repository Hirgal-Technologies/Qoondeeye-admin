"use client";

import type { ProductionSafeguardView, ExposedValue } from "@/features/operations/contracts";
import { formatExposure, formatUsdFromCents } from "@/features/operations/present-status";
import { formatTimestamp } from "@/features/merchant-gateway/presentation";

export function SafeguardsPanel({
  view,
  showBalance = true,
  compact = false,
}: {
  view: ProductionSafeguardView;
  showBalance?: boolean;
  compact?: boolean;
}) {
  const rows: Array<{ label: string; value: string; tone: RowTone; detail?: string }> = [];
  rows.push({
    label: "Automated sales",
    value: formatFlag(view.automatedSales),
    tone: flagTone(view.automatedSales),
  });
  rows.push({
    label: "TopTayo environment",
    value: textValue(view.environment),
    tone: view.environment.state === "known" ? "neutral" : "warning",
  });
  if (showBalance) {
    rows.push({
      label: "TopTayo balance",
      value: centsValue(view.toptayoBalanceCents),
      tone: view.toptayoBalanceCents.state === "known" ? "neutral" : "warning",
      detail: view.balanceAsOf ? `As of ${formatTimestamp(view.balanceAsOf)}` : undefined,
    });
  }
  rows.push(
    {
      label: "Reserve floor",
      value: centsValue(view.reserveFloorCents),
      tone: view.reserveFloorCents.state === "known" ? "neutral" : "warning",
    },
    {
      label: "Today's exposure",
      value: formatExposure(view),
      tone: exposureTone(view),
    },
    {
      label: "Daily recharge limit",
      value: centsValue(view.dailyLimitCents),
      tone: view.dailyLimitCents.state === "known" ? "neutral" : "warning",
    },
    {
      label: "Remaining capacity",
      value: centsValue(view.remainingCapacityCents),
      tone: capacityTone(view),
    },
    {
      label: "Canary",
      value: formatFlag(view.canary),
      tone: view.canary.state === "known" ? "neutral" : "warning",
    },
  );

  return (
    <section className={`rounded-lg border bg-card shadow-[var(--shadow-card)] ${compact ? "px-3 py-2.5" : "p-4"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Production money</h2>
        {compact ? null : (
          <p className="text-xs leading-5 text-muted-foreground">
            Production status from Qoondeeye. An unknown balance stays unavailable.
          </p>
        )}
      </div>
      <dl
        className={
          compact
            ? "mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 xl:grid-cols-7"
            : "mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-4"
        }
      >
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
            <dd className={`mt-0.5 truncate font-medium ${compact ? "text-xs" : "text-sm"} ${toneClass(compact && row.tone === "success" ? "neutral" : row.tone)}`}>
              {row.value}
            </dd>
            {!compact && row.detail ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.detail}</p>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

type RowTone = "neutral" | "success" | "warning";

function centsValue(value: ExposedValue<number>) {
  if (value.state !== "known") return value.label;
  return formatUsdFromCents(value.value);
}

function formatFlag(value: ExposedValue<"enabled" | "disabled">) {
  if (value.state === "unavailable") return value.label;
  return value.value === "enabled" ? "Enabled" : "Disabled";
}

function textValue(value: ExposedValue<string>) {
  return value.state === "known" ? value.value : value.label;
}

function flagTone(value: ExposedValue<"enabled" | "disabled">): RowTone {
  if (value.state !== "known") return "warning";
  return value.value === "enabled" ? "success" : "warning";
}

function exposureTone(view: ProductionSafeguardView): RowTone {
  if (view.todayExposureCents.state !== "known" || view.dailyLimitCents.state !== "known") {
    return view.todayExposureCents.state === "known" ? "neutral" : "warning";
  }
  if (view.dailyLimitCents.value > 0 && view.todayExposureCents.value >= view.dailyLimitCents.value * 0.8) {
    return "warning";
  }
  return "neutral";
}

function capacityTone(view: ProductionSafeguardView): RowTone {
  if (view.remainingCapacityCents.state !== "known") return "warning";
  if (
    view.dailyLimitCents.state === "known" &&
    view.dailyLimitCents.value > 0 &&
    view.remainingCapacityCents.value <= view.dailyLimitCents.value * 0.2
  ) {
    return "warning";
  }
  return "neutral";
}

function toneClass(tone: RowTone) {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  return "text-foreground";
}
