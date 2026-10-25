"use client";

import { positionInQueue, useApp } from "@/lib/store";
import type { ChatRequest, Huddle, User } from "@/lib/types";
import { AiTag, Avatar, Button, Icon } from "./ui";

const first = (u?: User) => u?.name.split(" ")[0] ?? "Someone";

export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function InterestChips({ interests }: { interests: string[] }) {
  if (interests.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {interests.map((i) => (
        <span key={i} className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-on-primary">
          {i}
        </span>
      ))}
    </div>
  );
}

// Why we're grouped: Claude's reason and why it's worth it for me, or the
// interests we share when Claude wasn't available.
function WhyTogether({ huddle, whyYou }: { huddle: Huddle; whyYou?: string }) {
  if (huddle.source === "claude" && huddle.reason) {
    return (
      <div className="mt-2 space-y-1.5">
        <p className="text-sm font-semibold leading-snug">{huddle.reason}</p>
        {whyYou && <p className="text-sm text-muted">{whyYou}</p>}
        <AiTag claude />
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <InterestChips interests={huddle.sharedInterests} />
      <AiTag claude={false} />
    </div>
  );
}

// What a suggestion shows about other people: name, one line, outfit. Never their note.
function Person({ user }: { user: User }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar user={user} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.headline}</p>
        <p className="truncate text-xs text-muted">
          Look for <span className="font-semibold text-ink">{user.outfit}</span>
        </p>
      </div>
    </div>
  );
}

