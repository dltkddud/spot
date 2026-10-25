"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import type { MatchSuggestion, User } from "@/lib/types";
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
  const { state, me, dispatch, navigate } = useApp();
  const other = state.users.find((u) => u.id === s.userId);
  if (!other || !me) return null;
  const open = state.requests.find(
    (r) => r.panelId === other.id && r.attendeeId === me.id && (r.status === "waiting" || r.status === "accepted"),
  );
  // Speakers take requests from anyone; guests from other guests.
  const canAsk = other.role === "panel" || me.role === "attendee";
  return (
    <article className="space-y-3 rounded-2xl border-2 border-primary bg-surface p-4">
      <PersonLine person={other} />
      <p className="font-semibold leading-snug">{s.pairSummary}</p>
      <p className="text-sm text-muted">{s.reasonForMe}</p>
      <StartWith question={s.questionForMe} />
      <BasedOn basedOn={s.basedOn} other={other} source={source} />
      {open ? (
        <p className="text-sm font-semibold text-primary-ink">
          {open.status === "accepted" ? `${first(other)} is ready for you. See Requests.` : `You asked ${first(other)} to chat.`}
        </p>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            icon={canAsk ? "chat" : "arrow"}
            className="whitespace-nowrap px-4 text-sm"
            onClick={() => navigate({ name: "panelDetail", panelId: other.id })}
          >
            {canAsk ? "Request to chat" : "View profile"}
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
