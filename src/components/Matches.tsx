"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import type { Match, MatchSuggestion, User } from "@/lib/types";
import { AiTag, Avatar, Button, Icon, PillButton, RoleBadge, StatusPill, ZoneBadge } from "./ui";

const first = (u?: User) => u?.name.split(" ")[0] ?? "them";

// "you.learnToday" -> "what you want to learn", "them.canShare" -> "what Leo can share".
// basedOn is written from the side of whoever the match was found for; flip it
// when showing it to the other person.
function basisLabel(basis: string, other: User | undefined, flip: boolean) {
  const [who0, field] = basis.split(".");
  const who = flip ? (who0 === "you" ? "them" : "you") : who0;
  const name = first(other);
  const mine = who === "you";
  switch (field) {
    case "learnToday":
      return mine ? "what you want to learn" : `what ${name} wants to learn`;
    case "canShare":
      return mine ? "what you can share" : `what ${name} can share`;
    case "interests":
      return mine ? "your interests" : `${name}'s interests`;
    case "headline":
      return mine ? "your one-liner" : `${name}'s one-liner`;
    case "talkTitle":
      return mine ? "your talk" : `${name}'s talk`;
    default:
      return null;
  }
}

// Shows what the match rests on, so it's clear Spot used what people wrote.
export function BasedOn({
  basedOn,
  other,
  flip = false,
  source,
}: {
  basedOn: string[];
  other?: User;
  flip?: boolean;
  source: "claude" | "interests" | "demo";
}) {
  const labels = basedOn.map((b) => basisLabel(b, other, flip)).filter((l): l is string => !!l);
  if (source !== "claude") return <AiTag claude={false} />;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-primary-ink">
      <AiTag claude />
      {labels.length > 0 && <span>Based on: {labels.join(" · ")}</span>}
    </p>
  );
}

function PersonLine({ person }: { person: User }) {
  const { state } = useApp();
  const zone = person.visible ? state.zones.find((z) => z.id === person.zoneId) : undefined;
  return (
    <div className="flex items-start gap-3">
      <Avatar user={person} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate font-bold">{person.name}</span>
          <RoleBadge role={person.role} />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusPill user={person} now={state.now} />
          {zone && <ZoneBadge zone={zone} />}
        </div>
      </div>
    </div>
  );
}

function StartWith({ question }: { question: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs font-bold text-muted">Start with:</p>
      <p className="mt-0.5 text-sm font-semibold">&ldquo;{question}&rdquo;</p>
    </div>
  );
}

function SuggestionCard({ s, source }: { s: MatchSuggestion; source: "claude" | "interests" }) {
  const { state, dispatch } = useApp();
  const other = state.users.find((u) => u.id === s.userId);
  if (!other) return null;
  const open = state.matches.find(
    (m) => (m.fromId === other.id || m.toId === other.id) && ["proposed", "accepted", "started"].includes(m.status),
  );
  return (
    <article className="space-y-3 rounded-2xl border-2 border-primary bg-surface p-4">
      <PersonLine person={other} />
      <p className="font-semibold leading-snug">{s.pairSummary}</p>
      <p className="text-sm text-muted">{s.reasonForMe}</p>
      <StartWith question={s.questionForMe} />
      <BasedOn basedOn={s.basedOn} other={other} source={source} />
      {open ? (
        <p className="text-sm font-semibold text-primary-ink">
          {open.status === "proposed" && open.fromId !== other.id
            ? `Waiting for ${first(other)} to say yes.`
            : `You have a 10-min chat with ${first(other)}. See it above.`}
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            icon="clock"
            className="whitespace-nowrap px-4 text-sm"
            onClick={() => dispatch({ type: "proposeMatch", userId: other.id })}
          >
            Suggest a 10-min chat
          </Button>
          <Button
            variant="secondary"
            className="whitespace-nowrap px-4 text-sm"
            onClick={() => dispatch({ type: "dismissMatch", userId: other.id })}
          >
            Not now
          </Button>
        </div>
      )}
    </article>
  );
}

