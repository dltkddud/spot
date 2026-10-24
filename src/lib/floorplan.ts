// Where each zone sits on /floorplan.png (Palace of Fine Arts, first floor).
// Coordinates are pixels in the original 1622×1252 image, keyed by zone code.

export const FLOORPLAN = {
  src: "/floorplan.png",
  width: 1622,
  height: 1252,
  // The building itself, without the title block and legend.
  crop: { x: 60, y: 140, width: 1520, height: 760 },
};

export type ZoneIcon = "tent" | "columns" | "doors2" | "hallway" | "entrance" | "doors3" | "theater";

export const ZONE_MAP: Record<string, { x: number; y: number; icon: ZoneIcon }> = {
  A: { x: 290, y: 465, icon: "tent" },
  B: { x: 470, y: 395, icon: "columns" },
  C: { x: 790, y: 360, icon: "doors2" },
  D: { x: 820, y: 500, icon: "hallway" },
  E: { x: 1110, y: 580, icon: "entrance" },
  F: { x: 1305, y: 610, icon: "doors3" },
  G: { x: 1275, y: 800, icon: "theater" },
};
