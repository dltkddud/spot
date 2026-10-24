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
import { LEAVE_WARNING_MIN, minutesUntil } from "./time";
import type {
  Activity,
  ActivityType,
  ChatRequest,
  CrowdLevel,
  RequestStatus,
  EventInfo,
  Role,
  Status,
  Toast,
  User,
  Zone,
} from "./types";

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

// Kept in the browser. Event, zones, users and chat requests come from Convex.
type LocalState = {
  now: number;
  activity: Activity[];
  toasts: Toast[];
  currentUserId: string | null;
  myUserId: string | null;
  stack: Screen[];
  booted: boolean;
};

type State = LocalState & {
  event: EventInfo;
  zones: Zone[];
  users: User[];
  requests: ChatRequest[];
  zoneActivity: Record<string, CrowdLevel>;
};

type Action =
  | { type: "navigate"; screen: Screen; replace?: boolean }
  | { type: "back" }
  | { type: "resetTo"; screen: Screen }
  | { type: "completeOnboarding"; profile: ProfileInput }
  | { type: "updateMe"; patch: Partial<User> }
  | { type: "setStatus"; status: Exclude<Status, "leaving"> }
  | { type: "setLeaving"; minutes: number }
  | { type: "askStillHere"; userId: string }
  | { type: "confirmZone" }
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
      { type: "navigate" | "back" | "resetTo" | "log" | "toast" | "dismissToast" }
    >
  | { type: "tick"; now: number }
  | { type: "boot"; myUserId: string | null; role?: Role }
  | { type: "signedIn"; userId: string }
  | { type: "viewAs"; userId: string; role: Role }
  | { type: "reset"; now: number; role?: Role };

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
    activity: [],
    toasts: [],
    currentUserId: null,
    myUserId,
    stack: [{ name: "welcome" }],
    booted: false,
  };
}

function homeFor(role: Role): Screen {
  return role === "panel" ? { name: "panelNow" } : { name: "discover" };
}

function addToast(state: LocalState, message: string): LocalState {
  return { ...state, toasts: [...state.toasts, { id: newId("t"), message }].slice(-3) };
}

