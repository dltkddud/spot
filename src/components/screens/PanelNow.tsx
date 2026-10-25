"use client";

import { useState } from "react";
import { linkHref } from "@/lib/links";
import { queueFor, useApp } from "@/lib/store";
import { clockTime, LEAVING_MIN_MAX, timeLeftLabel } from "@/lib/time";
import { Avatar, Button, Icon, inputClass, SectionTitle } from "../ui";
import { MyBar } from "./Discover";

export function PanelNow() {
  const { state, me, dispatch } = useApp();
  if (!me) return null;

  const queue = queueFor(state.requests, me.id);
  const accepted = queue.filter((r) => r.status === "accepted");
  const waiting = queue.filter((r) => r.status === "waiting");
  const inLine = waiting.length + accepted.length;
  const hasLeft = me.status === "leaving" && !!me.leavingAt && me.leavingAt <= state.now && !me.visible;

  if (hasLeft) {
    return (
      <main className="px-5 pb-28 pt-5">
        <section className="rounded-3xl bg-board px-6 py-8 text-white">
          <p className="text-3xl font-black leading-tight">You&apos;ve left the event floor</p>
          <p className="mt-2 text-sm text-board-dim">
            People who were in your line got your LinkedIn and a message they can send you.
          </p>
          <Button variant="go" icon="refresh" block className="mt-5" onClick={() => dispatch({ type: "comeBack" })}>
            I&apos;m back
          </Button>
        </section>
        <PeopleYouMissed />
      </main>
    );
  }

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
            title: `Leaving in ${timeLeftLabel(me.leavingAt ?? state.now, state.now)}`,
            sub: "Tap if you're staying after all",
            next: () => dispatch({ type: "setStatus", status: "available" }),
          };

  return (
    <main className="px-5 pb-28 pt-5">
      <button
        onClick={bigButton.next}
        className={`w-full rounded-3xl px-6 py-8 text-left transition active:scale-[0.98] ${bigButton.cls}`}
      >
        <span className="block text-3xl font-black tabular-nums leading-tight">{bigButton.title}</span>
        <span className="mt-1.5 block text-sm font-semibold opacity-90">{bigButton.sub}</span>
      </button>

      <LeavingControls inLine={inLine} />

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

      {me.requestsPaused && (
        <p className="mb-3 rounded-xl bg-soon-soft p-3 text-sm font-semibold text-soon-ink">
          New requests are paused. People already in line stay in line.
        </p>
      )}

      {/* The line itself (accept, decline, We met) is in the Requests tab. */}
      {inLine > 0 ? (
        <button
          onClick={() => dispatch({ type: "resetTo", screen: { name: "requests" } })}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft p-4 text-left transition duration-150 active:scale-[0.99]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-black text-on-primary">
            {inLine}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-primary-ink">
              {waiting.length > 0
                ? `${waiting.length} ${waiting.length === 1 ? "person is" : "people are"} waiting`
                : `${accepted.length} coming to you now`}
            </span>
            <span className="block text-sm text-muted">Accept or decline in Requests</span>
          </span>
          <Icon name="arrow" size={18} />
        </button>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          No one in line yet. Stay green so people know you&apos;re free.
        </p>
      )}

      <PeopleYouMissed />
    </main>
  );
}

