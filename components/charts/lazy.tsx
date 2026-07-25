"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/states/StatePanel";

// Recharts is the single heaviest dependency in the client bundle. Loading the
// chart components on demand keeps it out of the initial route JS; the
// skeleton bridges the gap alongside the data fetch that is already running.
export const LineTrendChart = dynamic(
  () => import("./LineTrendChart").then((mod) => mod.LineTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const BarDistributionChart = dynamic(
  () => import("./BarDistributionChart").then((mod) => mod.BarDistributionChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const PieBreakdownChart = dynamic(
  () => import("./PieBreakdownChart").then((mod) => mod.PieBreakdownChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
