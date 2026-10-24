"use client";

import { sharedInterests } from "@/lib/recommend";
import { useApp } from "@/lib/store";
import { isStale, minutesAgo } from "@/lib/time";
import type { User } from "@/lib/types";
import { CrowdLegend, FloorPlan, ZoneGlyph } from "../FloorPlan";
import { Avatar, Button, CrowdBadge, Header, PinMark, StatusPill, StillHereAsk } from "../ui";
import { ZonePreview } from "./ZonePicker";

export function Zones() {
  const { state, me, navigate } = useApp();
  if (!me) return null;
  const open = (zoneId: string) => navigate({ name: "zoneDetail", zoneId });

  return (
    <>
      <Header title="Zones" />
      <main className="px-5 pb-28 pt-5">
        <p className="text-sm text-muted">Tap a zone to see who&apos;s there. Orange zones are the busiest right now.</p>
        <div className="mt-4">
          <FloorPlan zones={state.zones} activity={state.zoneActivity} myZoneId={me.zoneId} onSelect={open} />
        </div>
        <div className="mt-2">
          <CrowdLegend />
        </div>

        <div className="mt-5 space-y-3">
          {state.zones.map((z) => {
            const people = state.users.filter((u) => u.visible && u.zoneId === z.id);
            const panels = people.filter((u) => u.role === "panel");
            const free = panels.filter((p) => p.status === "available").length;
            const isMine = me.zoneId === z.id;
            return (
              <button
                key={z.id}
                onClick={() => open(z.id)}
                className={`flex w-full items-center gap-4 rounded-2xl border bg-surface p-4 text-left transition duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.99] ${
                  isMine ? "border-primary" : "border-line"
                }`}
              >
                <PinMark size={44}>{z.code}</PinMark>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-extrabold">{z.name}</span>
                    {isMine && <span className="text-xs font-bold text-primary-ink">You&apos;re here</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{z.landmark}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <CrowdBadge level={state.zoneActivity[z.id] ?? "quiet"} />
                    {panels.slice(0, 3).map((p) => (
                      <Avatar key={p.id} user={p} size={24} />
                    ))}
                    <span className="text-xs font-semibold text-muted">
                      {panels.length === 0
                        ? "No speakers"
                        : `${panels.length} speaker${panels.length > 1 ? "s" : ""}, ${free} free`}
                      {people.length - panels.length > 0 &&
                        `, ${people.length - panels.length} attendee${people.length - panels.length > 1 ? "s" : ""}`}
                    </span>
                  </span>
                </span>
                <span className="text-primary-ink">
                  <ZoneGlyph code={z.code} size={22} />
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}

function conversationStarter(person: User, me: User) {
  if (person.talkTitle) return `Ask about “${person.talkTitle}”`;
  const shared = sharedInterests(me, person);
  if (shared.length > 0) return `You both like ${shared.slice(0, 2).join(" and ")}. Start there.`;
  if (person.interests[0]) return `Ask what got them into ${person.interests[0]}.`;
  return undefined;
}

function PersonCard({ person }: { person: User }) {
  const { state, me, navigate } = useApp();
  if (!me) return null;
  const stale = isStale(person.updatedAt, state.now);
  const shared = sharedInterests(me, person);
  const starter = conversationStarter(person, me);

  return (
    <article className="flex w-[85%] max-w-[360px] shrink-0 snap-center flex-col rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar user={person} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold leading-tight">{person.name}</p>
          <p className="mt-0.5 text-xs font-bold text-primary-ink">
            {person.role === "panel" ? "Speaker or maker" : "Attendee"}
          </p>
          <div className="mt-1.5">
            <StatusPill user={person} now={state.now} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm">{person.headline}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {person.interests.map((i) => (
          <span
            key={i}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              shared.includes(i) ? "bg-primary text-on-primary" : "border border-line"
            }`}
          >
            {i}
          </span>
        ))}
      </div>

      {starter && (
        <div className="mt-3 rounded-2xl bg-surface-2 p-3">
          <p className="text-xs font-bold text-muted">Conversation starter</p>
          <p className="mt-0.5 text-sm font-semibold">{starter}</p>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Look for <span className="font-semibold text-ink">{person.outfit}</span>
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <span className={`text-xs ${stale ? "font-bold text-busy-ink" : "text-muted"}`}>
          Updated {minutesAgo(person.updatedAt, state.now)}
        </span>
        <StillHereAsk user={person} />
      </div>

      {person.role === "panel" && (
        <Button
          block
          variant="secondary"
          icon="arrow"
          className="mt-3"
          onClick={() => navigate({ name: "panelDetail", panelId: person.id })}
        >
          See profile
        </Button>
      )}
    </article>
  );
}

export function ZoneDetail({ zoneId }: { zoneId: string }) {
  const { state, me, back } = useApp();
  const zone = state.zones.find((z) => z.id === zoneId);
  if (!zone || !me) return null;

  const people = state.users
    .filter((u) => u.visible && u.zoneId === zone.id && u.id !== me.id)
    .sort((a, b) => (a.role === b.role ? b.updatedAt - a.updatedAt : a.role === "panel" ? -1 : 1));

  return (
    <>
      <Header title={`${zone.code}  ${zone.name}`} onBack={back} />
      <main className="px-5 pb-28 pt-5">
        <ZonePreview zone={zone} here={people.length} />

        <div className="mb-3 mt-7 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-extrabold">People here</h2>
          {people.length > 1 && <span className="text-xs text-muted">Swipe to see all {people.length}</span>}
        </div>
        {people.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            No one is sharing this zone right now.
          </p>
        ) : (
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
            {people.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
