"use client";

import { useMemo, useState } from "react";
import { localRecommendations } from "@/lib/recommend";
import { useApp } from "@/lib/store";
import { YourPeople } from "../Connections";
import { minutesUntil } from "@/lib/time";
import { Avatar, Chip, PanelCard, PillButton, SectionTitle, StatusPill, ZoneBadge } from "../ui";
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
    .filter((u) => minutesUntil(u.leavingAt!, state.now) <= 30)
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
          const mins = minutesUntil(p.leavingAt!, state.now);
          return (
            <li key={p.id} className="border-t border-white/10">
              <button
                onClick={() => navigate({ name: "panelDetail", panelId: p.id })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {zone ? <ZoneMark code={zone.code} size={32} /> : <span className="w-[26px]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-board-dim">
                    {zone?.name}, look for {p.outfit}
                  </span>
                </span>
                <span className="text-right font-black tabular-nums text-board-text">
                  <span className="text-2xl">{mins}</span>
                  <span className="ml-0.5 text-xs">min</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Explore → People: my connections, leaving soon, picks, and every speaker.
export function ExplorePeople() {
  const { state, me, navigate, dispatch } = useApp();
  const [filter, setFilter] = useState<string>("All");

  const panels = useMemo(
    () => state.users.filter((u) => u.role === "panel" && u.visible && u.id !== me?.id),
    [state.users, me?.id],
  );
  const recs = useMemo(() => (me ? localRecommendations(me, panels, state.zones) : []), [me, panels, state.zones]);

  if (!me) return null;

  const filters = ["All", "Free now", ...me.interests];
  const shown = panels
    .filter((p) =>
      filter === "All" ? true : filter === "Free now" ? p.status === "available" : p.interests.includes(filter),
    )
    .sort((a, b) => {
      const rank = { available: 0, leaving: 1, talking: 2 } as const;
      return rank[a.status] - rank[b.status];
    });

  const open = (panelId: string, fromRec = false) => {
    if (fromRec) dispatch({ type: "log", activityType: "click_recommendation", targetId: panelId });
    navigate({ name: "panelDetail", panelId });
  };

  return (
    <div>
      <YourPeople />
      <MyBar />
      <LeavingBoard />

      <SectionTitle aside="Based on your interests">Picked for you</SectionTitle>
      {recs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          No strong matches free right now. Add more interests in Me, or browse everyone below.
        </p>
      ) : (
        <div className="space-y-3">
          {recs.map((r) => {
            const p = panels.find((x) => x.id === r.panelId)!;
            const zone = state.zones.find((z) => z.id === p.zoneId);
            return (
              <button
                key={r.panelId}
                onClick={() => open(p.id, true)}
                className="w-full rounded-2xl border-2 border-primary bg-surface p-4 text-left transition duration-150 hover:shadow-md active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <Avatar user={p} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold">{p.name}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <StatusPill user={p} now={state.now} />
                      <ZoneBadge zone={zone} />
                    </span>
                  </span>
                </span>
                <span className="mt-3 block text-sm leading-relaxed">{r.reason}</span>
              </button>
            );
          })}
        </div>
      )}

      <SectionTitle aside={`${panels.length} sharing today`}>Everyone</SectionTitle>
      <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {filters.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </div>
      <div className="space-y-3">
        {shown.map((p) => (
          <PanelCard key={p.id} panel={p} onOpen={() => open(p.id)} />
        ))}
        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
            No one matches this filter right now. Try All.
          </p>
        )}
      </div>
    </div>
  );
}
