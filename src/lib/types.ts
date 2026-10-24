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
};

export type ActivityType =
  | "view_panel"
  | "request_chat"
  | "accept_request"
  | "mark_met"
  | "missed"
  | "click_recommendation";

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
