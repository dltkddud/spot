"use client";

import type { KeyboardEvent } from "react";
import { FLOORPLAN, ZONE_MAP } from "@/lib/floorplan";
import type { Zone } from "@/lib/types";
import { ICON_STROKE, iconFor, PIN_PATH } from "./ZoneIcon";

const FOCUS = { width: 560, height: 300 };

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

type Props = {
  zones: Zone[];
  selectedId?: string;
  myZoneId?: string;
  onSelect?: (zoneId: string) => void;
  // Zoom in on one zone, like a close-up of its landmark.
  focusId?: string;
};

export function FloorPlan({ zones, selectedId, myZoneId, onSelect, focusId }: Props) {
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
            <ellipse rx={7 * k} ry={2.6 * k} fill="var(--primary)" opacity={0.3} />
            <g transform={`translate(${-12 * k} ${-29 * k}) scale(${k})`} className="transition-transform">
              <path
                d={PIN_PATH}
                fill="var(--primary)"
                stroke={selected ? "var(--ink)" : "var(--surface)"}
                strokeWidth={selected ? 2.4 : 1.6}
              />
              <g
                transform="translate(5 4.5) scale(0.5833)"
                fill="none"
                stroke="var(--on-primary)"
                strokeWidth={ICON_STROKE * 1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {iconFor(z)}
              </g>
              <circle cx="21" cy="3.5" r="5" fill="var(--ink)" stroke="var(--surface)" strokeWidth="1.2" />
              <text x="21" y="5.8" textAnchor="middle" fontSize="6.6" fontWeight="900" fill="var(--surface)">
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
