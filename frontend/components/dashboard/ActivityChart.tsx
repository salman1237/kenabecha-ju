"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

import type { ActivityPoint } from "@/types/api";

/**
 * Hand-rolled area chart. No charting library is installed and this needs
 * exactly one shape — an axis-less trend line with a soft fill — so pulling
 * in Recharts for it would be a lot of bundle for very little.
 */
export function ActivityChart({ data, height = 120 }: { data: ActivityPoint[]; height?: number }) {
  const { line, area, max, total } = useMemo(() => {
    const w = 100;
    const h = 100;
    const counts = data.map((d) => d.count);
    // A flat-zero series would divide by zero; floor the denominator at 1
    // so an empty month draws a flat baseline instead of NaN paths.
    const max = Math.max(1, ...counts);
    const step = data.length > 1 ? w / (data.length - 1) : w;

    const pts = data.map((d, i) => {
      const x = i * step;
      const y = h - (d.count / max) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    return {
      line: `M ${pts.join(" L ")}`,
      area: `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`,
      max,
      total: counts.reduce((a, b) => a + b, 0),
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Listings posted</span>
        <span className="text-xs text-muted-foreground">
          {total} in the last {data.length} days · peak {max}/day
        </span>
      </div>

      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`Listings posted per day over the last ${data.length} days, ${total} total`}
        >
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Faint horizontal guides */}
          {[0, 50, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <motion.path
            d={area}
            fill="url(#activity-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          <motion.path
            d={line}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            // non-scaling-stroke keeps the line an even weight despite the
            // non-uniform viewBox stretch from preserveAspectRatio="none".
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0] ? new Date(data[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
        <span>
          {data.at(-1)
            ? new Date(data.at(-1)!.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : ""}
        </span>
      </div>
    </div>
  );
}
