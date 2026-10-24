"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { makeRequests } from "./mockData";
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
const MY_ID_KEY = "spot.myUserId";

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

// Kept in the browser. Event, zones and users come from Convex.
type LocalState = {
  now: number;
  requests: ChatRequest[];
  activity: Activity[];
  toasts: Toast[];
  warned: string[];
  currentUserId: string | null;
  myUserId: string | null;
  stack: Screen[];
  booted: boolean;
};

type State = LocalState & {
  event: EventInfo;
  zones: Zone[];
  users: User[];
};

type Action =
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

type LocalAction =
  | Extract<
      Action,
      { type: "navigate" | "back" | "resetTo" | "requestChat" | "setRequestStatus" | "log" | "toast" | "dismissToast" }
    >
  | { type: "tick"; now: number; users: User[] }
  | { type: "boot"; myUserId: string | null; role?: Role; requests: ChatRequest[] }
  | { type: "signedIn"; userId: string }
  | { type: "viewAs"; userId: string; role: Role }
  | { type: "reset"; now: number; requests: ChatRequest[]; role?: Role };

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function loadMyId(): string | null {
  try {
    return localStorage.getItem(MY_ID_KEY);
  } catch {
    return null;
  }
}

function saveMyId(id: string | null) {
  try {
    if (id) localStorage.setItem(MY_ID_KEY, id);
    else localStorage.removeItem(MY_ID_KEY);
  } catch {
    // Storage blocked (private mode etc.). The account just won't survive a reload.
  }
}

function initialState(now: number, myUserId: string | null): LocalState {
  return {
    now,
    requests: [],
    activity: [],
    toasts: [],
    warned: [],
    currentUserId: null,
    myUserId,
    stack: [{ name: "welcome" }],
    booted: false,
  };
}

// Stage 1: chat requests are still fake. The mockData requests point at the
// demo people by their seed key, so swap in their Convex ids.
function demoRequests(users: User[], now: number): ChatRequest[] {
  const idFor = new Map(users.filter((u) => u.seedKey).map((u) => [u.seedKey!, u.id]));
  return makeRequests(now)
    .filter((r) => idFor.has(r.panelId) && idFor.has(r.attendeeId))
    .map((r) => ({ ...r, panelId: idFor.get(r.panelId)!, attendeeId: idFor.get(r.attendeeId)! }));
}

function homeFor(role: Role): Screen {
  return role === "panel" ? { name: "panelNow" } : { name: "discover" };
}

function addToast(state: LocalState, message: string): LocalState {
  return { ...state, toasts: [...state.toasts, { id: newId("t"), message }].slice(-3) };
}

