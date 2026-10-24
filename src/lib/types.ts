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
  openToHuddles?: boolean;
  // Who sees my zone. Others' visible is already worked out for me by the server.
  shareWith?: ShareWith;
  // Only present on my own profile.
  connectCode?: string;
};

export type ShareWith = "everyone" | "connections" | "nobody";

export type Connection = {
  userId: string;
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
