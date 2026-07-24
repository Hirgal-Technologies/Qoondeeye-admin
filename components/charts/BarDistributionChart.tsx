"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function BarDistributionChart({
  data,
  xKey,
  yKey,
  color = "var(--series-1)",
  horizontal = false,
  valueFormatter,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  horizontal?: boolean;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        accessibilityLayer
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 8, left: horizontal ? 8 : -8, bottom: 0 }}
      >
        <CartesianGrid
          stroke="var(--gridline)"
          strokeDasharray="3 3"
          vertical={horizontal}
          horizontal={!horizontal}
        />
        {horizontal ? (
          <>
            <XAxis
              axisLine={false}
              type="number"
              stroke="var(--baseline)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={valueFormatter}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              type="category"
              dataKey={xKey}
              stroke="var(--baseline)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              width={96}
            />
          </>
        ) : (
          <>
            <XAxis
              axisLine={false}
              dataKey={xKey}
              minTickGap={20}
              stroke="var(--baseline)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              stroke="var(--baseline)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={valueFormatter}
              tickLine={false}
              width={52}
            />
          </>
        )}
        <Tooltip
          formatter={(value) =>
            typeof value === "number" && valueFormatter ? valueFormatter(value) : value
          }
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-popover)",
            fontSize: 12,
            color: "hsl(var(--popover-foreground))",
          }}
          cursor={{ fill: "hsl(var(--muted))" }}
        />
        <Bar
          dataKey={yKey}
          fill={color}
          isAnimationActive={false}
          maxBarSize={32}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