function runScheduled(state: LocalState, users: User[]): LocalState {
  let next = state;
  const now = state.now;

  for (const p of users) {
    if (p.role !== "panel" || p.status !== "leaving" || !p.leavingAt) continue;

    if (p.leavingAt <= now && p.visible) {
      const missedIds = next.requests
        .filter((r) => r.panelId === p.id && (r.status === "waiting" || r.status === "accepted"))
        .map((r) => r.id);
      next = {
        ...next,
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

function reducer(state: LocalState, action: LocalAction): LocalState {
  const meId = state.currentUserId;

  switch (action.type) {
    case "tick":
      return runScheduled({ ...state, now: action.now }, action.users);

    case "navigate": {
      const stack = action.replace ? [...state.stack.slice(0, -1), action.screen] : [...state.stack, action.screen];
      return { ...state, stack };
    }

    case "back":
      return state.stack.length > 1 ? { ...state, stack: state.stack.slice(0, -1) } : state;

    case "resetTo":
      return { ...state, stack: [action.screen] };

    case "boot":
      return {
        ...state,
        booted: true,
        myUserId: action.myUserId,
        currentUserId: action.myUserId,
        requests: action.requests,
        stack: action.role ? [homeFor(action.role)] : state.stack,
      };

    case "signedIn":
      return {
        ...state,
        currentUserId: action.userId,
        myUserId: action.userId,
        stack: [{ name: "zonePicker", fromOnboarding: true }],
      };

    case "requestChat": {
      if (!meId) return state;
      const req: ChatRequest = {
        id: newId("r"),
        panelId: action.panelId,
        attendeeId: meId,
        note: action.note.trim(),
        status: "waiting",
        createdAt: state.now,
      };
      return {
        ...state,
        requests: [...state.requests, req],
        activity: [
          ...state.activity,
          { id: newId("act"), type: "request_chat", userId: meId, targetId: action.panelId, createdAt: state.now },
        ],
      };
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
        activity: activityType && meId
          ? [...state.activity, { id: newId("act"), type: activityType, userId: meId, targetId: req.panelId, createdAt: state.now }]
          : state.activity,
      };
    }

    case "log":
      if (!meId) return state;
      return {
        ...state,
        activity: [
          ...state.activity,
          { id: newId("act"), type: action.activityType, userId: meId, targetId: action.targetId, createdAt: state.now },
        ],
      };

    case "toast":
      return addToast(state, action.message);

    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case "viewAs":
      return { ...state, currentUserId: action.userId, stack: [homeFor(action.role)] };

    case "reset":
      return {
        ...initialState(action.now, state.myUserId),
        booted: true,
        currentUserId: state.myUserId,
        requests: action.requests,
        stack: action.role ? [homeFor(action.role)] : [{ name: "welcome" }],
      };
  }
}

function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === "string") return e.data;
  return "Couldn't reach the server. Try again.";
}

// Keeps showing the last result while a query reloads with new arguments.
function useLatest<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value);
  if (value !== undefined && value !== last) setLast(value);
  return value ?? last;
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
  const [local, localDispatch] = useReducer(reducer, 0, () => initialState(Date.now(), loadMyId()));

  const ensureSeed = useMutation(api.seed.ensure);
  const resetDemo = useMutation(api.seed.resetDemo);
  const createUser = useMutation(api.users.create);
  const updateUser = useMutation(api.users.update);
  const setUserStatus = useMutation(api.users.setStatus);

  useEffect(() => {
    ensureSeed().catch((e) => console.error("Seeding failed", e));
  }, [ensureSeed]);

  const current = useLatest(useQuery(api.events.current));
  const rawUsers = useLatest(
    useQuery(
      api.users.listByEvent,
      current ? { eventId: current.event._id, viewerId: local.myUserId ?? undefined } : "skip",
    ),
  );

  const event = useMemo<EventInfo | undefined>(
    () =>
      current
        ? {
            id: current.event._id,
            name: current.event.name,
            venue: current.event.venue,
            endsAt: current.event.endsAt,
          }
        : undefined,
    [current],
  );
  const zones = useMemo<Zone[]>(
    () => (current?.zones ?? []).map((z) => ({ id: z._id, code: z.code, name: z.name, landmark: z.landmark })),
    [current],
  );
  const users = useMemo<User[] | undefined>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    () => rawUsers?.map(({ _id, _creationTime, eventId, ...u }) => ({ id: _id, ...u })),
    [rawUsers],
  );

  // Restore my account from localStorage once users have loaded.
  useEffect(() => {
    if (!users || local.booted) return;
    const mine = local.myUserId ? users.find((u) => u.id === local.myUserId) : undefined;
    if (local.myUserId && !mine) saveMyId(null);
    localDispatch({ type: "boot", myUserId: mine?.id ?? null, role: mine?.role, requests: demoRequests(users, Date.now()) });
  }, [users, local.booted, local.myUserId]);

  const latest = useRef({ local, users: users ?? [], zones, event });
  useEffect(() => {
    latest.current = { local, users: users ?? [], zones, event };
  });

  useEffect(() => {
    if (users) localDispatch({ type: "tick", now: Date.now(), users });
  }, [users, local.requests]);

  useEffect(() => {
    const t = setInterval(() => localDispatch({ type: "tick", now: Date.now(), users: latest.current.users }), 10_000);
    return () => clearInterval(t);
  }, []);

  const creating = useRef(false);

  const dispatch = useCallback<Dispatch<Action>>(
    (action) => {
      const { local, users, zones, event } = latest.current;
      const meId = local.currentUserId as Id<"users"> | null;
      const run = (p: Promise<unknown>) =>
        p.catch((e) => localDispatch({ type: "toast", message: errorMessage(e) }));

      switch (action.type) {
        case "completeOnboarding": {
          if (!event || creating.current) return;
          creating.current = true;
          run(
            createUser({ eventId: event.id as Id<"events">, ...action.profile }).then((id) => {
              saveMyId(id);
              localDispatch({ type: "signedIn", userId: id });
            }),
          ).finally(() => {
            creating.current = false;
          });
          return;
        }

        case "updateMe": {
          if (!meId) return;
          const { zoneId, outfit, visible, requestsPaused } = action.patch;
          run(updateUser({ id: meId, zoneId: zoneId as Id<"zones"> | undefined, outfit, visible, requestsPaused }));
          return;
        }

        case "setStatus":
          if (meId) run(setUserStatus({ id: meId, status: action.status }));
          return;

        case "setLeaving":
          if (meId) run(setUserStatus({ id: meId, status: "leaving", leavingInMin: action.minutes }));
          return;

        case "viewAs": {
          const target = users.find((u) => u.id === action.userId);
          if (target) localDispatch({ type: "viewAs", userId: target.id, role: target.role });
          return;
        }

        case "simulateAccept": {
          const req = local.requests
            .filter((r) => r.attendeeId === local.currentUserId && r.status === "waiting")
            .sort((a, b) => a.createdAt - b.createdAt)[0];
          if (!req) {
            localDispatch({ type: "toast", message: "Send a chat request first, then try this again." });
            return;
          }
          const panel = users.find((u) => u.id === req.panelId);
          const zone = zones.find((z) => z.id === panel?.zoneId);
          localDispatch({ type: "setRequestStatus", requestId: req.id, status: "accepted" });
          localDispatch({ type: "toast", message: `${panel?.name} is ready for you at ${zone?.name ?? "their zone"}.` });
          return;
        }

        case "simulateLeaving": {
          const req = local.requests.find(
            (r) => r.attendeeId === local.currentUserId && (r.status === "waiting" || r.status === "accepted"),
          );
          if (!req) {
            localDispatch({ type: "toast", message: "Send a chat request first, then try this again." });
            return;
          }
          run(
            setUserStatus({ id: req.panelId as Id<"users">, status: "leaving", leavingInMin: LEAVE_WARNING_MIN }),
          );
          return;
        }

        case "reset": {
          if (!event) return;
          const role = users.find((u) => u.id === local.myUserId)?.role;
          run(
            resetDemo({ eventId: event.id as Id<"events"> }).then(() =>
              localDispatch({ type: "reset", now: action.now, requests: demoRequests(users, action.now), role }),
            ),
          );
          return;
        }

        default:
          localDispatch(action);
      }
    },
    [createUser, updateUser, setUserStatus, resetDemo],
  );

  const value = useMemo<AppContextValue | null>(() => {
    if (!event || !users) return null;
    const state: State = { ...local, event, zones, users };
    const me = users.find((u) => u.id === local.currentUserId);
    return {
      state,
      me,
      screen: local.stack[local.stack.length - 1],
      dispatch,
      navigate: (screen, replace) => dispatch({ type: "navigate", screen, replace }),
      back: () => dispatch({ type: "back" }),
    };
  }, [local, event, zones, users, dispatch]);

  if (!event || !users || !local.booted) return <div className="min-h-dvh bg-bg" />;

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
