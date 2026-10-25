export type Role = "panel" | "attendee";

export type Status = "available" | "talking" | "leaving";

export type RequestStatus = "waiting" | "accepted" | "met" | "declined" | "missed" | "cancelled";

export type EventInfo = {
  id: string;
  name: string;
  venue: string;
  startsAt?: number;
  endsAt: number;
  // Set when the venue has a floor plan to show on the Map.
  floorPlan?: string;
};

export type Zone = {
  id: string;
  code: string;
  name: string;
  landmark: string;
  icon?: string;
};

// Me across every event: who I am, how to reach me, my connect code.
export type Profile = {
  id: string;
  name: string;
  headline: string;
  interests: string[];
  linkedinUrl?: string;
  contactUrl?: string;
  connectCode?: string;
  openToHuddles?: boolean;
};

// An event I've joined and how I'm there.
export type Participation = {
  eventId: string;
  userId: string;
  role: Role;
};

// Someone at an event: their part in it, with their profile filled in.
// id is the event-specific id that requests and huddles use.
export type User = {
  id: string;
  profileId: string;
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
  requestsPaused: boolean;
  updatedAt: number;
  // Someone asked "Still here?" and I haven't answered yet.
  stillHereAskedAt?: number;
  seedKey?: string;
  openToHuddles?: boolean;
  // Who sees my zone. Others' visible is already worked out for me by the server.
  shareWith?: ShareWith;
  // For AI matching, at this event: "What I want to learn today" / "What I can share".
  learnToday?: string;
  canShare?: string;
};

export type MatchDirection = "they_can_help_you" | "you_can_help_them" | "both";

// One AI match, as shown to the person it was found for. userId is the other person.
// basedOn lists the fields it rests on: "you.learnToday", "them.canShare", ...
export type MatchSuggestion = {
  userId: string;
  direction: MatchDirection;
  pairSummary: string;
  reasonForMe: string;
  reasonForThem: string;
  questionForMe: string;
  questionForThem: string;
  basedOn: string[];
};

export type AiMatches = {
  source: "claude" | "interests";
  items: MatchSuggestion[];
};

// A suggested 10-minute chat. The AI text is written from the sender's side
// ("you" in basedOn is fromId).
export type Match = {
  id: string;
  fromId: string;
  toId: string;
  status: "proposed" | "accepted" | "declined" | "expired" | "started" | "done" | "cancelled";
  pairSummary: string;
  reasonForFrom: string;
  reasonForTo: string;
  questionForFrom: string;
  questionForTo: string;
  basedOn: string[];
  source: "claude" | "interests" | "demo";
  createdAt: number;
  meetZoneId?: string;
  startedAt?: number;
  endsAt?: number;
};

export type ShareWith = "everyone" | "connections" | "nobody";

// A profile I'm connected with. userId is set when they're at the current event.
export type Connection = {
  profileId: string;
  name: string;
  userId?: string;
  // "huddle" only on older connections; new ones come from codes and links.
  source: "huddle" | "code" | "demo";
  createdAt: number;
};

export type ChatRequest = {
  id: string;
  panelId: string;
  attendeeId: string;
  note: string;
  status: RequestStatus;
  createdAt: number;
  acceptedAt?: number;
  leaveWarnedFor?: number;
  // Set while part of a formed huddle; lineAt is where the whole huddle stands in line.
  huddleId?: string;
  lineAt?: number;
  // Missed because the speaker left, and the message drafted for me to send them.
  closedBecause?: "speaker_left";
  followUp?: { text: string; source: "claude" | "template" };
};

export type HuddleMember = {
  userId: string;
  requestId: string;
  response: "pending" | "yes" | "no";
};

// Attendees in the same speaker's line who share interests and meet them together.
export type Huddle = {
  id: string;
  panelId: string;
  status: "proposed" | "formed";
  sharedInterests: string[];
  members: HuddleMember[];
};

export type ActivityType =
  | "view_panel"
  | "request_chat"
  | "accept_request"
  | "mark_met"
  | "missed"
  | "click_recommendation"
  | "huddle_proposed"
  | "huddle_formed"
  | "connection_made"
  | "match_suggested"
  | "match_accepted"
  | "match_completed";

export type Activity = {
  id: string;
  type: ActivityType;
  userId: string;
  targetId?: string;
  createdAt: number;
};

export type Toast = {
  id: string;
  message: string;
};