// An attendee's view of one huddle: the suggestion, waiting on others, or ready.
export function HuddleCard({ huddle, compact }: { huddle: Huddle; compact?: boolean }) {
  const { state, me, dispatch } = useApp();
  if (!me) return null;
  const mine = huddle.members.find((m) => m.userId === me.id);
  if (!mine) return null;

  const panel = state.users.find((u) => u.id === huddle.panelId);
  const others = huddle.members
    .filter((m) => m.userId !== me.id)
    .map((m) => ({ ...m, user: state.users.find((u) => u.id === m.userId) }))
    .filter((m): m is typeof m & { user: User } => !!m.user);
  const names = joinNames(others.map((o) => first(o.user)));
  const topic = joinNames(huddle.sharedInterests.slice(0, 2));
  const myRequest = state.requests.find((r) => r.id === mine.requestId);
  const shell = "rounded-2xl border-2 border-primary bg-primary-soft p-4";

  if (huddle.status === "formed") {
    const accepted = myRequest?.status === "accepted";
    return (
      <section className={shell}>
        <p className="flex items-center gap-2 text-xs font-bold text-primary-ink">
          <Icon name="users" size={16} />
          Huddle with {names}
        </p>
        <p className="mt-1 text-lg font-extrabold leading-snug">
          {accepted
            ? `${first(panel)} is ready for your huddle.`
            : `Huddle ready. You're #${myRequest ? positionInQueue(state.requests, myRequest) : 1} together.`}
        </p>
        {!compact && <WhyTogether huddle={huddle} whyYou={mine.whyYou} />}
        {!compact && (
          <div className="mt-3 space-y-3 rounded-xl bg-surface p-3">
            {others.map((o) => (
              <Person key={o.userId} user={o.user} />
            ))}
          </div>
        )}
      </section>
    );
  }

  // Proposed.
  const waitingOn = others.filter((o) => o.response !== "yes").map((o) => first(o.user));
  return (
    <section className={shell}>
      <p className="flex items-center gap-2 text-xs font-bold text-primary-ink">
        <Icon name="users" size={16} />
        {first(panel)} suggests a huddle
      </p>
      <p className="mt-1 text-lg font-extrabold leading-snug">
        {huddle.source === "claude" || !topic
          ? `Meet ${first(panel)} together with ${names}?`
          : `${names} ${others.length > 1 ? "are" : "is"} into ${topic} too. Meet ${first(panel)} together?`}
      </p>
      <WhyTogether huddle={huddle} whyYou={mine.whyYou} />
      {!compact && (
        <div className="mt-3 space-y-3 rounded-xl bg-surface p-3">
          {others.map((o) => (
            <Person key={o.userId} user={o.user} />
          ))}
        </div>
      )}
      {mine.response === "yes" ? (
        <p className="mt-3 text-sm font-semibold text-primary-ink">
          You&apos;re in. Waiting for {joinNames(waitingOn)} to say yes.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted">Meeting together moves you up to the earliest spot among you.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              icon="users"
              className="whitespace-nowrap px-3 text-sm"
              onClick={() => dispatch({ type: "huddleRespond", huddleId: huddle.id, accept: true })}
            >
              Huddle up
            </Button>
            <Button
              variant="secondary"
              className="px-3 text-sm"
              onClick={() => dispatch({ type: "huddleRespond", huddleId: huddle.id, accept: false })}
            >
              Not this time
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

// The open huddle a request belongs to, from the attendee's side.
export function huddleForRequest(huddles: Huddle[], request: ChatRequest) {
  return huddles.find((h) => h.members.some((m) => m.requestId === request.id));
}

// The speaker's view: a whole huddle as one card, with every member's note.
export function PanelHuddleCard({
  huddle,
  requests,
  place,
}: {
  huddle: Huddle;
  requests: ChatRequest[];
  place?: number;
}) {
  const { state, me, dispatch } = useApp();
  const accepted = requests.every((r) => r.status === "accepted");
  const myZone = state.zones.find((z) => z.id === me?.zoneId);
  const people = requests
    .map((r) => ({ r, user: state.users.find((u) => u.id === r.attendeeId) }))
    .filter((p): p is { r: ChatRequest; user: User } => !!p.user);
  const set = (status: "accepted" | "declined" | "met" | "missed") =>
    dispatch({ type: "setHuddleStatus", huddleId: huddle.id, status });

  return (
    <div className={`rounded-2xl border-2 bg-surface p-4 ${accepted ? "border-go" : "border-primary"}`}>
      <div className="flex items-start gap-3">
        {place !== undefined && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-on-primary">
            {place}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {accepted && (
            <>
              <p className="text-lg font-black text-go-ink">Stay where you are</p>
              <p className="mb-2 text-sm text-muted">
                {joinNames(people.map((p) => first(p.user)))} {people.length > 1 ? "are" : "is"} on the way
                {myZone ? ` to ${myZone.name}` : ""}.
              </p>
            </>
          )}
          <p className="flex items-center gap-1.5 font-extrabold">
            <Icon name="users" size={18} />
            <span>
              {huddle.sharedQuestion || huddle.sharedInterests.length === 0
                ? `Huddle · ${people.length} people`
                : `Huddle · ${people.length} people · All into ${joinNames(huddle.sharedInterests.slice(0, 2))}`}
            </span>
          </p>
        </div>
      </div>
      {huddle.sharedQuestion && (
        <div className="mt-3 rounded-xl bg-primary-soft p-3">
          <p className="text-xs font-bold text-primary-ink">They all want to know:</p>
          <p className="mt-0.5 font-bold leading-snug">{huddle.sharedQuestion}</p>
          <div className="mt-2">
            <AiTag claude={huddle.source === "claude"} />
          </div>
        </div>
      )}
      {!huddle.sharedQuestion && (
        <div className="mt-2">
          <AiTag claude={false} />
        </div>
      )}
      <ul className="mt-3 space-y-3">
        {people.map(({ r, user }) => (
          <li key={r.id} className="flex items-start gap-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{user.name}</p>
              <p className="text-xs text-muted">{accepted ? `Look for ${user.outfit}` : user.headline}</p>
              {r.note && !accepted && <p className="mt-1.5 rounded-xl bg-surface-2 p-2.5 text-sm">&ldquo;{r.note}&rdquo;</p>}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {accepted ? (
          <>
            <Button variant="go" icon="check" onClick={() => set("met")}>
              We met
            </Button>
            <Button variant="secondary" icon="x" onClick={() => set("missed")}>
              Didn&apos;t show
            </Button>
          </>
        ) : (
          <>
            <Button icon="check" onClick={() => set("accepted")}>
              Accept
            </Button>
            <Button variant="secondary" icon="x" onClick={() => set("declined")}>
              Not now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// The speaker's view of Claude's idea for their line, before the guests see
// it: who, why, and the question they share. "Ask them" sends it; each guest
// still says yes or not this time.
export function SuggestedHuddleCard({ huddle }: { huddle: Huddle }) {
  const { state, dispatch } = useApp();
  const people = huddle.members
    .map((m) => ({
      m,
      user: state.users.find((u) => u.id === m.userId),
      r: state.requests.find((r) => r.id === m.requestId),
    }))
    .filter((p): p is typeof p & { user: User } => !!p.user);
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary bg-primary-soft p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold text-primary-ink">
        <Icon name="users" size={16} />
        Huddle idea for your line
      </p>
      <p className="mt-1 text-lg font-extrabold leading-snug">
        Meet {joinNames(people.map((p) => first(p.user)))} together?
      </p>
      {huddle.reason && <p className="mt-1 text-sm font-semibold leading-snug">{huddle.reason}</p>}
      {huddle.sharedQuestion && (
        <div className="mt-3 rounded-xl bg-surface p-3">
          <p className="text-xs font-bold text-primary-ink">They all want to know:</p>
          <p className="mt-0.5 font-bold leading-snug">{huddle.sharedQuestion}</p>
        </div>
      )}
      {!huddle.reason && (
        <div className="mt-2">
          <InterestChips interests={huddle.sharedInterests} />
        </div>
      )}
      <ul className="mt-3 space-y-3 rounded-xl bg-surface p-3">
        {people.map(({ m, user, r }) => (
          <li key={m.userId} className="flex items-start gap-3">
            <Avatar user={user} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.headline}</p>
              {r?.note && <p className="mt-1.5 rounded-xl bg-surface-2 p-2.5 text-sm">&ldquo;{r.note}&rdquo;</p>}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <AiTag claude={huddle.source === "claude"} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Ask them and each person says yes or not this time. If everyone says yes, they meet you together.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button icon="users" className="px-3 text-sm" onClick={() => dispatch({ type: "sendHuddle", huddleId: huddle.id })}>
          Ask them
        </Button>
        <Button variant="secondary" className="px-3 text-sm" onClick={() => dispatch({ type: "skipHuddle", huddleId: huddle.id })}>
          Skip
        </Button>
      </div>
    </div>
  );
}
