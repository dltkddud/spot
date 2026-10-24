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
  Connection,
  Huddle,
  RequestStatus,
  EventInfo,
  Role,
  Status,
  Toast,
  User,
  Zone,
} from "./types";

const MY_ID_KEY = "spot.myUserId";
const PENDING_CONNECT_KEY = "spot.pendingConnect";

export type Screen =
  | { name: "welcome" }
  | { name: "onboarding" }
  | { name: "zonePicker"; fromOnboarding?: boolean }
  | { name: "explore"; view?: ExploreView }
  | { name: "zoneDetail"; zoneId: string }
  | { name: "panelDetail"; panelId: string }
  | { name: "requests" }
  | { name: "panelNow" }
  | { name: "me" };

export type ExploreView = "people" | "map";

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
  // My huddles as an attendee, and the formed huddles in my line as a speaker.
  huddles: Huddle[];
  // Event-wide counts kept on the server (huddles formed, connections made).
  stats: Record<string, number>;
  // People I'm connected with (they see my zone when I share with connections).
  connections: Connection[];
};

type Action =
  | { type: "navigate"; screen: Screen; replace?: boolean }
  | { type: "back" }
  | { type: "resetTo"; screen: Screen }
  | { type: "completeOnboarding"; profile: ProfileInput }
  | { type: "updateMe"; patch: Partial<User> }
  | { type: "setStatus"; status: Exclude<Status, "leaving"> }
  | { type: "setLeaving"; minutes: number }
  | { type: "huddleRespond"; huddleId: string; accept: boolean }
  | { type: "setHuddleStatus"; huddleId: string; status: "accepted" | "declined" | "met" | "missed" }
  | { type: "simulateHuddle" }
  | { type: "connectCode"; code: string }
  | { type: "removeConnection"; userId: string }
  | { type: "simulateFriends" }
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

// An invite link (?connect=CODE) is remembered until there's an account to connect.
function takeInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("connect");
    if (!code) return;
    localStorage.setItem(PENDING_CONNECT_KEY, code);
    url.searchParams.delete("connect");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // Storage blocked: the code can still be typed in Me.
  }
}

