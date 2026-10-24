"use client";

import type { ReactNode } from "react";
import { positionInQueue, useApp } from "@/lib/store";
import { minutesAgo } from "@/lib/time";
import type { ChatRequest } from "@/lib/types";
import { Avatar, Button, Header, SectionTitle, StatusPill, ZoneBadge } from "../ui";

const pastLabel: Record<string, string> = {
  met: "You met",
  missed: "Left before you met",
  declined: "Couldn't fit you in",
  cancelled: "You cancelled",
};

function Row({ r, children }: { r: ChatRequest; children?: ReactNode }) {
  const { state, navigate } = useApp();
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
      {children}
    </div>
  );
}

export function MyRequests() {
  const { state, me, dispatch } = useApp();
  if (!me) return null;

  const mine = state.requests.filter((r) => r.attendeeId === me.id).sort((a, b) => b.createdAt - a.createdAt);
  const ready = mine.filter((r) => r.status === "accepted");
  const waiting = mine.filter((r) => r.status === "waiting");
  const past = mine.filter((r) => !["accepted", "waiting"].includes(r.status));

  return (
    <>
      <Header title="My requests" />
      <main className="px-5 pb-28 pt-2">
        {mine.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="font-extrabold">No requests yet</p>
            <p className="mt-1 text-sm text-muted">Open someone from Discover and tap Request to chat.</p>
            <Button className="mt-4" onClick={() => dispatch({ type: "resetTo", screen: { name: "discover" } })}>
              Go to Discover
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
                    <span className="text-sm text-muted">
                      You&apos;re <span className="text-xl font-black text-ink">#{positionInQueue(state.requests, r)}</span> in line
                    </span>
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

        {past.length > 0 && (
          <>
            <SectionTitle>Earlier</SectionTitle>
            <div className="space-y-3">
              {past.map((r) => {
                const p = state.users.find((u) => u.id === r.panelId);
                return (
                  <Row key={r.id} r={r}>
                    <p className="mt-3 text-sm font-semibold text-muted">{pastLabel[r.status]}</p>
                    {r.status === "missed" && p?.contactUrl && (
                      <a
                        href={p.contactUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-bold underline underline-offset-4"
                      >
                        Open {p.name.split(" ")[0]}&apos;s contact link
                      </a>
                    )}
                  </Row>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
