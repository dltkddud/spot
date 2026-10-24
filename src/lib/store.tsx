"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { makeEvent, makeRequests, makeUsers, ZONES } from "./mockData";
import { LEAVE_WARNING_MIN } from "./time";
import type {
  Activity,
  ActivityType,
  ChatRequest,
  EventInfo,
  Role,
  Status,
  Toast,
  User,
  Zone,
} from "./types";

const MIN = 60_000;

export type Screen =
  | { name: "welcome" }
  | { name: "onboarding" }
  | { name: "zonePicker"; fromOnboarding?: boolean }
  | { name: "discover" }
  | { name: "zones" }
  | { name: "zoneDetail"; zoneId: string }
  | { name: "panelDetail"; panelId: string }
  | { name: "requests" }
  | { name: "panelNow" }
  | { name: "me" };

export type ProfileInput = {
  name: string;
  role: Role;
  headline: string;
  talkTitle?: string;
  interests: string[];
  outfit: string;
  contactUrl?: string;
  visible: boolean;
};

type State = {
  now: number;
  event: EventInfo;
  zones: Zone[];
  users: User[];
  requests: ChatRequest[];
  activity: Activity[];
  toasts: Toast[];
  warned: string[];
  currentUserId: string | null;
  myUserId: string | null;
  stack: Screen[];
};

type Action =
  | { type: "tick"; now: number }
  | { type: "navigate"; screen: Screen; replace?: boolean }
  | { type: "back" }
  | { type: "resetTo"; screen: Screen }
  | { type: "completeOnboarding"; profile: ProfileInput }
  | { type: "updateMe"; patch: Partial<User> }
  | { type: "setStatus"; status: Exclude<Status, "leaving"> }
  | { type: "setLeaving"; minutes: number }
  | { type: "requestChat"; panelId: string; note: string }
  | { type: "setRequestStatus"; requestId: string; status: ChatRequest["status"] }
  | { type: "log"; activityType: ActivityType; targetId?: string }
  | { type: "toast"; message: string }
  | { type: "dismissToast"; id: string }
  | { type: "viewAs"; userId: string }
  | { type: "simulateAccept" }
  | { type: "simulateLeaving" }
  | { type: "reset"; now: number };

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function initialState(now: number): State {
  return {
    now,
    event: makeEvent(now),
    zones: ZONES,
    users: makeUsers(now),
    requests: makeRequests(now),
    activity: [],
    toasts: [],
    warned: [],
    currentUserId: null,
    myUserId: null,
    stack: [{ name: "welcome" }],
  };
}

function homeFor(role: Role): Screen {
  return role === "panel" ? { name: "panelNow" } : { name: "discover" };
}

function patchUser(users: User[], id: string, patch: Partial<User>): User[] {
  return users.map((u) => (u.id === id ? { ...u, ...patch } : u));
}

function addToast(state: State, message: string): State {
  return { ...state, toasts: [...state.toasts, { id: newId("t"), message }].slice(-3) };
}

function runScheduled(state: State): State {
  let next = state;
  const now = state.now;

  for (const p of state.users) {
    if (p.role !== "panel" || p.status !== "leaving" || !p.leavingAt) continue;

    if (p.leavingAt <= now && p.visible) {
      const missedIds = next.requests
        .filter((r) => r.panelId === p.id && (r.status === "waiting" || r.status === "accepted"))
        .map((r) => r.id);
      next = {
        ...next,
        users: patchUser(next.users, p.id, { visible: false, zoneId: undefined, updatedAt: now }),
        requests: next.requests.map((r) => (missedIds.includes(r.id) ? { ...r, status: "missed" } : r)),
      };
      const mine = next.requests.find((r) => missedIds.includes(r.id) && r.attendeeId === next.currentUserId);
      if (mine) next = addToast(next, `${p.name} has left. Your request moved to missed.`);
      continue;
    }

    if (p.leavingAt - now <= LEAVE_WARNING_MIN * MIN) {
      const mine = next.requests.find(
        (r) =>
          r.panelId === p.id &&
          r.attendeeId === next.currentUserId &&
          (r.status === "waiting" || r.status === "accepted") &&
          !next.warned.includes(`${r.id}:${p.leavingAt}`),
      );
      if (mine) {
        const mins = Math.max(1, Math.ceil((p.leavingAt - now) / MIN));
        next = addToast(next, `${p.name} leaves in ${mins} min. Head over now if you can.`);
        next = { ...next, warned: [...next.warned, `${mine.id}:${p.leavingAt}`] };
      }
    }
  }
  return next;
}

