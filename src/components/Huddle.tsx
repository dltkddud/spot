"use client";

import { positionInQueue, useApp } from "@/lib/store";
import type { ChatRequest, Huddle, User } from "@/lib/types";
import { Avatar, Button, Icon } from "./ui";

const first = (u?: User) => u?.name.split(" ")[0] ?? "Someone";

export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function InterestChips({ interests }: { interests: string[] }) {
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

// An attendee's view of one huddle: the suggestion, waiting on others, ready,
// or "Stay connected?" after meeting.
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

  if (huddle.status === "met") {
    return (
      <section className={shell}>
        <p className="flex items-center gap-2 text-xs font-bold text-primary-ink">
          <Icon name="users" size={16} />
          You met {first(panel)} together
        </p>
        <div className="mt-3 space-y-3">
          {others
            .filter((o) => huddle.stayPending.includes(o.userId))
            .map((o) => (
              <div key={o.userId} className="rounded-xl bg-surface p-3">
                <p className="font-extrabold">Stay connected with {first(o.user)}?</p>
                <p className="mt-0.5 text-xs text-muted">
                  If you both say yes, you&apos;ll see each other&apos;s zone at events.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    icon="check"
                    className="px-3 text-sm"
                    onClick={() => dispatch({ type: "stayConnected", huddleId: huddle.id, otherId: o.userId, yes: true })}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 text-sm"
                    onClick={() => dispatch({ type: "stayConnected", huddleId: huddle.id, otherId: o.userId, yes: false })}
                  >
                    No thanks
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </section>
    );
  }

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
        <div className="mt-2">
          <InterestChips interests={huddle.sharedInterests} />
        </div>
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
        Huddle idea
      </p>
      <p className="mt-1 text-lg font-extrabold leading-snug">
        {names} {others.length > 1 ? "are" : "is"} into {topic} too. Meet {first(panel)} together?
      </p>
      <div className="mt-2">
        <InterestChips interests={huddle.sharedInterests} />
      </div>
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
              className="px-3 text-sm"
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
  return huddles.find((h) => h.status !== "met" && h.members.some((m) => m.requestId === request.id));
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
  const { state, dispatch } = useApp();
  const accepted = requests.every((r) => r.status === "accepted");
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
          {accepted && <p className="text-xs font-bold text-go-ink">Coming to you now</p>}
          <p className="flex items-center gap-1.5 font-extrabold">
            <Icon name="users" size={18} />
            <span>{`Huddle · ${people.length} people · All into ${joinNames(huddle.sharedInterests.slice(0, 2))}`}</span>
          </p>
        </div>
      </div>
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
