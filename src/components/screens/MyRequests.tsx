"use client";

import type { ReactNode } from "react";
import { sharedInterests } from "@/lib/recommend";
import { positionInQueue, queueFor, useApp } from "@/lib/store";
import { FollowUp } from "../FollowUp";
import { HuddleCard, huddleForRequest, PanelHuddleCard, SuggestedHuddleCard } from "../Huddle";
import { minutesAgo, timeLeftLabel } from "@/lib/time";
import type { ChatRequest, Huddle } from "@/lib/types";
import { Avatar, Button, Header, SectionTitle, StatusPill, ZoneBadge } from "../ui";

function pastLabel(r: ChatRequest) {
  if (r.status === "met") return "You met";
  if (r.status === "cancelled") return "You cancelled";
  if (r.closedBecause === "speaker_left") return "Left before you met";
  return "You didn't get to talk this time";
}

function Row({ r, children }: { r: ChatRequest; children?: ReactNode }) {
  const { state, navigate } = useApp();
  const huddle = huddleForRequest(state.huddles, r);
  const p = state.users.find((u) => u.id === r.panelId);
  if (!p) return null;
  const zone = state.zones.find((z) => z.id === p.zoneId);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <button onClick={() => navigate({ name: "panelDetail", panelId: p.id })} className="flex w-full gap-3 text-left">
        <Avatar user={p} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate font-extrabold">{p.name}</span>
            {p.visible && <StatusPill user={p} now={state.now} />}
          </span>
          {p.visible ? (
            <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <ZoneBadge zone={zone} />
              <span>
                Look for <span className="font-semibold text-ink">{p.outfit}</span>
              </span>
            </span>
          ) : (
            <span className="mt-1 block text-xs text-muted">No longer on the event floor</span>
          )}
        </span>
      </button>
      {huddle && (
        <div className="mt-3">
          <HuddleCard
            huddle={huddle}
            compact={huddle.status !== "proposed" || huddle.members.some((m) => m.requestId === r.id && m.response === "yes")}
          />
        </div>
      )}
      {children}
    </div>
  );
}

// "You're #2 · Dana leaves in 9 min", or "You're #2 in line".
function LinePlace({ r }: { r: ChatRequest }) {
  const { state } = useApp();
  const p = state.users.find((u) => u.id === r.panelId);
  // Guests asked by guests have no line to stand in.
  if (p?.role === "attendee") {
    return <span className="text-sm text-muted">Waiting for {p.name.split(" ")[0]} to accept</span>;
  }
  const leaving = p?.status === "leaving" && p.leavingAt && p.leavingAt > state.now ? p.leavingAt : null;
  return (
    <span className="text-sm text-muted">
      You&apos;re <span className="text-xl font-black text-ink">#{positionInQueue(state.requests, r)}</span>
      {leaving ? (
        <>
          {" · "}
          <span className="font-bold text-soon-ink">
            {p!.name.split(" ")[0]} leaves in <span className="tabular-nums">{timeLeftLabel(leaving, state.now)}</span>
          </span>
        </>
      ) : (
        " in line"
      )}
    </span>
  );
}