function reducer(state: State, action: Action): State {
  const me = state.users.find((u) => u.id === state.currentUserId);

  switch (action.type) {
    case "tick":
      return runScheduled({ ...state, now: action.now });

    case "navigate": {
      const stack = action.replace ? [...state.stack.slice(0, -1), action.screen] : [...state.stack, action.screen];
      return { ...state, stack };
    }

    case "back":
      return state.stack.length > 1 ? { ...state, stack: state.stack.slice(0, -1) } : state;

    case "resetTo":
      return { ...state, stack: [action.screen] };

    case "completeOnboarding": {
      const id = state.myUserId ?? "me";
      const user: User = {
        id,
        ...action.profile,
        status: "available",
        requestsPaused: false,
        updatedAt: state.now,
      };
      const users = state.users.some((u) => u.id === id)
        ? patchUser(state.users, id, user)
        : [...state.users, user];
      return {
        ...state,
        users,
        currentUserId: id,
        myUserId: id,
        stack: [{ name: "zonePicker", fromOnboarding: true }],
      };
    }

    case "updateMe":
      if (!me) return state;
      return { ...state, users: patchUser(state.users, me.id, { ...action.patch, updatedAt: state.now }) };

    case "setStatus":
      if (!me) return state;
      return {
        ...state,
        users: patchUser(state.users, me.id, { status: action.status, leavingAt: undefined, updatedAt: state.now }),
      };

    case "setLeaving":
      if (!me) return state;
      return runScheduled({
        ...state,
        users: patchUser(state.users, me.id, {
          status: "leaving",
          leavingAt: state.now + action.minutes * MIN,
          updatedAt: state.now,
        }),
      });

    case "requestChat": {
      if (!me) return state;
      const req: ChatRequest = {
        id: newId("r"),
        panelId: action.panelId,
        attendeeId: me.id,
        note: action.note.trim(),
        status: "waiting",
        createdAt: state.now,
      };
      return runScheduled({
        ...state,
        requests: [...state.requests, req],
        activity: [
          ...state.activity,
          { id: newId("act"), type: "request_chat", userId: me.id, targetId: action.panelId, createdAt: state.now },
        ],
      });
    }

    case "setRequestStatus": {
      const req = state.requests.find((r) => r.id === action.requestId);
      if (!req) return state;
      const activityType: ActivityType | null =
        action.status === "accepted" ? "accept_request" : action.status === "met" ? "mark_met" : null;
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.id === action.requestId
            ? { ...r, status: action.status, acceptedAt: action.status === "accepted" ? state.now : r.acceptedAt }
            : r,
        ),
        activity: activityType && me
          ? [...state.activity, { id: newId("act"), type: activityType, userId: me.id, targetId: req.panelId, createdAt: state.now }]
          : state.activity,
      };
    }

    case "log":
      if (!me) return state;
      return {
        ...state,
        activity: [
          ...state.activity,
          { id: newId("act"), type: action.activityType, userId: me.id, targetId: action.targetId, createdAt: state.now },
        ],
      };

    case "toast":
      return addToast(state, action.message);

    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case "viewAs": {
      const target = state.users.find((u) => u.id === action.userId);
      if (!target) return state;
      return { ...state, currentUserId: target.id, stack: [homeFor(target.role)] };
    }

    case "simulateAccept": {
      const req = state.requests
        .filter((r) => r.attendeeId === state.currentUserId && r.status === "waiting")
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!req) return addToast(state, "Send a chat request first, then try this again.");
      const panel = state.users.find((u) => u.id === req.panelId);
      const zone = state.zones.find((z) => z.id === panel?.zoneId);
      const next = reducer(state, { type: "setRequestStatus", requestId: req.id, status: "accepted" });
      return addToast(next, `${panel?.name} is ready for you at ${zone?.name ?? "their zone"}.`);
    }

    case "simulateLeaving": {
      const req = state.requests.find(
        (r) => r.attendeeId === state.currentUserId && (r.status === "waiting" || r.status === "accepted"),
      );
      if (!req) return addToast(state, "Send a chat request first, then try this again.");
      return runScheduled({
        ...state,
        users: patchUser(state.users, req.panelId, {
          status: "leaving",
          leavingAt: state.now + LEAVE_WARNING_MIN * MIN,
          updatedAt: state.now,
        }),
      });
    }

    case "reset":
      return initialState(action.now);
  }
}

type AppContextValue = {
  state: State;
  me: User | undefined;
  screen: Screen;
  dispatch: Dispatch<Action>;
  navigate: (screen: Screen, replace?: boolean) => void;
  back: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, 0, () => initialState(Date.now()));

  useEffect(() => {
    dispatch({ type: "tick", now: Date.now() });
    const t = setInterval(() => dispatch({ type: "tick", now: Date.now() }), 10_000);
    return () => clearInterval(t);
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const me = state.users.find((u) => u.id === state.currentUserId);
    return {
      state,
      me,
      screen: state.stack[state.stack.length - 1],
      dispatch,
      navigate: (screen, replace) => dispatch({ type: "navigate", screen, replace }),
      back: () => dispatch({ type: "back" }),
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function queueFor(requests: ChatRequest[], panelId: string) {
  return requests
    .filter((r) => r.panelId === panelId && (r.status === "waiting" || r.status === "accepted"))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "accepted" ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
}

export function positionInQueue(requests: ChatRequest[], request: ChatRequest): number {
  const waiting = requests
    .filter((r) => r.panelId === request.panelId && r.status === "waiting")
    .sort((a, b) => a.createdAt - b.createdAt);
  return waiting.findIndex((r) => r.id === request.id) + 1;
}

export { homeFor };
