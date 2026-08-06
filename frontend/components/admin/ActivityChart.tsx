"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/types/api";

type SeriesKey = "signups" | "listings" | "messages";

const SERIES: { key: SeriesKey; label: string; colour: string }[] = [
  { key: "signups", label: "Signups", colour: "var(--color-chart-signups)" },
  { key: "listings", label: "Listings", colour: "var(--color-chart-listings)" },
  { key: "messages", label: "Messages", colour: "var(--color-chart-messages)" },
];

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 22, left: 32 };

/**
 * Three daily series on one set of axes.
 *
 * Hand-drawn SVG rather than a charting library: the whole requirement is
 * three polylines and a few gridlines, and the smallest chart library would
 * add more to the bundle than the entire admin section currently weighs.
 *
 * Each series can be toggled off, because messages dwarf signups on any real
 * week and a shared y-axis otherwise flattens the other two into the floor.
 */
export function ActivityChart({ series }: { series: DailyPoint[] }) {
  const gradientId = useId();
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const shown = SERIES.filter((s) => !hidden.has(s.key));
  // Scaled against only the visible series, so hiding Messages actually
  // rescales the axis instead of leaving the others hugging zero.
  const max = Math.max(1, ...series.flatMap((p) => shown.map((s) => p[s.key])));

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Never let the last one be switched off — an empty chart is not a
      // state worth offering.
      return next.size === SERIES.length ? prev : next;
    });

  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const point = hover !== null ? series[hover] : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Activity</h2>
        <div className="flex flex-wrap gap-1.5">
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={!hidden.has(s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                hidden.has(s.key)
                  ? "border-border text-muted-foreground"
                  : "border-transparent bg-muted"
              )}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: hidden.has(s.key) ? "currentColor" : s.colour }}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-52 w-full min-w-[32rem]"
          role="img"
          aria-label={`Daily activity over the last ${series.length} days`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-signups)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-chart-signups)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="3 4"
              />
              <text
                x={PAD.left - 6}
                y={y(value) + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[9px] tabular-nums"
              >
                {value}
              </text>
            </g>
          ))}

          {shown.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.colour}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={series.map((p, i) => `${x(i)},${y(p[s.key])}`).join(" ")}
            />
          ))}

          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="currentColor"
              strokeOpacity="0.25"
            />
          )}

          {/* One invisible hit area per day, so hovering anywhere in the
              column works rather than needing to find a 2px line. */}
          {series.map((p, i) => (
            <rect
              key={p.date}
              x={x(i) - plotW / Math.max(series.length, 1) / 2}
              y={PAD.top}
              width={plotW / Math.max(series.length, 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {/* First and last dates only — one label per day is unreadable at
              30 days and pointless at 90. */}
          {[0, series.length - 1].map((i) =>
            series[i] ? (
              <text
                key={`label-${i}`}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : "end"}
                className="fill-muted-foreground text-[9px]"
              >
                {series[i].date}
              </text>
            ) : null
          )}
        </svg>
      </div>

      <p className="min-h-5 text-xs text-muted-foreground">
        {point ? (
          <>
            <span className="font-medium text-foreground">{point.date}</span>
            {shown.map((s) => (
              <span key={s.key} className="ml-3 tabular-nums">
                {s.label}: <span className="font-medium text-foreground">{point[s.key]}</span>
              </span>
            ))}
          </>
        ) : (
          "Hover the chart for a day's figures."
        )}
      </p>
    </div>
  );
}
