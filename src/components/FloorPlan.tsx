"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { FLOORPLAN, ZONE_MAP, type ZoneIcon } from "@/lib/floorplan";
import type { CrowdLevel, Zone } from "@/lib/types";

const PIN = "M12 29s-11-9.4-11-17.2C1 5.6 5.9 1 12 1s11 4.6 11 10.8C23 19.6 12 29 12 29z";

const pinFill: Record<CrowdLevel, string> = {
  busy: "var(--crowd)",
  some: "var(--primary)",
  quiet: "var(--quiet)",
};

const pinText: Record<CrowdLevel, string> = {
  busy: "#1b1205",
  some: "var(--on-primary)",
  quiet: "var(--ink)",
};

const FOCUS = { width: 560, height: 300 };

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

type Props = {
  zones: Zone[];
  activity: Record<string, CrowdLevel>;
  selectedId?: string;
  myZoneId?: string;
  onSelect?: (zoneId: string) => void;
  // Zoom in on one zone, like a close-up of its landmark.
  focusId?: string;
};

export function FloorPlan({ zones, activity, selectedId, myZoneId, onSelect, focusId }: Props) {
  const focus = focusId ? ZONE_MAP[zones.find((z) => z.id === focusId)?.code ?? ""] : undefined;
  const vb = focus
    ? {
        x: clamp(focus.x - FOCUS.width / 2, FLOORPLAN.width - FOCUS.width),
        y: clamp(focus.y - FOCUS.height / 2 - 30, FLOORPLAN.height - FOCUS.height),
        ...FOCUS,
      }
    : FLOORPLAN.crop;
  // Pins are drawn in image pixels, so scale them to a similar size on screen
  // in the full plan and the close-up.
  const scale = focus ? (vb.width / FLOORPLAN.crop.width) * 3.2 : 4.4;
  const shown = focus ? zones.filter((z) => z.id === focusId) : zones;

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      className="block w-full overflow-hidden rounded-2xl border border-line bg-surface"
      role="group"
      aria-label="Venue floor plan"
    >
      <image
        href={FLOORPLAN.src}
        width={FLOORPLAN.width}
        height={FLOORPLAN.height}
        className="floorplan-img"
        preserveAspectRatio="none"
      />
      {shown.map((z) => {
        const pos = ZONE_MAP[z.code];
        if (!pos) return null;
        const level = activity[z.id] ?? "quiet";
        const selected = z.id === selectedId;
        const k = scale * (selected ? 1.3 : 1);
        const select = onSelect ? () => onSelect(z.id) : undefined;
        const onKeyDown = (e: KeyboardEvent) => {
          if (select && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            select();
          }
        };
        return (
          <g
            key={z.id}
            transform={`translate(${pos.x} ${pos.y})`}
            role={select ? "button" : undefined}
            tabIndex={select ? 0 : undefined}
            aria-label={select ? `${z.code}, ${z.name}` : undefined}
            aria-pressed={select ? selected : undefined}
            onClick={select}
            onKeyDown={onKeyDown}
            className={select ? "cursor-pointer" : undefined}
          >
            {level === "busy" && <circle r={13 * k} fill="var(--crowd)" className="crowd-pulse" />}
            <ellipse rx={7 * k} ry={2.6 * k} fill={pinFill[level]} opacity={0.35} />
            <g transform={`translate(${-12 * k} ${-29 * k}) scale(${k})`} className="transition-transform">
              <path
                d={PIN}
                fill={pinFill[level]}
                stroke={selected ? "var(--ink)" : "var(--surface)"}
                strokeWidth={selected ? 2.4 : 1.6}
              />
              <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="900" fill={pinText[level]}>
                {z.code}
              </text>
            </g>
            {z.id === myZoneId && (
              <text
                y={9 * k}
                textAnchor="middle"
                fontSize={7 * k}
                fontWeight="800"
                fill="var(--primary-ink)"
                stroke="var(--surface)"
                strokeWidth={2.2 * k}
                paintOrder="stroke"
              >
                You
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function CrowdLegend() {
  const items: [CrowdLevel, string][] = [
    ["busy", "Busy"],
    ["some", "Some people"],
    ["quiet", "Quiet"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
      {items.map(([level, label]) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: pinFill[level] }} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

const glyphs: Record<ZoneIcon, ReactNode> = {
  columns: <path d="M4 20h16M5 8h14M6 5h12l1 3H5l1-3zM7 8v12M12 8v12M17 8v12" />,
  hall: <path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6" />,
  rooms: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  hallway: <path d="M3 9h18M3 15h18M7 12h2M15 12h2M11 12h2" />,
  doors: <path d="M4 21V4h7v17M13 21V4h7v17M9 12v1M15 12v1M2 21h20" />,
  stairs: <path d="M3 20h5v-5h5v-5h5V5h3" />,
  dome: <path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 11V8M8 13l-1.5-1.5M16 13l1.5-1.5M3 21h18" />,
};

// A simple drawing that stands for each zone's landmark.
export function ZoneGlyph({ code, size = 28 }: { code: string; size?: number }) {
  const icon = ZONE_MAP[code]?.icon;
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {glyphs[icon]}
    </svg>
  );
}