function takePendingInvite(): string | null {
  try {
    const code = localStorage.getItem(PENDING_CONNECT_KEY);
    localStorage.removeItem(PENDING_CONNECT_KEY);
    return code;
  } catch {
    return null;
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
  return role === "panel" ? { name: "panelNow" } : { name: "explore" };
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
  const huddleRespond = useMutation(api.huddles.respond);
  const setHuddleStatus = useMutation(api.huddles.setGroupStatus);
  const demoHuddle = useMutation(api.huddles.demoPropose);
  const ensureCode = useMutation(api.connections.ensureCode);
  const connectByCode = useMutation(api.connections.connectByCode);
  const removeConnection = useMutation(api.connections.remove);
  const demoFriends = useMutation(api.connections.demoFriends);
  const createRequest = useMutation(api.chatRequests.create);
  const setRequestStatus = useMutation(api.chatRequests.setStatus);

  useEffect(() => {
    ensureSeed().catch((e) => console.error("Seeding failed", e));
    takeInviteFromUrl();
  }, [ensureSeed]);

  const current = useLatest(useQuery(api.events.current));
  const eventId = current?.event._id;
  const rawUsers = useLatest(
    useQuery(
      api.users.listByEvent,
      eventId ? { eventId, viewerId: (local.booted ? local.currentUserId : local.myUserId) ?? undefined } : "skip",
    ),
  );

  const viewerId = local.booted ? (local.currentUserId as Id<"users"> | null) : null;
  const openLines = useLatest(useQuery(api.chatRequests.activeByEvent, eventId ? { eventId } : "skip"));
  const myLine = useLatest(useQuery(api.chatRequests.forPanel, viewerId ? { panelId: viewerId } : "skip"));
  const mySent = useLatest(useQuery(api.chatRequests.forAttendee, viewerId ? { attendeeId: viewerId } : "skip"));
  const myHuddles = useLatest(useQuery(api.huddles.forAttendee, viewerId ? { attendeeId: viewerId } : "skip"));
  const lineHuddles = useLatest(useQuery(api.huddles.forPanel, viewerId ? { panelId: viewerId } : "skip"));
  const summary = useLatest(useQuery(api.activity.summary, eventId ? { eventId } : "skip"));
  const myLinks = useLatest(useQuery(api.connections.mine, viewerId ? { userId: viewerId } : "skip"));
  const connections = useMemo<Connection[]>(
    () => (myLinks ?? []).map(({ otherId, source, createdAt }) => ({ userId: otherId, source, createdAt })),
    [myLinks],
  );
  const stats = useMemo(() => summary ?? {}, [summary]);

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
      byId.set(r._id, {
        id: r._id,
        panelId: r.panelId,
        attendeeId: "",
        note: "",
        status: r.status,
        createdAt: r.createdAt,
        huddleId: r.huddleId,
        lineAt: r.lineAt,
      });
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
        huddleId: r.huddleId,
        lineAt: r.lineAt,
      });
    }
    return [...byId.values()];
  }, [openLines, myLine, mySent]);

  const huddles = useMemo<Huddle[]>(() => {
    const byId = new Map<string, Huddle>();
    for (const h of [...(lineHuddles ?? []), ...(myHuddles ?? [])]) byId.set(h._id, { ...h, id: h._id });
    return [...byId.values()];
  }, [lineHuddles, myHuddles]);

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

  // Banners for huddles: a new suggestion for me, and a huddle becoming ready.
  const seenHuddles = useRef<{ viewerId: string; status: Map<string, string>; loaded: boolean } | null>(null);
  useEffect(() => {
    if (!viewerId || !users || !myHuddles) return;
    if (myHuddles.some((h) => !h.members.some((m) => m.userId === viewerId))) return;
    if (seenHuddles.current?.viewerId !== viewerId) {
      seenHuddles.current = { viewerId, status: new Map(), loaded: false };
    }
    const seen = seenHuddles.current;
    for (const h of myHuddles) {
      const before = seen.status.get(h._id);
      seen.status.set(h._id, h.status);
      if (!seen.loaded) continue;
      const panel = users.find((u) => u.id === h.panelId)?.name.split(" ")[0] ?? "the speaker";
      const others = h.members
        .filter((m) => m.userId !== viewerId)
        .map((m) => users.find((u) => u.id === m.userId)?.name.split(" ")[0] ?? "Someone");
      const mine = h.members.find((m) => m.userId === viewerId);
      if (!before && h.status === "proposed" && mine?.response === "pending") {
        localDispatch({
          type: "toast",
          message: `${others.join(" and ")} ${others.length > 1 ? "are" : "is"} into ${h.sharedInterests[0]} too. Meet ${panel} together?`,
        });
      } else if (before === "proposed" && h.status === "formed") {
        localDispatch({ type: "toast", message: `Huddle ready. You'll meet ${panel} together.` });
      }
    }
    seen.loaded = true;
  }, [viewerId, users, myHuddles]);

  // Banner when someone connects with me. Connections I made get their banner from the action.
  const seenLinks = useRef<{ viewerId: string; ids: Set<string>; loaded: boolean } | null>(null);
  useEffect(() => {
    if (!viewerId || !users || !myLinks) return;
    if (seenLinks.current?.viewerId !== viewerId) seenLinks.current = { viewerId, ids: new Set(), loaded: false };
    const seen = seenLinks.current;
    for (const link of myLinks) {
      if (seen.ids.has(link.otherId)) continue;
      seen.ids.add(link.otherId);
      if (!seen.loaded || (link.source !== "huddle" && link.by === viewerId)) continue;
      const name = users.find((u) => u.id === link.otherId)?.name.split(" ")[0] ?? "Someone";
      localDispatch({
        type: "toast",
        message: link.source === "huddle" ? `You and ${name} are now connected.` : `${name} connected with you.`,
      });
    }
    seen.loaded = true;
  }, [viewerId, users, myLinks]);

  // Accounts made before connect codes existed get one when they open the app.
  const me = users?.find((u) => u.id === local.currentUserId);
  const needsCode = !!me && !me.connectCode;
  useEffect(() => {
    if (needsCode && viewerId) ensureCode({ userId: viewerId }).catch(() => {});
  }, [needsCode, viewerId, ensureCode]);

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
          const { zoneId, outfit, visible, shareWith, requestsPaused, openToHuddles } = action.patch;
          run(
            updateUser({
              id: meId,
              zoneId: zoneId as Id<"zones"> | undefined,
              outfit,
              visible,
              shareWith,
              requestsPaused,
              openToHuddles,
            }),
          );
          return;
        }

        case "setStatus":
          if (meId) run(setUserStatus({ id: meId, status: action.status }));
          return;

        case "setLeaving":
          if (meId) run(setUserStatus({ id: meId, status: "leaving", leavingInMin: action.minutes }));
          return;

        case "huddleRespond":
          if (meId) run(huddleRespond({ huddleId: action.huddleId as Id<"huddles">, userId: meId, accept: action.accept }));
          return;

        case "setHuddleStatus": {
          if (!meId) return;
          const activityType: ActivityType | null =
            action.status === "accepted" ? "accept_request" : action.status === "met" ? "mark_met" : null;
          run(
            setHuddleStatus({ huddleId: action.huddleId as Id<"huddles">, actorId: meId, status: action.status }).then(
              () => {
                if (activityType) localDispatch({ type: "log", activityType, targetId: meId });
              },
            ),
          );
          return;
        }

        case "simulateHuddle":
          if (meId) run(demoHuddle({ attendeeId: meId }));
          return;

        case "connectCode":
          if (!meId) return;
          run(
            connectByCode({ userId: meId, code: action.code }).then(({ name, isNew }) => {
              localDispatch({
                type: "toast",
                message: isNew ? `You're connected with ${name}.` : `You're already connected with ${name}.`,
              });
            }),
          );
          return;

        case "removeConnection":
          if (meId) run(removeConnection({ userId: meId, otherId: action.userId as Id<"users"> }));
          return;

        case "simulateFriends":
          if (meId) {
            run(
              demoFriends({ userId: meId }).then(() =>
                localDispatch({ type: "toast", message: "You're connected with Maya and Leo. See them under Your people." }),
              ),
            );
          }
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
    [
      createUser,
      updateUser,
      setUserStatus,
      huddleRespond,
      setHuddleStatus,
      demoHuddle,
      connectByCode,
      removeConnection,
      demoFriends,
      createRequest,
      setRequestStatus,
      resetDemo,
    ],
  );

  // Opened an invite link: connect as soon as there's an account (right after
  // sign-up if needed). The code's owner gave it out, which is their consent.
  useEffect(() => {
    if (!local.booted || !local.myUserId) return;
    const code = takePendingInvite();
    if (code) dispatch({ type: "connectCode", code });
  }, [local.booted, local.myUserId, dispatch]);

  const value = useMemo<AppContextValue | null>(() => {
    if (!event || !users) return null;
    const state: State = { ...local, event, zones, users, requests, huddles, stats, connections };
    const me = users.find((u) => u.id === local.currentUserId);
    return {
      state,
      me,
      screen: local.stack[local.stack.length - 1],
      dispatch,
      navigate: (screen, replace) => dispatch({ type: "navigate", screen, replace }),
      back: () => dispatch({ type: "back" }),
    };
  }, [local, event, zones, users, requests, huddles, stats, connections, dispatch]);

  if (!event || !users || !local.booted) return <div className="min-h-[var(--app-h)] bg-bg" />;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

const lineTime = (r: ChatRequest) => r.lineAt ?? r.createdAt;

// A speaker's line in order: accepted first, then by place in line. Members of
// a formed huddle share the place of whoever joined the line first.
export function queueFor(requests: ChatRequest[], panelId: string) {
  return requests
    .filter((r) => r.panelId === panelId && (r.status === "waiting" || r.status === "accepted"))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "accepted" ? -1 : 1;
      return lineTime(a) - lineTime(b) || a.createdAt - b.createdAt;
    });
}

// "#2 in line", counting a huddle as one place.
export function positionInQueue(requests: ChatRequest[], request: ChatRequest): number {
  const places = new Map<string, number>();
  for (const r of requests) {
    if (r.panelId !== request.panelId || r.status !== "waiting") continue;
    const key = r.huddleId ?? r.id;
    places.set(key, Math.min(places.get(key) ?? Infinity, lineTime(r)));
  }
  const order = [...places].sort((a, b) => a[1] - b[1]).map(([key]) => key);
  return order.indexOf(request.huddleId ?? request.id) + 1;
}

export { homeFor };
