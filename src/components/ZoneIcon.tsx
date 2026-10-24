"use client";

import type { ReactNode } from "react";
import { ZONE_MAP, type ZoneIcon } from "@/lib/floorplan";

// One drawing per zone, all on a 24px grid with the same 2px stroke, so they
// read as one set at any size.
export const zoneIconPaths: Record<ZoneIcon, ReactNode> = {
  // Pavilion: a big tent roof with an open flap.
  tent: <path d="M12 3 2 20h20L12 3zM9 20l3-6 3 6" />,
  // Atrium: a wide hall held up by columns.
  columns: <path d="M3 9 12 4l9 5M4 9h16M6 9v9M12 9v9M18 9v9M3 20h18" />,
  // Breakouts 1–4: rooms, two doors.
  doors2: <path d="M2 20h20M4 20V5h7v15M13 20V5h7v15M9 13v.5M15 13v.5" />,
  // Broadway: a long hallway you walk down.
  hallway: <path d="M2 5h20M2 19h20M6 12h12M15 9l3 3-3 3" />,
  // Broadway 3: the corner by the east side doors.
  entrance: <path d="M2 20h20M13 20V4h7v16M3 12h7M7 9l3 3-3 3M16 12v.5" />,
  // Breakouts 5–7: rooms, three doors.
  doors3: <path d="M2 20h20M3 20V6h5v14M9.5 20V6h5v14M16 20V6h5v14M6.5 13v.5M13 13v.5M19.5 13v.5" />,
  // Theater: a stage with the curtains pulled back.
  theater: <path d="M2 4h20M4 4v16M20 4v16M4 4c1 6 3 9 6 10M20 4c-1 6-3 9-6 10M2 20h20" />,
};

export const ICON_STROKE = 2;

export function iconFor(code: string) {
  const name = ZONE_MAP[code]?.icon;
  return name ? zoneIconPaths[name] : null;
}

export const PIN_PATH = "M12 29s-11-9.4-11-17.2C1 5.6 5.9 1 12 1s11 4.6 11 10.8C23 19.6 12 29 12 29z";

// A zone everywhere in the app: the Spot pin with the zone's drawing inside,
// and its code (A–G) in a small badge on the corner.
export function ZoneMark({ code, size = 32 }: { code: string; size?: number }) {
  const icon = iconFor(code);
  const badge = Math.max(15, Math.round(size * 0.42));
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size * 0.8, height: size }}
      role="img"
      aria-label={`Zone ${code}`}
    >
      <svg width={size * 0.8} height={size} viewBox="0 0 24 30" aria-hidden className="absolute inset-0">
        <path d={PIN_PATH} fill="var(--primary)" />
        <g
          transform="translate(5 4.5) scale(0.5833)"
          fill="none"
          stroke="var(--on-primary)"
          strokeWidth={ICON_STROKE * 1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </g>
      </svg>
      <span
        className="absolute grid place-items-center rounded-full border-2 border-surface bg-ink font-black leading-none text-surface"
        style={{ width: badge, height: badge, fontSize: badge * 0.58, top: -badge * 0.25, right: -badge * 0.45 }}
        aria-hidden
      >
        {code}
      </span>
    </span>
  );
}
