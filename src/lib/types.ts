export type Role = "panel" | "attendee";

export type Status = "available" | "talking" | "leaving";

export type RequestStatus = "waiting" | "accepted" | "met" | "declined" | "missed" | "cancelled";

export type EventInfo = {
  id: string;
  name: string;
  venue: string;
  endsAt: number;
};

export type Zone = {
  id: string;
  code: string;
  name: string;
  landmark: string;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  headline: string;
  talkTitle?: string;
  interests: string[];
  outfit: string;
  contactUrl?: string;
  zoneId?: string;
  status: Status;
  leavingAt?: number;
  visible: boolean;
  requestsPaused: boolean;
  updatedAt: number;
  seedKey?: string;
  locationCheckAt?: number;
  openToHuddles?: boolean;
};

// How busy a zone is. Counts hidden people too, so only a level is shared.
export type CrowdLevel = "quiet" | "some" | "busy";

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
  status: "proposed" | "formed" | "met";
  sharedInterests: string[];
  members: HuddleMember[];
  // Other members I still need to answer "Stay connected?" for.
  stayPending: string[];
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
  | "connection_made";

export type Activity = {
  id: string;
  type: ActivityType;
  userId: string;
  targetId?: string;
  createdAt: number;
};

export type Recommendation = {
  panelId: string;
  reason: string;
  sharedInterests: string[];
};

export type Toast = {
  id: string;
  message: string;
};
