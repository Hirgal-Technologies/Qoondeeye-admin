"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type LineSeries = {
  key: string;
  label?: string;
  color?: string;
  dashed?: boolean;
};

type LineTrendChartProps = {
  data: Record<string, unknown>[];
  xKey: string;
  yKey?: string;
  color?: string;
  series?: LineSeries[];
  valueFormatter?: (value: number) => string;
};

export function LineTrendChart({
  data,
  xKey,
  yKey,
  color = "var(--series-1)",
  series,
  valueFormatter,
}: LineTrendChartProps) {
  const lines =
    series ??
    (yKey
      ? [{ key: yKey, color }]
      : []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--gridline)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey={xKey}
          minTickGap={28}
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
          cursor={{ stroke: "var(--baseline)", strokeDasharray: "3 3" }}
        />
        {lines.map((item) => (
          <Line
            dataKey={item.key}
            dot={false}
            isAnimationActive={false}
            key={item.key}
            name={item.label ?? item.key}
            stroke={item.color ?? "var(--series-1)"}
            strokeDasharray={item.dashed ? "5 5" : undefined}
            strokeLinecap="round"
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