function reducer(state: LocalState, action: LocalAction): LocalState {
  const meId = state.currentUserId;

  switch (action.type) {
    case "tick":
      return { ...state, now: action.now };

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
        stack: action.role ? [homeFor(action.role)] : state.stack,
      };

    case "signedIn":
      return {
        ...state,
        currentUserId: action.userId,
        myUserId: action.userId,
        stack: [{ name: "zonePicker", fromOnboarding: true }],
      };

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
  const askStillHere = useMutation(api.users.askStillHere);
  const confirmZone = useMutation(api.users.confirmZone);
  const createRequest = useMutation(api.chatRequests.create);
  const setRequestStatus = useMutation(api.chatRequests.setStatus);

  useEffect(() => {
    ensureSeed().catch((e) => console.error("Seeding failed", e));
  }, [ensureSeed]);

  const current = useLatest(useQuery(api.events.current));
  const eventId = current?.event._id;
  const rawUsers = useLatest(
    useQuery(api.users.listByEvent, eventId ? { eventId, viewerId: local.myUserId ?? undefined } : "skip"),
  );

  const viewerId = local.booted ? (local.currentUserId as Id<"users"> | null) : null;
  const crowd = useLatest(useQuery(api.events.zoneActivity, eventId ? { eventId } : "skip"));
  const zoneActivity = useMemo<Record<string, CrowdLevel>>(
    () => Object.fromEntries((crowd ?? []).map((z) => [z.zoneId, z.level])),
    [crowd],
  );
  const openLines = useLatest(useQuery(api.chatRequests.activeByEvent, eventId ? { eventId } : "skip"));
  const myLine = useLatest(useQuery(api.chatRequests.forPanel, viewerId ? { panelId: viewerId } : "skip"));
  const mySent = useLatest(useQuery(api.chatRequests.forAttendee, viewerId ? { attendeeId: viewerId } : "skip"));

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

  // Open lines from everyone (no names or notes), overlaid with the full rows
  // I'm allowed to see: my own line as a speaker and my own requests.
  const requests = useMemo<ChatRequest[]>(() => {
    const byId = new Map<string, ChatRequest>();
    for (const r of openLines ?? []) {
      byId.set(r._id, { id: r._id, panelId: r.panelId, attendeeId: "", note: "", status: r.status, createdAt: r.createdAt });
    }
    for (const r of [...(myLine ?? []), ...(mySent ?? [])]) {
      byId.set(r._id, {
        id: r._id,
        panelId: r.panelId,
        attendeeId: r.attendeeId,
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        acceptedAt: r.acceptedAt,
        leaveWarnedFor: r.leaveWarnedFor,
      });
    }
    return [...byId.values()];
  }, [openLines, myLine, mySent]);

  // Restore my account from localStorage once users have loaded.
  useEffect(() => {
    if (!users || local.booted) return;
    const mine = local.myUserId ? users.find((u) => u.id === local.myUserId) : undefined;
    if (local.myUserId && !mine) saveMyId(null);
    localDispatch({ type: "boot", myUserId: mine?.id ?? null, role: mine?.role });
  }, [users, local.booted, local.myUserId]);

  const latest = useRef({ local, users: users ?? [], zones, event, requests });
  useEffect(() => {
    latest.current = { local, users: users ?? [], zones, event, requests };
  });

  // Keeps "3 min ago" and countdowns fresh. Leaving itself runs on the server.
  useEffect(() => {
    const t = setInterval(() => localDispatch({ type: "tick", now: Date.now() }), 10_000);
    return () => clearInterval(t);
  }, []);

  // Banners for my own requests: accepted, missed because the speaker left,
  // and the 10-minute heads-up the server marks on each open request.
  const seen = useRef<{ viewerId: string; status: Map<string, RequestStatus>; warned: Set<string> } | null>(null);
  useEffect(() => {
    if (!viewerId || !users || !mySent) return;
    if (mySent.some((r) => r.attendeeId !== viewerId)) return; // still showing the previous viewer's rows
    if (seen.current?.viewerId !== viewerId) seen.current = { viewerId, status: new Map(), warned: new Set() };
    const { status, warned } = seen.current;
    const now = Date.now();

    for (const r of mySent) {
      const panel = users.find((u) => u.id === r.panelId);
      const before = status.get(r._id);
      status.set(r._id, r.status);
      if (!panel) continue;

      if (before && before !== r.status) {
        if (r.status === "accepted") {
          const zone = zones.find((z) => z.id === panel.zoneId);
          localDispatch({ type: "toast", message: `${panel.name} is ready for you at ${zone?.name ?? "their zone"}.` });
        } else if (r.status === "missed" && !panel.visible) {
          localDispatch({ type: "toast", message: `${panel.name} has left. Your request moved to missed.` });
        }
      }

      const key = `${r._id}:${r.leaveWarnedFor}`;
      if (
        (r.status === "waiting" || r.status === "accepted") &&
        r.leaveWarnedFor !== undefined &&
        panel.status === "leaving" &&
        panel.leavingAt === r.leaveWarnedFor &&
        panel.leavingAt > now &&
        !warned.has(key)
      ) {
        warned.add(key);
        const mins = Math.max(1, minutesUntil(panel.leavingAt, now));
        localDispatch({ type: "toast", message: `${panel.name} leaves in ${mins} min. Head over now if you can.` });
      }
    }
  }, [viewerId, users, zones, mySent]);

  const creating = useRef(false);

  const dispatch = useCallback<Dispatch<Action>>(
    (action) => {
      const { local, users, event, requests } = latest.current;
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

        case "askStillHere": {
          const target = users.find((u) => u.id === action.userId);
          if (!target) return;
          run(
            askStillHere({ targetId: target.id as Id<"users"> }).then(() =>
              localDispatch({ type: "toast", message: `We asked ${target.name.split(" ")[0]} to confirm their zone.` }),
            ),
          );
          return;
        }

        case "confirmZone":
          if (meId) run(confirmZone({ id: meId }));
          return;

        case "requestChat":
          if (!meId) return;
          run(
            createRequest({ attendeeId: meId, panelId: action.panelId as Id<"users">, note: action.note }).then(() =>
              localDispatch({ type: "log", activityType: "request_chat", targetId: action.panelId }),
            ),
          );
          return;

        case "setRequestStatus": {
          const req = requests.find((r) => r.id === action.requestId);
          if (!meId || !req || action.status === "waiting") return;
          const activityType: ActivityType | null =
            action.status === "accepted" ? "accept_request" : action.status === "met" ? "mark_met" : null;
          run(
            setRequestStatus({
              requestId: req.id as Id<"chatRequests">,
              actorId: meId,
              status: action.status,
            }).then(() => {
              if (activityType) localDispatch({ type: "log", activityType, targetId: req.panelId });
            }),
          );
          return;
        }

        case "viewAs": {
          const target = users.find((u) => u.id === action.userId);
          if (target) localDispatch({ type: "viewAs", userId: target.id, role: target.role });
          return;
        }

        case "simulateAccept": {
          const req = requests
            .filter((r) => r.attendeeId === local.currentUserId && r.status === "waiting")
            .sort((a, b) => a.createdAt - b.createdAt)[0];
          if (!req) {
            localDispatch({ type: "toast", message: "Send a chat request first, then try this again." });
            return;
          }
          run(
            setRequestStatus({
              requestId: req.id as Id<"chatRequests">,
              actorId: req.panelId as Id<"users">,
              status: "accepted",
            }),
          );
          return;
        }

        case "simulateLeaving": {
          const req = requests.find(
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
              localDispatch({ type: "reset", now: action.now, role }),
            ),
          );
          return;
        }

        default:
          localDispatch(action);
      }
    },
    [createUser, updateUser, setUserStatus, askStillHere, confirmZone, createRequest, setRequestStatus, resetDemo],
  );

  const value = useMemo<AppContextValue | null>(() => {
    if (!event || !users) return null;
    const state: State = { ...local, event, zones, users, requests, zoneActivity };
    const me = users.find((u) => u.id === local.currentUserId);
    return {
      state,
      me,
      screen: local.stack[local.stack.length - 1],
      dispatch,
      navigate: (screen, replace) => dispatch({ type: "navigate", screen, replace }),
      back: () => dispatch({ type: "back" }),
    };
  }, [local, event, zones, users, requests, zoneActivity, dispatch]);

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