// People who asked me for a chat. A speaker's line is numbered and its formed
// huddles show as one card; a guest's requests are simple 1:1s.
function RequestsToMe() {
  const { state, me, dispatch } = useApp();
  if (!me) return null;
  const queue = queueFor(state.requests, me.id);
  if (queue.length === 0) return null;
  const isSpeaker = me.role === "panel";
  const myZone = state.zones.find((z) => z.id === me.zoneId);
  const accepted = queue.filter((r) => r.status === "accepted");
  const waiting = queue.filter((r) => r.status === "waiting");
  const formed = isSpeaker ? state.huddles.filter((h) => h.panelId === me.id && h.status === "formed") : [];
  const ideas = isSpeaker ? state.huddles.filter((h) => h.panelId === me.id && h.status === "suggested") : [];

  // Each formed huddle shows once, in place of its members' requests.
  type Place = { r: ChatRequest; huddle?: undefined } | { huddle: Huddle; requests: ChatRequest[] };
  const places = (list: ChatRequest[]): Place[] => {
    const out: Place[] = [];
    const shown = new Set<string>();
    for (const r of list) {
      const huddle = formed.find((h) => h.id === r.huddleId);
      if (!huddle) out.push({ r });
      else if (!shown.has(huddle.id)) {
        shown.add(huddle.id);
        out.push({ huddle, requests: list.filter((x) => x.huddleId === huddle.id) });
      }
    }
    return out;
  };

  return (
    <>
      <SectionTitle aside={`${queue.length}`}>Requests to you</SectionTitle>
      {isSpeaker && me.requestsPaused && (
        <p className="mb-3 rounded-xl bg-soon-soft p-3 text-sm font-semibold text-soon-ink">
          New requests are paused. People already in line stay in line.
        </p>
      )}
      <div className="space-y-3">
        {ideas.map((h) => (
          <SuggestedHuddleCard key={h.id} huddle={h} />
        ))}

        {places(accepted).map((p) => {
          if (p.huddle) return <PanelHuddleCard key={p.huddle.id} huddle={p.huddle} requests={p.requests} />;
          const r = p.r;
          const a = state.users.find((u) => u.id === r.attendeeId);
          if (!a) return null;
          return (
            <div key={r.id} className="rounded-2xl border-2 border-go bg-surface p-4">
              <p className="text-lg font-black text-go-ink">Stay where you are</p>
              <p className="text-sm text-muted">
                {a.name.split(" ")[0]} is on the way{myZone ? ` to ${myZone.name}` : ""}.
              </p>
              <div className="mt-3 flex items-center gap-3">
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

        {places(waiting).map((p, i) => {
          if (p.huddle) {
            return <PanelHuddleCard key={p.huddle.id} huddle={p.huddle} requests={p.requests} place={i + 1} />;
          }
          const r = p.r;
          const a = state.users.find((u) => u.id === r.attendeeId);
          if (!a) return null;
          const shared = sharedInterests(me, a);
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                {isSpeaker ? (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-on-primary">
                    {i + 1}
                  </span>
                ) : (
                  <Avatar user={a} size={40} />
                )}
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
      </div>
    </>
  );
}

export function MyRequests() {
  const { state, me, dispatch } = useApp();
  if (!me) return null;

  const mine = state.requests.filter((r) => r.attendeeId === me.id).sort((a, b) => b.createdAt - a.createdAt);
  const ready = mine.filter((r) => r.status === "accepted");
  const waiting = mine.filter((r) => r.status === "waiting");
  // Never got the chat: the speaker's LinkedIn and a message to send, near the top.
  const followUps = mine.filter((r) => (r.status === "missed" || r.status === "declined") && r.closedBecause);
  const past = mine.filter((r) => !["accepted", "waiting"].includes(r.status) && !followUps.includes(r));
  const toMe = queueFor(state.requests, me.id).length;

  return (
    <>
      <Header title="Requests" />
      <main className="px-5 pb-28 pt-2">
        <RequestsToMe />

        {mine.length === 0 && toMe === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="font-extrabold">No requests yet</p>
            <p className="mt-1 text-sm text-muted">Open someone in Explore and tap Request to chat.</p>
            <Button className="mt-4" icon="search" onClick={() => dispatch({ type: "resetTo", screen: { name: "explore" } })}>
              Go to Explore
            </Button>
          </div>
        )}

        {ready.length > 0 && (
          <>
            <SectionTitle>Ready for you</SectionTitle>
            <div className="space-y-3">
              {ready.map((r) => (
                <Row key={r.id} r={r}>
                  <div className="mt-3 rounded-xl bg-go-soft p-3 text-sm font-semibold text-go-ink">
                    Accepted {r.acceptedAt ? minutesAgo(r.acceptedAt, state.now) : ""}. Go find them.
                  </div>
                  <Button
                    variant="go"
                    icon="check"
                    block
                    className="mt-3"
                    onClick={() => dispatch({ type: "setRequestStatus", requestId: r.id, status: "met" })}
                  >
                    We met
                  </Button>
                </Row>
              ))}
            </div>
          </>
        )}

        {waiting.length > 0 && (
          <>
            <SectionTitle>In line</SectionTitle>
            <div className="space-y-3">
              {waiting.map((r) => (
                <Row key={r.id} r={r}>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <LinePlace r={r} />
                    <button
                      onClick={() => dispatch({ type: "setRequestStatus", requestId: r.id, status: "cancelled" })}
                      className="text-sm font-bold text-muted underline underline-offset-4"
                    >
                      Cancel
                    </button>
                  </div>
                </Row>
              ))}
            </div>
          </>
        )}

        {followUps.length > 0 && (
          <>
            <SectionTitle>Keep in touch</SectionTitle>
            <div className="space-y-3">
              {followUps.map((r) => (
                <Row key={r.id} r={r}>
                  <p className="mt-3 text-sm font-semibold text-muted">{pastLabel(r)}</p>
                  <FollowUp request={r} speaker={state.users.find((u) => u.id === r.panelId)} />
                </Row>
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <SectionTitle>Earlier</SectionTitle>
            <div className="space-y-3">
              {past.map((r) => (
                <Row key={r.id} r={r}>
                  <p className="mt-3 text-sm font-semibold text-muted">{pastLabel(r)}</p>
                </Row>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
