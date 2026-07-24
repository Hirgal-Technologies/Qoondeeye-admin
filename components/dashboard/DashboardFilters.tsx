"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildDateRange, type DashboardRangeDays } from "@/lib/date-range";

export type DateRangeDays = DashboardRangeDays;

type DashboardFiltersValue = {
  days: DateRangeDays;
  setDays: (days: DateRangeDays) => void;
  rangeLabel: string;
  withDateRange: (path: string, params?: Record<string, string>) => string;
};

const DashboardFiltersContext = createContext<DashboardFiltersValue | null>(null);

export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<DateRangeDays>(30);

  const value = useMemo<DashboardFiltersValue>(() => {
    const range = buildDateRange(days);
    const rangeLabel = `Last ${days} days`;

    return {
      days,
      setDays,
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
  }, [days]);

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
