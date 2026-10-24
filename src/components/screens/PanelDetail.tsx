"use client";

import { useEffect, useRef, useState } from "react";
import { sharedInterests } from "@/lib/recommend";
import { positionInQueue, queueFor, useApp } from "@/lib/store";
import { isStale, minutesAgo, minutesUntil } from "@/lib/time";
import { Avatar, Button, Header, inputClass, StatusPill, StillHereAsk, ZoneBadge } from "../ui";

export function PanelDetail({ panelId }: { panelId: string }) {
  const { state, me, dispatch, back } = useApp();
  const [note, setNote] = useState("");
  const logged = useRef(false);
  const panel = state.users.find((u) => u.id === panelId);

  useEffect(() => {
    if (!logged.current && panel) {
      logged.current = true;
      dispatch({ type: "log", activityType: "view_panel", targetId: panel.id });
    }
  }, [dispatch, panel]);

  if (!panel || !me) return null;

  const zone = state.zones.find((z) => z.id === panel.zoneId);
  const queue = queueFor(state.requests, panel.id);
  const waitingCount = queue.filter((r) => r.status === "waiting").length;
  const mine = state.requests.find(
    (r) => r.panelId === panel.id && r.attendeeId === me.id && (r.status === "waiting" || r.status === "accepted"),
  );
  const shared = sharedInterests(me, panel);
  const stale = isStale(panel.updatedAt, state.now);
  const first = panel.name.split(" ")[0];

  if (!panel.visible) {
    return (
      <>
        <Header title={panel.name} onBack={back} />
        <main className="px-5 pt-10 text-center">
          <p className="text-lg font-extrabold">{first} has left the event floor.</p>
          <p className="mt-2 text-muted">Their zone and status are no longer shared.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={panel.name} onBack={back} />
      <main className="px-5 pb-28 pt-5">
        <div className="flex items-start gap-4">
          <Avatar user={panel} size={64} />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black leading-tight">{panel.name}</h2>
            <p className="mt-1 text-muted">{panel.headline}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusPill user={panel} now={state.now} />
              <span className={`text-xs ${stale ? "font-bold text-busy-ink" : "text-muted"}`}>
                Updated {minutesAgo(panel.updatedAt, state.now)}
              </span>
            </div>
          </div>
        </div>

        {panel.status === "leaving" && panel.leavingAt && (
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-board px-4 py-3 text-white">
            <span className="font-bold">Leaving the event</span>
            <span className="font-black tabular-nums text-board-text">
              <span className="text-2xl">{minutesUntil(panel.leavingAt, state.now)}</span>
              <span className="ml-1 text-sm">min</span>
            </span>
          </div>
        )}

        <section className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <ZoneBadge zone={zone} size="lg" />
          <p className="mt-2 text-sm text-muted">{zone?.landmark}</p>
          <div className="mt-4 rounded-xl bg-surface-2 p-3">
            <p className="text-xs font-semibold text-muted">Look for</p>
            <p className="mt-0.5 text-lg font-extrabold">{panel.outfit}</p>
          </div>
          {stale && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-busy-ink">
                This hasn&apos;t been updated in a while, so {first} may have moved.
              </p>
              <StillHereAsk user={panel} />
            </div>
          )}
        </section>

        {panel.talkTitle && (
          <section className="mt-5">
            <p className="text-xs font-semibold text-muted">Talk or product</p>
            <p className="mt-1 text-lg font-bold leading-snug">{panel.talkTitle}</p>
          </section>
        )}

        <section className="mt-5">
          <p className="text-xs font-semibold text-muted">Interests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {panel.interests.map((i) => (
              <span
                key={i}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  shared.includes(i) ? "bg-primary text-on-primary" : "border border-line bg-surface"
                }`}
              >
                {i}
              </span>
            ))}
          </div>
          {shared.length > 0 && <p className="mt-2 text-xs text-muted">Dark ones are interests you share.</p>}
        </section>

        <section className="mt-7 rounded-2xl border-2 border-primary bg-surface p-4">
          {me.role === "panel" ? (
            <p className="text-sm text-muted">Switch to an attendee profile to request a chat.</p>
          ) : mine?.status === "accepted" ? (
            <>
              <p className="text-lg font-extrabold">{first} is ready for you</p>
              <p className="mt-1 text-sm text-muted">
                Head to {zone?.name} and look for {panel.outfit}.
              </p>
              <Button
                variant="go"
                icon="check"
                block
                className="mt-4"
                onClick={() => dispatch({ type: "setRequestStatus", requestId: mine.id, status: "met" })}
              >
                We met
              </Button>
            </>
          ) : mine?.status === "waiting" ? (
            <>
              <p className="text-xs font-semibold text-muted">You&apos;re in line</p>
              <p className="mt-1 text-3xl font-black">#{positionInQueue(state.requests, mine)}</p>
              {mine.note && <p className="mt-2 text-sm">&ldquo;{mine.note}&rdquo;</p>}
              <p className="mt-2 text-sm text-muted">
                We&apos;ll let you know when {first} accepts, or if they&apos;re about to leave.
              </p>
              <Button
                variant="secondary"
                icon="x"
                block
                className="mt-4"
                onClick={() => dispatch({ type: "setRequestStatus", requestId: mine.id, status: "cancelled" })}
              >
                Cancel request
              </Button>
            </>
          ) : panel.requestsPaused ? (
            <>
              <p className="text-lg font-extrabold">Not taking new requests right now</p>
              <p className="mt-1 text-sm text-muted">
                {first} paused requests. You can still walk over to {zone?.name}.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-extrabold">Talk with {first}</p>
              <p className="mt-1 text-sm text-muted">
                {waitingCount === 0 ? "No one is waiting." : `${waitingCount} ${waitingCount === 1 ? "person is" : "people are"} waiting.`}{" "}
                {first} sees your profile and accepts when ready.
              </p>
              <input
                className={`${inputClass} mt-4`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={100}
                placeholder="What do you want to ask? (optional)"
              />
              <Button
                block
                icon="chat"
                className="mt-3"
                onClick={() => {
                  dispatch({ type: "requestChat", panelId: panel.id, note });
                  setNote("");
                }}
              >
                Request to chat
              </Button>
            </>
          )}
        </section>
      </main>
    </>
  );
}
