"use client";

import { sharedInterests } from "@/lib/recommend";
import { queueFor, useApp } from "@/lib/store";
import { clockTime, minutesAgo, minutesUntil } from "@/lib/time";
import { Avatar, Button, SectionTitle } from "../ui";
import { MyBar } from "./Discover";

export function PanelNow() {
  const { state, me, dispatch } = useApp();
  if (!me) return null;

  const queue = queueFor(state.requests, me.id);
  const accepted = queue.filter((r) => r.status === "accepted");
  const waiting = queue.filter((r) => r.status === "waiting");

  const bigButton =
    me.status === "available"
      ? {
          cls: "bg-go text-white",
          title: "Free to talk",
          sub: "Tap when a conversation starts",
          next: () => dispatch({ type: "setStatus", status: "talking" }),
        }
      : me.status === "talking"
        ? {
            cls: "bg-busy text-white",
            title: "In a conversation",
            sub: "Tap when you're free again",
            next: () => dispatch({ type: "setStatus", status: "available" }),
          }
        : {
            cls: "bg-soon text-on-soon",
            title: `Leaving in ${minutesUntil(me.leavingAt ?? state.now, state.now)} min`,
            sub: "Tap if you're staying after all",
            next: () => dispatch({ type: "setStatus", status: "available" }),
          };

  return (
    <main className="px-5 pb-28 pt-5">
      <button
        onClick={bigButton.next}
        className={`w-full rounded-3xl px-6 py-8 text-left transition active:scale-[0.98] ${bigButton.cls}`}
      >
        <span className="block text-3xl font-black leading-tight">{bigButton.title}</span>
        <span className="mt-1.5 block text-sm font-semibold opacity-90">{bigButton.sub}</span>
      </button>

      <div className="mt-4">
        <p className="mb-2 text-sm font-bold">Leaving soon?</p>
        <div className="grid grid-cols-3 gap-2">
          {[10, 30, 60].map((m) => (
            <button
              key={m}
              onClick={() => dispatch({ type: "setLeaving", minutes: m })}
              className="rounded-full border border-line bg-surface py-3 text-sm font-bold transition duration-150 hover:border-primary/50 hover:bg-primary-soft active:scale-[0.96]"
            >
              {m === 60 ? "In 1 hour" : `In ${m} min`}
            </button>
          ))}
        </div>
        {me.status === "leaving" && me.leavingAt && (
          <p className="mt-2 text-xs text-muted">
            You&apos;re leaving at {clockTime(me.leavingAt)}.{" "}
            {waiting.length + accepted.length > 0
              ? "People in your line get a heads-up 10 minutes before."
              : "No one is waiting right now."}
          </p>
        )}
      </div>

      <div className="mt-4">
        <MyBar />
      </div>

      <SectionTitle
        aside={
          <label className="inline-flex items-center gap-2 text-sm font-bold text-ink">
            Taking requests
            <input
              type="checkbox"
              role="switch"
              checked={!me.requestsPaused}
              onChange={() => dispatch({ type: "updateMe", patch: { requestsPaused: !me.requestsPaused } })}
              className="h-5 w-5 accent-[var(--go)]"
            />
          </label>
        }
      >
        Your line
      </SectionTitle>

      {queue.length > 0 && (
        <p className="-mt-1 mb-3 text-sm text-muted">
          {queue.length} {queue.length === 1 ? "person wants" : "people want"} to talk with you.
        </p>
      )}

      {me.requestsPaused && (
        <p className="mb-3 rounded-xl bg-soon-soft p-3 text-sm font-semibold text-soon-ink">
          New requests are paused. People already in line stay in line.
        </p>
      )}

      <div className="space-y-3">
        {accepted.map((r) => {
          const a = state.users.find((u) => u.id === r.attendeeId);
          if (!a) return null;
          return (
            <div key={r.id} className="rounded-2xl border-2 border-go bg-surface p-4">
              <p className="text-xs font-bold text-go-ink">Coming to you now</p>
              <div className="mt-2 flex items-center gap-3">
                <Avatar user={a} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{a.name}</p>
                  <p className="truncate text-xs text-muted">Look for {a.outfit}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="go" icon="check" onClick={() => dispatch({ type: "setRequestStatus", requestId: r.id, status: "met" })}>
                  We met
                </Button>
                <Button
                  variant="secondary"
                  icon="x"
                  onClick={() => dispatch({ type: "setRequestStatus", requestId: r.id, status: "missed" })}
                >
                  Didn&apos;t show
                </Button>
              </div>
            </div>
          );
        })}

        {waiting.map((r, i) => {
          const a = state.users.find((u) => u.id === r.attendeeId);
          if (!a) return null;
          const shared = sharedInterests(me, a);
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-on-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-extrabold">{a.name}</p>
                    <span className="shrink-0 text-xs text-muted">{minutesAgo(r.createdAt, state.now)}</span>
                  </div>
                  <p className="text-sm text-muted">{a.headline}</p>
                  {r.note && <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm">&ldquo;{r.note}&rdquo;</p>}
                  {shared.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      You both like <span className="font-semibold text-ink">{shared.join(", ")}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button icon="check" onClick={() => dispatch({ type: "setRequestStatus", requestId: r.id, status: "accepted" })}>
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  icon="x"
                  onClick={() => dispatch({ type: "setRequestStatus", requestId: r.id, status: "declined" })}
                >
                  Not now
                </Button>
              </div>
            </div>
          );
        })}

        {queue.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            No one in line yet. Stay green so people know you&apos;re free.
          </p>
        )}
      </div>
    </main>
  );
}
