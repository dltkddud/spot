import type { ChatRequest, Role, ShareWith, Status, Zone } from "./types";
import { PALACE_FLOOR_PLAN, type ZoneIcon } from "./floorplan";

const MIN = 60_000;

// A demo person: their profile and their part in one event, as one record.
export type MockPerson = {
  id: string; // seed key, e.g. "p-dana"
  name: string;
  role: Role;
  headline: string;
  talkTitle?: string;
  interests: string[];
  outfit: string;
  linkedinUrl?: string;
  contactUrl?: string;
  zoneId?: string;
  status: Status;
  leavingAt?: number;
  visible: boolean;
  shareWith?: ShareWith;
  requestsPaused: boolean;
  updatedAt: number;
};

export type MockZone = Zone & { icon: ZoneIcon };

export type MockEvent = {
  key: string;
  name: string;
  venue: string;
  startsAt: number;
  endsAt: number;
  // Set when the venue has a floor plan in public/ (see floorplan.ts).
  floorPlan?: string;
  zones: MockZone[];
  people: (now: number) => MockPerson[];
  requests: (now: number) => ChatRequest[];
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

export function makeUsers(now: number): MockPerson[] {
  return [
    {
      id: "p-dana",
      name: "Dana Whitfield",
      role: "panel",
      headline: "Staff engineer building voice agents",
      talkTitle: "Shipping voice agents that don't interrupt you",
      interests: ["Voice AI", "Agents", "Careers"],
      outfit: "navy hoodie, white cap",
      linkedinUrl: "https://www.linkedin.com/in/spot-demo-dana-whitfield",
      contactUrl: "https://example.com/dana",
      zoneId: "z-atrium",
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
      linkedinUrl: "https://www.linkedin.com/in/spot-demo-priya-natarajan",
      contactUrl: "https://example.com/priya",
      zoneId: "z-pavilion",
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
      zoneId: "z-broadway-3",
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
      linkedinUrl: "https://www.linkedin.com/in/spot-demo-sofia-alvarez",
      zoneId: "z-breakout-1",
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
      zoneId: "z-breakout-5",
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
      linkedinUrl: "https://www.linkedin.com/in/spot-demo-ahmed-hassan",
      zoneId: "z-theater",
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
      zoneId: "z-atrium",
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
      zoneId: "z-breakout-1",
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
      zoneId: "z-pavilion",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 2 * MIN,
    },
    {
      id: "a-maya",
      name: "Maya Chen",
      role: "attendee",
      headline: "Bootcamp grad looking for a first frontend job",
      interests: ["Frontend", "Careers"],
      outfit: "red flannel, white sneakers",
      zoneId: "z-atrium",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 3 * MIN,
    },
    {
      id: "a-omar",
      name: "Omar Haddad",
      role: "attendee",
      headline: "Building an agent that books lab equipment",
      interests: ["Agents", "Startups"],
      outfit: "blue cap, sticker-covered laptop bag",
      zoneId: "z-atrium",
      status: "talking",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 1 * MIN,
    },
    {
      id: "a-jin",
      name: "Jin Park",
      role: "attendee",
      headline: "Exchange student who tinkers with hardware",
      interests: ["Hardware", "Robotics"],
      outfit: "grey hoodie, yellow tote",
      zoneId: "z-atrium",
      status: "available",
      visible: false,
      requestsPaused: false,
      updatedAt: now - 4 * MIN,
    },
    {
      id: "a-sara",
      name: "Sara Okafor",
      role: "attendee",
      headline: "Volunteer mapping climate data for her city",
      interests: ["Climate", "Data science"],
      outfit: "green scarf, denim jacket",
      zoneId: "z-atrium",
      status: "available",
      visible: false,
      requestsPaused: false,
      updatedAt: now - 6 * MIN,
    },
    {
      id: "a-leo",
      name: "Leo Martins",
      role: "attendee",
      headline: "Graphic designer moving into product design",
      interests: ["Design", "Startups"],
      outfit: "black turtleneck, canvas tote",
      zoneId: "z-theater",
      status: "available",
      // Shares their zone only with connections; "Connect me with demo friends" reveals it.
      visible: false,
      shareWith: "connections",
      requestsPaused: false,
      updatedAt: now - 2 * MIN,
    },
    {
      id: "a-nina",
      name: "Nina Rossi",
      role: "attendee",
      headline: "Fintech intern curious about engineering careers",
      interests: ["Fintech", "Careers"],
      outfit: "white blazer, red backpack",
      zoneId: "z-theater",
      status: "available",
      visible: false,
      requestsPaused: false,
      updatedAt: now - 9 * MIN,
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

function foundersPeople(now: number): MockPerson[] {
  return [
    {
      id: "fc-grace",
      name: "Grace Liu",
      role: "panel",
      headline: "Seed investor who used to be an engineer",
      talkTitle: "What I look for in first-time founders",
      interests: ["Startups", "Fintech", "Careers"],
      outfit: "camel coat, red scarf",
      linkedinUrl: "https://www.linkedin.com/in/spot-demo-grace-liu",
      zoneId: "fc-coffee",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 3 * MIN,
    },
    {
      id: "fc-ben",
      name: "Ben Carter",
      role: "panel",
      headline: "Founder of a two-person climate startup",
      talkTitle: "How we found our first 100 customers",
      interests: ["Climate", "Startups"],
      outfit: "olive jacket, black beanie",
      zoneId: "fc-patio",
      status: "talking",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 5 * MIN,
    },
    {
      id: "fc-hana",
      name: "Hana Sato",
      role: "attendee",
      headline: "Product designer thinking about starting something",
      interests: ["Design", "Startups"],
      outfit: "white sweater, tote bag",
      zoneId: "fc-nave",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 2 * MIN,
    },
    {
      id: "fc-diego",
      name: "Diego Morales",
      role: "attendee",
      headline: "Data analyst at a payments startup",
      interests: ["Fintech", "Data science"],
      outfit: "blue shirt, brown boots",
      zoneId: "fc-coffee",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 4 * MIN,
    },
  ];
}

function roboticsPeople(now: number): MockPerson[] {
  return [
    {
      id: "rx-ravi",
      name: "Ravi Mehta",
      role: "panel",
      headline: "Builds robots for warehouses",
      talkTitle: "Robots that work safely next to people",
      interests: ["Robotics", "Hardware"],
      outfit: "orange vest, grey hoodie",
      linkedinUrl: "https://www.linkedin.com/in/spot-demo-ravi-mehta",
      zoneId: "rx-stage",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 2 * MIN,
    },
    {
      id: "rx-elena",
      name: "Elena Petrova",
      role: "panel",
      headline: "Runs a robotics club for teens",
      talkTitle: "Teaching robotics on a tiny budget",
      interests: ["Robotics", "Careers"],
      outfit: "green cardigan, round glasses",
      zoneId: "rx-arena",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 6 * MIN,
    },
    {
      id: "rx-sam",
      name: "Sam Okoro",
      role: "attendee",
      headline: "Mechanical engineering student",
      interests: ["Hardware", "Robotics"],
      outfit: "black jacket, yellow backpack",
      zoneId: "rx-floor",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 3 * MIN,
    },
    {
      id: "rx-mia",
      name: "Mia Novak",
      role: "attendee",
      headline: "Building an agent that plans robot tasks",
      interests: ["Agents", "Robotics"],
      outfit: "red hoodie, white sneakers",
      zoneId: "rx-alley",
      status: "available",
      visible: true,
      requestsPaused: false,
      updatedAt: now - 1 * MIN,
    },
  ];
}

export const EVENTS: MockEvent[] = [
  {
    key: CAL_HACKS_KEY,
    name: "Cal Hacks 13.0",
    venue: "Palace of Fine Arts",
    startsAt: Date.UTC(2026, 9, 24, 16, 0, 0), // Sat Oct 24, 9:00 AM
    endsAt: EVENT_ENDS_AT,
    floorPlan: PALACE_FLOOR_PLAN,
    zones: ZONES,
    people: makeUsers,
    requests: makeRequests,
  },
  {
    key: "founders-coffee-sf",
    name: "Founders & Coffee SF",
    venue: "Ferry Building, San Francisco",
    startsAt: Date.UTC(2026, 9, 29, 15, 0, 0), // Thu Oct 29, 8:00 AM
    endsAt: Date.UTC(2026, 9, 29, 18, 0, 0), // 11:00 AM
    zones: FOUNDERS_ZONES,
    people: foundersPeople,
    requests: (now) => [
      {
        id: "fc-r1",
        panelId: "fc-grace",
        attendeeId: "fc-hana",
        note: "How early is too early to talk to investors?",
        status: "waiting",
        createdAt: now - 6 * MIN,
      },
    ],
  },
  {
    key: "bay-area-robotics-expo",
    name: "Bay Area Robotics Expo",
    venue: "Moscone West, San Francisco",
    startsAt: Date.UTC(2026, 10, 7, 18, 0, 0), // Sat Nov 7, 10:00 AM
    endsAt: Date.UTC(2026, 10, 8, 1, 0, 0), // 5:00 PM
    zones: ROBOTICS_ZONES,
    people: roboticsPeople,
    requests: (now) => [
      {
        id: "rx-r1",
        panelId: "rx-ravi",
        attendeeId: "rx-sam",
        note: "Which sensors would you start with for a first robot?",
        status: "waiting",
        createdAt: now - 7 * MIN,
      },
      {
        id: "rx-r2",
        panelId: "rx-ravi",
        attendeeId: "rx-mia",
        note: "",
        status: "waiting",
        createdAt: now - 2 * MIN,
      },
    ],
  },
];
