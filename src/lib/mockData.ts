import type { Zone } from "./types";
import { PALACE_FLOOR_PLAN, type ZoneIcon } from "./floorplan";

export type MockZone = Zone & { icon: ZoneIcon };

// An event seed.ensure creates (or keeps in line): its details and zones.
// People only come from real sign-ups.
export type MockEvent = {
  key: string;
  name: string;
  venue: string;
  startsAt: number;
  endsAt: number;
  // Set when the venue has a floor plan in public/ (see floorplan.ts).
  floorPlan?: string;
  zones: MockZone[];
};

export const INTEREST_OPTIONS = [
  "Voice AI",
  "Agents",
  "LLM evaluation",
  "Design",
  "Hardware",
  "Robotics",
  "Climate",
  "Fintech",
  "Startups",
  "Careers",
  "Data science",
  "Frontend",
];

export const OUTFIT_WORD_LIMIT = 6;

// Codes stay fixed so saved locations survive renames. Map positions live in floorplan.ts.
export const ZONES: MockZone[] = [
  { id: "z-pavilion", code: "A", name: "Pavilion", landmark: "West end, next to the Green Rooms", icon: "tent" },
  { id: "z-atrium", code: "B", name: "Atrium", landmark: "Big open hall inside the Public Entrance", icon: "columns" },
  { id: "z-breakout-1", code: "C", name: "Breakouts 1–4", landmark: "Round room and side rooms off the Atrium", icon: "doors2" },
  { id: "z-broadway", code: "D", name: "Broadway", landmark: "Long hallway past Breakouts 1 to 4", icon: "hallway" },
  { id: "z-broadway-3", code: "E", name: "Broadway 3", landmark: "Open corner by the east side doors", icon: "entrance" },
  { id: "z-breakout-5", code: "F", name: "Breakouts 5–7", landmark: "East wing rooms by the stairs", icon: "doors3" },
  { id: "z-theater", code: "G", name: "Theater", landmark: "Under the glass dome, by the Business Entrance", icon: "theater" },
];

// Sun Oct 25, 2026, 4:00 PM in San Francisco (PDT, UTC-7).
export const EVENT_ENDS_AT = Date.UTC(2026, 9, 25, 23, 0, 0);

export const CAL_HACKS_KEY = "calhacks-13";

// Two smaller events after Cal Hacks, so the Events list has somewhere else to go.
// Times are in San Francisco: PDT (UTC-7) until Nov 1, PST (UTC-8) after.
const FOUNDERS_ZONES: MockZone[] = [
  { id: "fc-nave", code: "A", name: "Grand Nave", landmark: "Long skylit hall down the middle", icon: "columns" },
  { id: "fc-coffee", code: "B", name: "Coffee Counter", landmark: "By the espresso bar, near the clock tower doors", icon: "coffee" },
  { id: "fc-patio", code: "C", name: "Bay Patio", landmark: "Outside facing the water, by the benches", icon: "patio" },
  { id: "fc-room", code: "D", name: "Meeting Room", landmark: "Second floor, up the north stairs", icon: "doors2" },
];

const ROBOTICS_ZONES: MockZone[] = [
  { id: "rx-floor", code: "A", name: "Expo Floor", landmark: "Rows of booths past registration", icon: "booths" },
  { id: "rx-stage", code: "B", name: "Demo Stage", landmark: "Big screen at the far end of the hall", icon: "theater" },
  { id: "rx-arena", code: "C", name: "Robot Arena", landmark: "Netted ring in the middle of the floor", icon: "robot" },
  { id: "rx-alley", code: "D", name: "Startup Alley", landmark: "Narrow aisle along the east wall", icon: "hallway" },
];

export const EVENTS: MockEvent[] = [
  {
    key: CAL_HACKS_KEY,
    name: "Cal Hacks 13.0",
    venue: "Palace of Fine Arts",
    startsAt: Date.UTC(2026, 9, 24, 16, 0, 0), // Sat Oct 24, 9:00 AM
    endsAt: EVENT_ENDS_AT,
    floorPlan: PALACE_FLOOR_PLAN,
    zones: ZONES,
  },
  {
    key: "founders-coffee-sf",
    name: "Founders & Coffee SF",
    venue: "Ferry Building, San Francisco",
    startsAt: Date.UTC(2026, 9, 29, 15, 0, 0), // Thu Oct 29, 8:00 AM
    endsAt: Date.UTC(2026, 9, 29, 18, 0, 0), // 11:00 AM
    zones: FOUNDERS_ZONES,
  },
  {
    key: "bay-area-robotics-expo",
    name: "Bay Area Robotics Expo",
    venue: "Moscone West, San Francisco",
    startsAt: Date.UTC(2026, 10, 7, 18, 0, 0), // Sat Nov 7, 10:00 AM
    endsAt: Date.UTC(2026, 10, 8, 1, 0, 0), // 5:00 PM
    zones: ROBOTICS_ZONES,
  },
];
