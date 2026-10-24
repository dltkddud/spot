// Where each zone sits on /floorplan.png (Palace of Fine Arts, first floor).
// Coordinates are pixels in the original 1622×1252 image, keyed by zone code.

export const FLOORPLAN = {
  src: "/floorplan.png",
  width: 1622,
  height: 1252,
  // The building itself, without the title block and legend.
  crop: { x: 60, y: 140, width: 1520, height: 760 },
};

// Every zone icon there is (drawings in components/ZoneIcon.tsx). Each zone stores one.
export type ZoneIcon =
  | "tent"
  | "columns"
  | "doors2"
  | "hallway"
  | "entrance"
  | "doors3"
  | "theater"
  | "coffee"
  | "patio"
  | "booths"
  | "robot";

// Events whose venue has this floor plan (events.floorPlan).
export const PALACE_FLOOR_PLAN = "palace-first-floor";

export const ZONE_MAP: Record<string, { x: number; y: number }> = {
  A: { x: 290, y: 465 },
  B: { x: 470, y: 395 },
  C: { x: 790, y: 360 },
  D: { x: 820, y: 500 },
  E: { x: 1110, y: 580 },
  F: { x: 1305, y: 610 },
  G: { x: 1275, y: 800 },
};
