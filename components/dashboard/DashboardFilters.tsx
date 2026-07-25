"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildCustomDateRange,
  buildDateRange,
  type DashboardRangeDays,
} from "@/lib/date-range";

export type DateRangeDays = DashboardRangeDays;

type DashboardFiltersValue = {
  days: DateRangeDays;
  setDays: (days: DateRangeDays) => void;
  isCustomRange: boolean;
  fromDate: string;
  toDate: string;
  setCustomRange: (fromDate: string, toDate: string) => void;
  rangeLabel: string;
  withDateRange: (path: string, params?: Record<string, string>) => string;
};

const DashboardFiltersContext = createContext<DashboardFiltersValue | null>(null);

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [days, setDaysState] = useState<DateRangeDays>(30);
  const [customRange, setCustomRangeState] = useState<{
    fromDate: string;
    toDate: string;
  } | null>(null);

  const value = useMemo<DashboardFiltersValue>(() => {
    const range = customRange
      ? buildCustomDateRange(customRange.fromDate, customRange.toDate)
      : buildDateRange(days);
    const rangeLabel = customRange
      ? `${formatDate(customRange.fromDate)} – ${formatDate(customRange.toDate)}`
      : `Last ${days} days`;

    return {
      days,
      setDays(nextDays) {
        setDaysState(nextDays);
        setCustomRangeState(null);
      },
      isCustomRange: customRange !== null,
      fromDate: range.from.slice(0, 10),
      toDate: range.to.slice(0, 10),
      setCustomRange(fromDate, toDate) {
        setCustomRangeState({ fromDate, toDate });
      },
      rangeLabel,
      withDateRange(path, params = {}) {
        const query = new URLSearchParams({
          from: range.from,
          to: range.to,
          granularity: range.granularity,
          ...params,
        });
        return `${path}?${query.toString()}`;
      },
    };
  }, [customRange, days]);

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const value = useContext(DashboardFiltersContext);
  if (!value) {
    throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider");
  }
  return value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
