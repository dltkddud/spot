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
  Participation,
  Profile,
  RequestStatus,
  EventInfo,
  Role,
  ShareWith,
  Status,
  Toast,
  User,
  Zone,
} from "./types";

const PROFILE_KEY = "spot.profileId";
const EVENT_KEY = "spot.eventId";
// Before profiles, the browser remembered a participation id here.
const LEGACY_USER_KEY = "spot.myUserId";
const PENDING_CONNECT_KEY = "spot.pendingConnect";

export type Screen =
  | { name: "welcome" }
  | { name: "profileSetup" }
  | { name: "events" }
  | { name: "joinEvent"; eventId: string }
  | { name: "zonePicker"; fromOnboarding?: boolean }
  | { name: "explore"; view?: ExploreView }
  | { name: "zoneDetail"; zoneId: string }
  | { name: "panelDetail"; panelId: string }
  | { name: "requests" }
  | { name: "panelNow" }
  | { name: "me" }
  | { name: "editProfile" };

export type ExploreView = "people" | "map";

// The profile shared by every event.
export type ProfileInput = {
  name: string;
  headline: string;
  interests: string[];
  linkedinUrl?: string;
  contactUrl?: string;
};

// How I'm at one event.
export type JoinInput = {
  role: Role;
  talkTitle?: string;
  outfit: string;
  visible: boolean;
};

// Kept in the browser. Events, people and chat requests come from Convex.
type LocalState = {
  now: number;
  activity: Activity[];
  toasts: Toast[];
  profileId: string | null;
  // The event I'm looking at.
  eventId: string | null;
  // Demo: looking at the app as someone else at this event.
  viewAsId: string | null;
  stack: Screen[];
  booted: boolean;
};

type State = LocalState & {
  // My participation at this event, and whoever I'm viewing as (usually the same).
  myUserId: string | null;
  currentUserId: string | null;
  profile: Profile | null;
  events: EventInfo[];
  participations: Participation[];
  event: EventInfo;
  zones: Zone[];
  users: User[];
  requests: ChatRequest[];
  // My huddles as an attendee, and the formed huddles in my line as a speaker.
  huddles: Huddle[];
  // Event-wide counts kept on the server (huddles formed, connections made).
  stats: Record<string, number>;
  // Profiles I'm connected with (they see my zone when I share with connections).
  connections: Connection[];
};

type Action =
  | { type: "navigate"; screen: Screen; replace?: boolean }
  | { type: "back" }
  | { type: "resetTo"; screen: Screen }
  | { type: "createProfile"; profile: ProfileInput }
  | { type: "enterEvent"; eventId: string }
  | { type: "joinEvent"; eventId: string; join: JoinInput }
  | { type: "saveProfile"; profile: ProfileInput; here: { role: Role; talkTitle?: string; outfit: string } }
  | { type: "updateMe"; patch: { zoneId?: string; outfit?: string; shareWith?: ShareWith; requestsPaused?: boolean; openToHuddles?: boolean } }
  | { type: "setStatus"; status: Exclude<Status, "leaving"> }
  | { type: "setLeaving"; minutes: number }
  | { type: "askStillHere"; userId: string }
  | { type: "confirmStillHere" }
  | { type: "huddleRespond"; huddleId: string; accept: boolean }
  | { type: "setHuddleStatus"; huddleId: string; status: "accepted" | "declined" | "met" | "missed" }
  | { type: "simulateHuddle" }
  | { type: "connectCode"; code: string }
  | { type: "removeConnection"; profileId: string }
  | { type: "simulateFriends" }
  | { type: "requestChat"; panelId: string; note: string }
  | { type: "setRequestStatus"; requestId: string; status: ChatRequest["status"] }
  | { type: "log"; activityType: ActivityType; targetId?: string }
  | { type: "toast"; message: string }
  | { type: "dismissToast"; id: string }
  | { type: "viewAs"; userId: string }
  | { type: "simulateAccept" }
  | { type: "simulateLeaving" }
  | { type: "simulateLeaveNow" }
  | { type: "reset"; now: number };

