"use client";

import type { ReactNode } from "react";
import type { ZoneIcon } from "@/lib/floorplan";

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
  // Coffee counter: a cup with steam.
  coffee: <path d="M4 9h12v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V9zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />,
  // Patio: an umbrella over a table.
  patio: <path d="M3 10a9 6 0 0 1 18 0H3zM12 4v16M8 20h8" />,
  // Expo floor: a row of booths under one roof.
  booths: <path d="M5 4h14l2 5c0 1.4-1.3 2.5-3 2.5S15 10.4 15 9c0 1.4-1.3 2.5-3 2.5S9 10.4 9 9c0 1.4-1.3 2.5-3 2.5S3 10.4 3 9l2-5zM4 11v9h16v-9M10 20v-5h4v5" />,
  // Robot arena: a robot head.
  robot: <path d="M6 9h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 9V5M10 4h4M9 14v.5M15 14v.5M2 13v3M22 13v3" />,
};

export const ICON_STROKE = 2;

type ZoneLike = { code: string; icon?: string };

export function iconFor(zone: ZoneLike) {
  return zone.icon && zone.icon in zoneIconPaths ? zoneIconPaths[zone.icon as ZoneIcon] : null;
}

export const PIN_PATH = "M12 29s-11-9.4-11-17.2C1 5.6 5.9 1 12 1s11 4.6 11 10.8C23 19.6 12 29 12 29z";

// A zone everywhere in the app: the Spot pin with the zone's drawing inside,
// and its code (A–G) in a small badge on the corner.
export function ZoneMark({ zone, size = 32 }: { zone: ZoneLike; size?: number }) {
  const { code } = zone;
  const icon = iconFor(zone);
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
