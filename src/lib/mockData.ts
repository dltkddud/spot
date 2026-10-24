import type { ChatRequest, EventInfo, User, Zone } from "./types";

const MIN = 60_000;

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

export const ZONES: Zone[] = [
  { id: "z-main", code: "A", name: "Main Stage", landmark: "Facing the big screen" },
  { id: "z-coffee", code: "B", name: "Coffee Bar", landmark: "Next to the tall stone pillar" },
  { id: "z-sponsor-a", code: "C", name: "Sponsor Row A", landmark: "Left wall, blue banners" },
  { id: "z-sponsor-b", code: "D", name: "Sponsor Row B", landmark: "Right wall, under the skylight" },
  { id: "z-workshop", code: "E", name: "Workshop Rooms", landmark: "Upstairs hallway" },
  { id: "z-hardware", code: "F", name: "Hardware Lab", landmark: "Back corner, by the 3D printers" },
  { id: "z-lounge", code: "G", name: "Entrance Lounge", landmark: "Beanbags near the front doors" },
];

// Sun Oct 25, 2026, 4:00 PM in San Francisco (PDT, UTC-7).
export const EVENT_ENDS_AT = Date.UTC(2026, 9, 25, 23, 0, 0);

export function makeEvent(): EventInfo {
  return {
    id: "evt-1",
    name: "Cal Hacks 13.0",
    venue: "Palace of Fine Arts",
    endsAt: EVENT_ENDS_AT,
  };
}

export function makeUsers(now: number): User[] {
  return [
    {
      id: "p-dana",
      name: "Dana Whitfield",
      role: "panel",
      headline: "Staff engineer building voice agents",
      talkTitle: "Shipping voice agents that don't interrupt you",
      interests: ["Voice AI", "Agents", "Careers"],
      outfit: "navy hoodie, white cap",
      contactUrl: "https://example.com/dana",
      zoneId: "z-coffee",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 2 * MIN,
    },
    {
      id: "p-priya",
      name: "Priya Natarajan",
      role: "panel",
      headline: "Design lead for glanceable interfaces",
      talkTitle: "Designing for screens you only look at for a second",
      interests: ["Design", "Frontend", "Hardware"],
      outfit: "yellow sweater, round glasses",
      contactUrl: "https://example.com/priya",
      zoneId: "z-main",
      status: "leaving",
      leavingAt: now + 8 * MIN,
      visible: true,
      requestsPaused: false,
      updatedAt: now - 1 * MIN,
    },
    {
      id: "p-marco",
      name: "Marco Ruiz",
      role: "panel",
      headline: "Founder, wildfire risk from satellite data",
      talkTitle: "What satellites can tell you about wildfire risk",
      interests: ["Climate", "Data science", "Startups"],
      outfit: "green jacket, canvas tote",
      zoneId: "z-sponsor-b",
      status: "talking",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 6 * MIN,
    },
    {
      id: "p-sofia",
      name: "Sofia Alvarez",
      role: "panel",
      headline: "Research scientist, LLM evaluation",
      talkTitle: "How we test language models for bias",
      interests: ["LLM evaluation", "Agents", "Data science"],
      outfit: "denim jacket, green backpack",
      zoneId: "z-workshop",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 4 * MIN,
    },
    {
      id: "p-kenji",
      name: "Kenji Mori",
      role: "panel",
      headline: "Maker showing a pocket-sized robot arm kit",
      talkTitle: "Demo: a robot arm that fits in your backpack",
      interests: ["Robotics", "Hardware", "Startups"],
      outfit: "black tee, red lanyard",
      zoneId: "z-hardware",
      status: "available",
      visible: true,
      requestsPaused: true,
      updatedAt: now - 22 * MIN,
    },
    {
      id: "p-ahmed",
      name: "Ahmed Hassan",
      role: "panel",
      headline: "Engineering manager at a payments company",
      talkTitle: "From intern to engineering manager in four years",
      interests: ["Fintech", "Careers", "Frontend"],
      outfit: "grey blazer, white sneakers",
      zoneId: "z-lounge",
      status: "leaving",
      leavingAt: now + 25 * MIN,
      visible: true,
      requestsPaused: false,
      updatedAt: now - 3 * MIN,
    },
    {
      id: "a-lena",
      name: "Lena Fischer",
      role: "attendee",
      headline: "CS junior building a voice journaling app",
      interests: ["Voice AI", "Frontend"],
      outfit: "orange beanie, grey coat",
      zoneId: "z-coffee",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 5 * MIN,
    },
    {
      id: "a-tomas",
      name: "Tomás Rivera",
      role: "attendee",
      headline: "Data science master's student, curious about evals",
      interests: ["LLM evaluation", "Data science"],
      outfit: "white shirt, black backpack",
      zoneId: "z-workshop",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 7 * MIN,
    },
    {
      id: "a-aisha",
      name: "Aisha Bello",
      role: "attendee",
      headline: "First hackathon, learning frontend",
      interests: ["Design", "Frontend", "Careers"],
      outfit: "purple jacket, headphones",
      zoneId: "z-main",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 2 * MIN,
    },
  ];
}

export function makeRequests(now: number): ChatRequest[] {
  return [
    {
      id: "r-1",
      panelId: "p-dana",
      attendeeId: "a-lena",
      note: "How do you handle people talking over the agent?",
      status: "waiting",
      createdAt: now - 9 * MIN,
    },
    {
      id: "r-2",
      panelId: "p-dana",
      attendeeId: "a-aisha",
      note: "What should a beginner build first with voice?",
      status: "waiting",
      createdAt: now - 4 * MIN,
    },
    {
      id: "r-3",
      panelId: "p-sofia",
      attendeeId: "a-tomas",
      note: "Which bias tests are worth running on a small model?",
      status: "waiting",
      createdAt: now - 6 * MIN,
    },
    {
      id: "r-4",
      panelId: "p-priya",
      attendeeId: "a-aisha",
      note: "",
      status: "waiting",
      createdAt: now - 3 * MIN,
    },
  ];
}
