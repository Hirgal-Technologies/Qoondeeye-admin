"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function PieBreakdownChart({
  data,
  nameKey,
  valueKey,
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart accessibilityLayer>
        <Pie
          data={data}
          dataKey={valueKey}
          innerRadius="58%"
          isAnimationActive={false}
          nameKey={nameKey}
          outerRadius="78%"
          paddingAngle={2}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Legend
          height={32}
          verticalAlign="bottom"
          wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-popover)",
            fontSize: 12,
            color: "hsl(var(--popover-foreground))",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