// When do I have to go (or stop to talk with someone else)? 10 / 30 / 60
// minutes, any number of minutes, or right now. My line sees the same countdown.
function LeavingControls({ inLine }: { inLine: number }) {
  const { state, me, dispatch, navigate } = useApp();
  const [custom, setCustom] = useState("");
  const [confirmNow, setConfirmNow] = useState(false);
  if (!me) return null;
  const minutes = Number(custom);
  const customOk = custom !== "" && Number.isInteger(minutes) && minutes >= 1 && minutes <= LEAVING_MIN_MAX;
  const pill =
    "rounded-full border border-line bg-surface py-3 text-sm font-bold transition duration-150 hover:border-primary/50 hover:bg-primary-soft active:scale-[0.96]";

  return (
    <section className="mt-4">
      <p className="text-sm font-bold">Leaving soon?</p>
      <p className="mb-2 text-xs text-muted">When you have to go, or stop to talk with someone else.</p>
      <div className="grid grid-cols-3 gap-2">
        {[10, 30, 60].map((m) => (
          <button key={m} onClick={() => dispatch({ type: "setLeaving", minutes: m })} className={pill}>
            {m === 60 ? "In 1 hour" : `In ${m} min`}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customOk) return;
          dispatch({ type: "setLeaving", minutes });
          setCustom("");
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Minutes until you leave</span>
          <input
            className={`${inputClass} pr-14`}
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            inputMode="numeric"
            placeholder={`Other (1–${LEAVING_MIN_MAX})`}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">min</span>
        </label>
        <Button type="submit" variant="secondary" icon="clock" disabled={!customOk}>
          Set
        </Button>
      </form>

      {me.status === "leaving" && me.leavingAt && (
        <p className="mt-2 text-xs text-muted">
          You&apos;re leaving at {clockTime(me.leavingAt)}, in {timeLeftLabel(me.leavingAt, state.now)}.{" "}
          {inLine > 0 ? "People in your line get a heads-up 10 minutes before." : "No one is waiting right now."}
        </p>
      )}

      {confirmNow ? (
        <div className="mt-3 rounded-2xl border-2 border-soon bg-soon-soft p-4">
          <p className="font-extrabold text-soon-ink">Leave the event floor now?</p>
          <p className="mt-1 text-sm">
            {inLine > 0
              ? `Your line closes. ${inLine} ${inLine === 1 ? "person gets" : "people get"} your LinkedIn and a message they can send you.`
              : "You'll be hidden from the map. You can come back anytime."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" className="px-3 text-sm" onClick={() => setConfirmNow(false)}>
              Not yet
            </Button>
            <Button
              className="px-3 text-sm"
              onClick={() => {
                setConfirmNow(false);
                dispatch({ type: "leaveNow" });
              }}
            >
              Leave now
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmNow(true)}
          className="mt-2 w-full rounded-full border border-soon py-3 text-sm font-bold text-soon-ink transition duration-150 hover:bg-soon-soft active:scale-[0.97]"
        >
          Leaving now
        </button>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
        <Icon name="linkedin" size={14} />
        <span>
          If you can&apos;t get to someone, they get your LinkedIn.
          {!me.linkedinUrl && (
            <>
              {" "}
              <button
                onClick={() => navigate({ name: "editProfile" })}
                className="font-bold text-primary-ink underline underline-offset-2"
              >
                Add yours
              </button>
            </>
          )}
        </span>
      </p>
    </section>
  );
}

// Guests who never got their chat with me, newest first, with their LinkedIn.
function PeopleYouMissed() {
  const { state, me } = useApp();
  if (!me) return null;
  const seen = new Set<string>();
  const people = [];
  for (const r of state.requests
    .filter((r) => r.panelId === me.id && (r.status === "missed" || r.status === "declined") && r.closedBecause)
    .sort((a, b) => b.createdAt - a.createdAt)) {
    const u = state.users.find((x) => x.id === r.attendeeId);
    if (!u || seen.has(u.id)) continue;
    seen.add(u.id);
    people.push(u);
  }
  if (people.length === 0) return null;

  return (
    <section>
      <SectionTitle aside={`${people.length}`}>People you missed</SectionTitle>
      <ul className="space-y-2">
        {people.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <Avatar user={u} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{u.name}</span>
              <span className="block truncate text-xs text-muted">{u.headline}</span>
            </span>
            {u.linkedinUrl && (
              <a
                href={linkHref(u.linkedinUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-bold text-on-primary"
              >
                <Icon name="linkedin" size={16} />
                LinkedIn
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
