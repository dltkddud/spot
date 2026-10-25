"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { YourPeople } from "../Connections";
import { AiMatches } from "../Matches";
import { LEAVE_WARNING_MIN, timeLeft } from "@/lib/time";
import { Chip, PanelCard, PillButton, SectionTitle, ZoneBadge } from "../ui";
import { ZoneMark } from "../ZoneIcon";

export function MyBar() {
  const { state, me, navigate } = useApp();
  if (!me) return null;
  const zone = state.zones.find((z) => z.id === me.zoneId);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">You&apos;re at</p>
        <div className="mt-1">
          <ZoneBadge zone={zone} />
        </div>
      </div>
      <PillButton icon="pin" onClick={() => navigate({ name: "zonePicker" })}>
        I moved
      </PillButton>
    </div>
  );
}

function LeavingBoard() {
  const { state, navigate } = useApp();
  const rows = state.users
    .filter((u) => u.role === "panel" && u.visible && u.status === "leaving" && u.leavingAt)
    .filter((u) => u.leavingAt! > state.now && u.leavingAt! - state.now <= 30 * 60_000)
    .sort((a, b) => a.leavingAt! - b.leavingAt!);
  if (rows.length === 0) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl bg-board text-white">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-base font-extrabold">Leaving soon</h2>
        <span className="text-xs text-board-dim">Catch them before they go</span>
      </div>
      <ul>
        {rows.map((p) => {
          const zone = state.zones.find((z) => z.id === p.zoneId);
          const left = timeLeft(p.leavingAt!, state.now);
          const soon = left.unit === "sec" || left.value <= LEAVE_WARNING_MIN;
          return (
            <li key={p.id} className="border-t border-white/10">
              <button
                onClick={() => navigate({ name: "panelDetail", panelId: p.id })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {zone ? <ZoneMark zone={zone} size={32} /> : <span className="w-[26px]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-board-dim">
                    {zone?.name}, look for {p.outfit}
                  </span>
                </span>
                <span className={`text-right font-black tabular-nums ${soon ? "text-soon" : "text-board-text"}`}>
                  <span className="text-2xl">{left.value}</span>
                  <span className="ml-0.5 text-xs">{left.unit}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Speakers or guests at this event, with the same filters and cards.
function PeopleList({ role }: { role: "panel" | "attendee" }) {
  const { state, me, navigate } = useApp();
  const [filter, setFilter] = useState<string>("All");

  const people = useMemo(
    () => state.users.filter((u) => u.role === role && u.visible && u.id !== me?.id),
    [state.users, role, me?.id],
  );

  if (!me) return null;

  const filters = ["All", "Free now", ...me.interests];
  const shown = people
    .filter((p) =>
      filter === "All" ? true : filter === "Free now" ? p.status === "available" : p.interests.includes(filter),
    )
    .sort((a, b) => {
      const rank = { available: 0, leaving: 1, talking: 2 } as const;
      return rank[a.status] - rank[b.status];
    });
  const what = role === "panel" ? "speakers" : "guests";

  return (
    <>
      <SectionTitle aside={`${people.length} sharing today`}>{role === "panel" ? "Speakers" : "Guests"}</SectionTitle>
      <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {filters.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
      <div className="space-y-3">
        {shown.map((p) => (
          <PanelCard key={p.id} panel={p} onOpen={() => navigate({ name: "panelDetail", panelId: p.id })} />
        ))}
        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            {people.length === 0
              ? `No ${what} are sharing their zone at ${state.event.name} yet. They'll show up here as soon as they join.`
              : "No one matches this filter right now. Try All."}
          </p>
        )}
      </div>
    </>
  );
}

// Explore → People: where I am, who's leaving, every speaker and guest,
// then connections and AI matches.
export function ExplorePeople() {
  const { me } = useApp();
  if (!me) return null;

  return (
    <div>
      <MyBar />
      <LeavingBoard />

      <PeopleList role="panel" />
      <PeopleList role="attendee" />

      <div className="mt-7">
        <YourPeople />
      </div>
      <AiMatches />
    </div>
  );
}