// Explore → People: "AI matches" in place of "Picked for you".
export function AiMatches() {
  const { state, me, dispatch, navigate } = useApp();
  const hasInput = !!(me?.learnToday || me?.canShare);
  const learn = me?.learnToday;
  const share = me?.canShare;

  // Ask once per input; the server reuses the saved result when nothing changed.
  useEffect(() => {
    if (hasInput) dispatch({ type: "findMatches", refresh: false });
  }, [hasInput, learn, share, dispatch]);

  if (!me) return null;
  const items = (state.aiMatches?.items ?? []).filter((s) => state.users.some((u) => u.id === s.userId));

  return (
    <section>
      <div className="mb-3 mt-7 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold">
          <Icon name="sparkle" size={18} />
          AI matches
        </h2>
        {hasInput && (
          <PillButton
            icon="refresh"
            disabled={state.matchLoading}
            onClick={() => dispatch({ type: "findMatches", refresh: true })}
          >
            {state.matchLoading ? "Finding…" : "Find new matches"}
          </PillButton>
        )}
      </div>

      {!hasInput ? (
        <button
          onClick={() => navigate({ name: "matchInput" })}
          className="flex w-full items-start gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-primary-soft p-4 text-left transition duration-150 hover:border-primary active:scale-[0.99]"
        >
          <span className="text-primary-ink">
            <Icon name="sparkle" size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-primary-ink">Tell Spot what you want to learn today to get AI matches.</span>
            <span className="mt-0.5 block text-sm text-muted">Takes a few seconds. Optional.</span>
          </span>
          <Icon name="arrow" size={18} />
        </button>
      ) : state.matchLoading && !state.aiMatches ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Finding people for you…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          No strong matches right now. Try again later, or add more to what you want to learn.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SuggestionCard key={s.userId} s={s} source={state.aiMatches!.source} />
          ))}
        </div>
      )}
    </section>
  );
}

function Countdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  return (
    <span className="font-black tabular-nums">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

// One 10-minute chat from my side: someone's suggestion to me, our agreed
// chat, the running timer, or "Time's up".
function MatchCard({ m }: { m: Match }) {
  const { state, me, dispatch } = useApp();
  if (!me) return null;
  const mineToSend = m.fromId === me.id;
  const other = state.users.find((u) => u.id === (mineToSend ? m.toId : m.fromId));
  if (!other) return null;
  const myQuestion = mineToSend ? m.questionForFrom : m.questionForTo;
  const reason = mineToSend ? m.reasonForFrom : m.reasonForTo;
  const zone = state.zones.find((z) => z.id === m.meetZoneId);

  if (m.status === "proposed") {
    if (mineToSend) return null; // shown on the AI match itself
    return (
      <article className="space-y-3 rounded-2xl border-2 border-primary bg-primary-soft p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-primary-ink">
          <Icon name="sparkle" size={14} />
          Spot thinks you two should talk
        </p>
        <div className="rounded-xl bg-surface p-3">
          <PersonLine person={other} />
        </div>
        <p className="font-semibold leading-snug">{m.pairSummary}</p>
        <p className="text-sm text-muted">{reason}</p>
        <StartWith question={myQuestion} />
        <BasedOn basedOn={m.basedOn} other={other} flip source={m.source} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button icon="check" onClick={() => dispatch({ type: "respondMatch", matchId: m.id, accept: true })}>
            Yes, 10 min
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "respondMatch", matchId: m.id, accept: false })}>
            Not now
          </Button>
        </div>
      </article>
    );
  }

  if (m.status === "done") {
    return (
      <article className="space-y-3 rounded-2xl border-2 border-soon bg-soon-soft p-4">
        <p className="font-extrabold text-soon-ink">Time&apos;s up. Keep talking or wrap up?</p>
        <p className="text-sm">Your 10 minutes with {other.name} are over.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button icon="check" onClick={() => dispatch({ type: "wrapUpMatch", matchId: m.id, free: true })}>
            I&apos;m free again
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "wrapUpMatch", matchId: m.id, free: false })}>
            Keep talking
          </Button>
        </div>
      </article>
    );
  }

  // Accepted or started.
  return (
    <article className="space-y-3 rounded-2xl border-2 border-go bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-go-ink">
          {m.status === "started" ? "10-min chat in progress" : "You're both in for 10 minutes"}
        </p>
        {m.status === "started" && m.endsAt && (
          <span className="rounded-full bg-go px-3 py-1 text-lg text-white">
            <Countdown endsAt={m.endsAt} />
          </span>
        )}
      </div>
      <PersonLine person={other} />
      <div className="grid gap-2 rounded-xl bg-surface-2 p-3 text-sm">
        {zone && (
          <p>
            <span className="font-bold">Meet at {zone.name}</span>
            <span className="block text-xs text-muted">{zone.landmark}</span>
          </p>
        )}
        <p>
          Look for <span className="font-semibold">{other.outfit}</span>
        </p>
        <p className="text-xs text-muted">
          {first(other)} will look for <span className="font-semibold text-ink">{me.outfit}</span>
        </p>
      </div>
      <StartWith question={myQuestion} />
      {m.status === "accepted" && (
        <Button block icon="clock" onClick={() => dispatch({ type: "startMatch", matchId: m.id })}>
          Start 10-min chat
        </Button>
      )}
    </article>
  );
}

// Chats suggested to me, agreed, running or just finished. Empty when there are none.
export function MatchInbox({ title }: { title?: string }) {
  const { state, me } = useApp();
  if (!me) return null;
  const shown = state.matches.filter((m) => !(m.status === "proposed" && m.fromId === me.id));
  if (shown.length === 0) return null;
  return (
    <section className={title ? "" : "mb-4"}>
      {title && <h2 className="mb-3 mt-7 text-base font-extrabold">{title}</h2>}
      <div className="space-y-3">
        {shown.map((m) => (
          <MatchCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}