type LocalAction =
  | Extract<Action, { type: "navigate" | "back" | "resetTo" | "toast" | "dismissToast" }>
  | { type: "log"; activityType: ActivityType; targetId?: string; userId: string }
  | { type: "tick"; now: number }
  | { type: "boot"; profileId: string | null; eventId: string; stack: Screen[] }
  | { type: "setProfile"; profileId: string }
  | { type: "setEvent"; eventId: string; stack: Screen[] }
  | { type: "viewAs"; userId: string | null; role: Role }
  | { type: "reset"; now: number; stack: Screen[] };

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode etc.). The profile just won't survive a reload.
  }
}

// An invite link (?connect=CODE) is remembered until there's a profile to connect.
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

function initialState(now: number): LocalState {
  return {
    now,
    activity: [],
    toasts: [],
    profileId: load(PROFILE_KEY),
    eventId: load(EVENT_KEY),
    viewAsId: null,
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
      return { ...state, booted: true, profileId: action.profileId, eventId: action.eventId, stack: action.stack };

    case "setProfile":
      return { ...state, profileId: action.profileId, stack: [{ name: "events" }] };

    case "setEvent":
      return { ...state, eventId: action.eventId, viewAsId: null, stack: action.stack };

    case "log":
      return {
        ...state,
        activity: [
          ...state.activity,
          { id: newId("act"), type: action.activityType, userId: action.userId, targetId: action.targetId, createdAt: state.now },
        ],
      };

    case "toast":
      return addToast(state, action.message);

    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case "viewAs":
      return { ...state, viewAsId: action.userId, stack: [homeFor(action.role)] };

    case "reset":
      return { ...state, activity: [], toasts: [], viewAsId: null, now: action.now, stack: action.stack };
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
  const [local, localDispatch] = useReducer(reducer, 0, () => initialState(Date.now()));

  const ensureSeed = useMutation(api.seed.ensure);
  const resetDemo = useMutation(api.seed.resetDemo);
  const createProfile = useMutation(api.profiles.create);
  const updateProfile = useMutation(api.profiles.update);
  const claimLegacy = useMutation(api.profiles.claimFromParticipation);
  const ensureCode = useMutation(api.profiles.ensureCode);
  const joinEvent = useMutation(api.events.join);
  const updateUser = useMutation(api.users.update);
  const setUserStatus = useMutation(api.users.setStatus);
  const askStillHere = useMutation(api.users.askStillHere);
  const confirmStillHere = useMutation(api.users.confirmStillHere);
  const huddleRespond = useMutation(api.huddles.respond);
  const setHuddleStatus = useMutation(api.huddles.setGroupStatus);
  const demoHuddle = useMutation(api.huddles.demoPropose);
  const connectByCode = useMutation(api.connections.connectByCode);
  const removeConnection = useMutation(api.connections.remove);
  const demoFriends = useMutation(api.connections.demoFriends);
  const createRequest = useMutation(api.chatRequests.create);
  const setRequestStatus = useMutation(api.chatRequests.setStatus);
  const demoLeaveNow = useMutation(api.leaving.demoLeaveNow);

  useEffect(() => {
    ensureSeed().catch((e) => console.error("Seeding failed", e));
    takeInviteFromUrl();
  }, [ensureSeed]);

  // Browsers from before profiles remember a participation id: carry it over.
  const [claiming, setClaiming] = useState(() => !local.profileId && !!load(LEGACY_USER_KEY));
  const [claimedProfileId, setClaimedProfileId] = useState<string | null>(null);
  useEffect(() => {
    if (!claiming) return;
    claimLegacy({ userId: load(LEGACY_USER_KEY) ?? "" })
      .then((profileId) => {
        if (profileId) save(PROFILE_KEY, profileId);
        save(LEGACY_USER_KEY, null);
        setClaimedProfileId(profileId);
      })
      .catch(() => {})
      .finally(() => setClaiming(false));
  }, [claiming, claimLegacy]);
  const profileId = local.profileId ?? claimedProfileId;

  const eventsRaw = useLatest(useQuery(api.events.list));
  const profileRaw = useLatest(useQuery(api.profiles.get, profileId ? { profileId } : "skip"));
  const partsRaw = useLatest(useQuery(api.profiles.participations, profileId ? { profileId } : "skip"));

  const events = useMemo<EventInfo[]>(
    () =>
      (eventsRaw ?? []).map(({ _id, name, venue, startsAt, endsAt, floorPlan }) => ({
        id: _id,
        name,
        venue,
        startsAt,
        endsAt,
        floorPlan,
      })),
    [eventsRaw],
  );
  // The event I picked last, or the first one (Cal Hacks) if I haven't picked.
  const eventId = local.eventId && events.some((e) => e.id === local.eventId) ? local.eventId : (events[0]?.id ?? null);

  const profile = useMemo<Profile | null>(
    () => (profileRaw ? { ...profileRaw, id: profileRaw._id } : null),
    [profileRaw],
  );
  const participations = useMemo<Participation[]>(
    () => (partsRaw ?? []).map(({ eventId, userId, role }) => ({ eventId, userId, role })),
    [partsRaw],
  );
  const myUserId = participations.find((p) => p.eventId === eventId)?.userId ?? null;
  const currentUserId = local.viewAsId ?? myUserId;

  const current = useLatest(useQuery(api.events.get, eventId ? { eventId } : "skip"));
  const rawUsers = useLatest(
    useQuery(api.users.listByEvent, eventId ? { eventId: eventId as Id<"events">, viewerId: currentUserId ?? undefined } : "skip"),
  );

  const viewerId = local.booted ? (currentUserId as Id<"users"> | null) : null;
  const openLines = useLatest(
    useQuery(api.chatRequests.activeByEvent, eventId ? { eventId: eventId as Id<"events"> } : "skip"),
  );
  const myLine = useLatest(useQuery(api.chatRequests.forPanel, viewerId ? { panelId: viewerId } : "skip"));
  const mySent = useLatest(useQuery(api.chatRequests.forAttendee, viewerId ? { attendeeId: viewerId } : "skip"));
  const myHuddles = useLatest(useQuery(api.huddles.forAttendee, viewerId ? { attendeeId: viewerId } : "skip"));
  const lineHuddles = useLatest(useQuery(api.huddles.forPanel, viewerId ? { panelId: viewerId } : "skip"));
  const summary = useLatest(useQuery(api.activity.summary, eventId ? { eventId: eventId as Id<"events"> } : "skip"));
  const myLinks = useLatest(useQuery(api.connections.mine, profileId ? { profileId } : "skip"));
  const stats = useMemo(() => summary ?? {}, [summary]);

  // While switching events the previous event's data is still showing; treat it as loading.
  const event = useMemo<EventInfo | undefined>(
    () => (current && current.event._id === eventId ? events.find((e) => e.id === eventId) : undefined),
    [current, eventId, events],
  );
  const zones = useMemo<Zone[]>(
    () =>
      (current?.event._id === eventId ? current.zones : []).map((z) => ({
        id: z._id,
        code: z.code,
        name: z.name,
        landmark: z.landmark,
        icon: z.icon,
      })),
    [current, eventId],
  );
  const users = useMemo<User[] | undefined>(
    () =>
      rawUsers && rawUsers.every((u) => u.eventId === eventId)
        ? // eslint-disable-next-line @typescript-eslint/no-unused-vars
          rawUsers.map(({ _id, _creationTime, eventId, ...u }) => ({ id: _id, ...u }))
        : undefined,
    [rawUsers, eventId],
  );
  const connections = useMemo<Connection[]>(
    () =>
      (myLinks ?? []).map(({ otherId, name, source, createdAt }) => ({
        profileId: otherId,
        name,
        userId: users?.find((u) => u.profileId === otherId)?.id,
        source,
        createdAt,
      })),
    [myLinks, users],
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
        closedBecause: r.closedBecause,
        followUp: r.followUp && { text: r.followUp.text, source: r.followUp.source },
      });
    }
    return [...byId.values()];
  }, [openLines, myLine, mySent]);

  const huddles = useMemo<Huddle[]>(() => {
    const byId = new Map<string, Huddle>();
    for (const h of [...(lineHuddles ?? []), ...(myHuddles ?? [])]) byId.set(h._id, { ...h, id: h._id });
    return [...byId.values()];
  }, [lineHuddles, myHuddles]);

  // First screen once everything I need has loaded: Welcome without a profile,
  // my home at the event I picked last, or the Events list.
  const profileLoaded = !profileId || (profileRaw !== undefined && partsRaw !== undefined);
  useEffect(() => {
    if (local.booted || claiming || !eventsRaw || !eventId || !profileLoaded) return;
    const known = profileId && profile ? profileId : null;
    if (profileId && !known) save(PROFILE_KEY, null);
    const mine = known ? participations.find((p) => p.eventId === eventId) : undefined;
    const stack: Screen[] = !known ? [{ name: "welcome" }] : mine ? [homeFor(mine.role)] : [{ name: "events" }];
    localDispatch({ type: "boot", profileId: known, eventId, stack });
  }, [local.booted, claiming, eventsRaw, eventId, profileLoaded, profileId, profile, participations]);

  const latest = useRef({ local, users: users ?? [], zones, event, requests, myUserId, currentUserId, participations, profileId });
  useEffect(() => {
    latest.current = { local, users: users ?? [], zones, event, requests, myUserId, currentUserId, participations, profileId };
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
        } else if (r.status === "missed" && r.closedBecause === "speaker_left") {
          const first = panel.name.split(" ")[0];
          localDispatch({
            type: "toast",
            message: panel.linkedinUrl
              ? `${first} has left. Keep the conversation going on LinkedIn.`
              : `${first} has left. Keep the conversation going with a quick message.`,
          });
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

  // Banner once someone I asked "Still here?" answers (or updates anything).
  // Kept per viewer in this browser: user id -> their updatedAt when I asked.
  const askedStillHere = useRef<{ viewerId: string | null; at: Map<string, number> }>({ viewerId: null, at: new Map() });
  useEffect(() => {
    if (!users) return;
    if (askedStillHere.current.viewerId !== viewerId) askedStillHere.current = { viewerId, at: new Map() };
    const { at } = askedStillHere.current;
    for (const [userId, before] of at) {
      const u = users.find((x) => x.id === userId);
      if (!u) {
        at.delete(userId);
        continue;
      }
      if (u.updatedAt <= before) continue;
      at.delete(userId);
      const first = u.name.split(" ")[0];
      const zone = zones.find((z) => z.id === u.zoneId);
      localDispatch({
        type: "toast",
        message: u.visible && zone ? `${first} just confirmed: ${zone.name}.` : `${first} isn't sharing a zone anymore.`,
      });
    }
  }, [viewerId, users, zones]);

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
  const seenLinks = useRef<{ profileId: string; ids: Set<string>; loaded: boolean } | null>(null);
  useEffect(() => {
    if (!profileId || !myLinks) return;
    if (seenLinks.current?.profileId !== profileId) seenLinks.current = { profileId, ids: new Set(), loaded: false };
    const seen = seenLinks.current;
    for (const link of myLinks) {
      if (seen.ids.has(link.otherId)) continue;
      seen.ids.add(link.otherId);
      if (!seen.loaded || (link.source !== "huddle" && link.by === profileId)) continue;
      const name = link.name.split(" ")[0];
      localDispatch({
        type: "toast",
        message: link.source === "huddle" ? `You and ${name} are now connected.` : `${name} connected with you.`,
      });
    }
    seen.loaded = true;
  }, [profileId, myLinks]);

  // Profiles made before connect codes existed get one when they open the app.
  const needsCode = !!profile && !profile.connectCode;
  useEffect(() => {
    if (needsCode && profileId) ensureCode({ profileId: profileId as Id<"profiles"> }).catch(() => {});
  }, [needsCode, profileId, ensureCode]);

  const busy = useRef(false);

  const dispatch = useCallback<Dispatch<Action>>(
    (action) => {
      const { local, users, event, requests, myUserId, currentUserId, participations, profileId } = latest.current;
      const meId = currentUserId as Id<"users"> | null;
      const run = (p: Promise<unknown>) =>
        p.catch((e) => localDispatch({ type: "toast", message: errorMessage(e) }));
      // Only one sign-up step at a time, so a double tap doesn't make two.
      const once = (p: () => Promise<unknown>) => {
        if (busy.current) return;
        busy.current = true;
        run(p()).finally(() => {
          busy.current = false;
        });
      };
      const at = event && myUserId ? { eventId: event.id as Id<"events">, userId: myUserId as Id<"users"> } : {};

      switch (action.type) {
        case "createProfile":
          once(() =>
            createProfile(action.profile).then((id) => {
              save(PROFILE_KEY, id);
              localDispatch({ type: "setProfile", profileId: id });
            }),
          );
          return;

        case "enterEvent": {
          const mine = participations.find((p) => p.eventId === action.eventId);
          save(EVENT_KEY, action.eventId);
          localDispatch({
            type: "setEvent",
            eventId: action.eventId,
            stack: mine ? [homeFor(mine.role)] : [{ name: "events" }, { name: "joinEvent", eventId: action.eventId }],
          });
          return;
        }

        case "joinEvent":
          if (!profileId) return;
          once(() =>
            joinEvent({
              eventId: action.eventId as Id<"events">,
              profileId: profileId as Id<"profiles">,
              ...action.join,
            }).then(() => {
              save(EVENT_KEY, action.eventId);
              localDispatch({ type: "setEvent", eventId: action.eventId, stack: [{ name: "zonePicker", fromOnboarding: true }] });
            }),
          );
          return;

        case "saveProfile": {
          if (!profileId) return;
          const { profile, here } = action;
          once(() =>
            Promise.all([
              updateProfile({
                profileId: profileId as Id<"profiles">,
                ...profile,
                // Empty strings clear a link.
                linkedinUrl: profile.linkedinUrl ?? "",
                contactUrl: profile.contactUrl ?? "",
              }),
              myUserId &&
                updateUser({ id: myUserId as Id<"users">, role: here.role, talkTitle: here.talkTitle ?? "", outfit: here.outfit }),
            ]).then(() => {
              localDispatch({ type: "toast", message: "Profile saved." });
              localDispatch({ type: "resetTo", screen: { name: "me" } });
            }),
          );
          return;
        }

        case "updateMe": {
          if (!meId) return;
          const { zoneId, outfit, shareWith, requestsPaused, openToHuddles } = action.patch;
          if (openToHuddles !== undefined) {
            const viewed = users.find((u) => u.id === meId);
            if (viewed) run(updateProfile({ profileId: viewed.profileId as Id<"profiles">, openToHuddles }));
          }
          if (zoneId !== undefined || outfit !== undefined || shareWith !== undefined || requestsPaused !== undefined) {
            run(updateUser({ id: meId, zoneId: zoneId as Id<"zones"> | undefined, outfit, shareWith, requestsPaused }));
          }
          return;
        }

        case "setStatus":
          if (meId) run(setUserStatus({ id: meId, status: action.status }));
          return;

        case "setLeaving":
          if (meId) run(setUserStatus({ id: meId, status: "leaving", leavingInMin: action.minutes }));
          return;

        case "askStillHere": {
          if (!meId) return;
          const target = users.find((u) => u.id === action.userId);
          run(
            askStillHere({ id: action.userId as Id<"users">, askerId: meId }).then(() => {
              if (target) askedStillHere.current.at.set(action.userId, target.updatedAt);
              const first = target?.name.split(" ")[0] ?? "They";
              localDispatch({ type: "toast", message: `Asked ${first}. We'll let you know when they answer.` });
            }),
          );
          return;
        }

        case "confirmStillHere":
          if (meId) run(confirmStillHere({ id: meId }));
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
                if (activityType) localDispatch({ type: "log", activityType, targetId: meId, userId: meId });
              },
            ),
          );
          return;
        }

        case "simulateHuddle":
          if (meId) run(demoHuddle({ attendeeId: meId }));
          return;

        case "connectCode":
          if (!profileId) return;
          run(
            connectByCode({ profileId: profileId as Id<"profiles">, code: action.code, ...at }).then(({ name, isNew }) => {
              localDispatch({
                type: "toast",
                message: isNew ? `You're connected with ${name}.` : `You're already connected with ${name}.`,
              });
            }),
          );
          return;

        case "removeConnection":
          if (profileId) {
            run(removeConnection({ profileId: profileId as Id<"profiles">, otherId: action.profileId as Id<"profiles"> }));
          }
          return;

        case "simulateFriends":
          if (!profileId) return;
          run(
            demoFriends({ profileId: profileId as Id<"profiles">, ...at }).then(() =>
              localDispatch({
                type: "toast",
                message: "You're connected with Maya and Leo. You'll see them under Your people at Cal Hacks.",
              }),
            ),
          );
          return;

        case "requestChat":
          if (!meId) return;
          run(
            createRequest({ attendeeId: meId, panelId: action.panelId as Id<"users">, note: action.note }).then(() =>
              localDispatch({ type: "log", activityType: "request_chat", targetId: action.panelId, userId: meId }),
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
              if (activityType) localDispatch({ type: "log", activityType, targetId: req.panelId, userId: meId });
            }),
          );
          return;
        }

        case "log":
          if (meId) localDispatch({ ...action, userId: meId });
          return;

        case "viewAs": {
          const target = users.find((u) => u.id === action.userId);
          if (target) localDispatch({ type: "viewAs", userId: target.id === myUserId ? null : target.id, role: target.role });
          return;
        }

        case "simulateAccept": {
          const req = requests
            .filter((r) => r.attendeeId === meId && r.status === "waiting")
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
          const req = requests.find((r) => r.attendeeId === meId && (r.status === "waiting" || r.status === "accepted"));
          if (!req) {
            localDispatch({ type: "toast", message: "Send a chat request first, then try this again." });
            return;
          }
          run(
            setUserStatus({ id: req.panelId as Id<"users">, status: "leaving", leavingInMin: LEAVE_WARNING_MIN }),
          );
          return;
        }

        case "simulateLeaveNow":
          if (meId) run(demoLeaveNow({ attendeeId: meId }));
          return;

        case "reset": {
          if (!event) return;
          const mine = participations.find((p) => p.eventId === event.id);
          const stack: Screen[] = !local.profileId ? [{ name: "welcome" }] : mine ? [homeFor(mine.role)] : [{ name: "events" }];
          run(
            resetDemo({ eventId: event.id as Id<"events"> }).then(() =>
              localDispatch({ type: "reset", now: action.now, stack }),
            ),
          );
          return;
        }

        default:
          localDispatch(action);
      }
    },
    [
      createProfile,
      updateProfile,
      joinEvent,
      updateUser,
      setUserStatus,
      askStillHere,
      confirmStillHere,
      huddleRespond,
      setHuddleStatus,
      demoHuddle,
      connectByCode,
      removeConnection,
      demoFriends,
      createRequest,
      setRequestStatus,
      demoLeaveNow,
      resetDemo,
    ],
  );

  // Opened an invite link: connect as soon as there's a profile (right after
  // making one if needed). The code's owner gave it out, which is their consent.
  useEffect(() => {
    if (!local.booted || !profileId) return;
    const code = takePendingInvite();
    if (code) dispatch({ type: "connectCode", code });
  }, [local.booted, profileId, dispatch]);

  const value = useMemo<AppContextValue | null>(() => {
    if (!event || !users) return null;
    const state: State = {
      ...local,
      profileId,
      eventId: event.id,
      myUserId,
      currentUserId,
      profile,
      events,
      participations,
      event,
      zones,
      users,
      requests,
      huddles,
      stats,
      connections,
    };
    const me = users.find((u) => u.id === currentUserId);
    return {
      state,
      me,
      screen: local.stack[local.stack.length - 1],
      dispatch,
      navigate: (screen, replace) => dispatch({ type: "navigate", screen, replace }),
      back: () => dispatch({ type: "back" }),
    };
  }, [
    local,
    profileId,
    myUserId,
    currentUserId,
    profile,
    events,
    participations,
    event,
    zones,
    users,
    requests,
    huddles,
    stats,
    connections,
    dispatch,
  ]);

  if (!local.booted || !event || !users) return <div className="min-h-[var(--app-h)] bg-bg" />;

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
