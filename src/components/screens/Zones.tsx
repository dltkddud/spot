"use client";

import { useApp } from "@/lib/store";
import { Avatar, Header, PanelCard, SectionTitle } from "../ui";

export function Zones() {
  const { state, me, navigate } = useApp();
  if (!me) return null;

  return (
    <>
      <Header title="Zones" />
      <main className="px-5 pb-28 pt-5">
        <p className="text-sm text-muted">Speakers and makers by zone. Green means free to talk right now.</p>
        <div className="mt-4 space-y-3">
          {state.zones.map((z) => {
            const people = state.users.filter((u) => u.visible && u.zoneId === z.id);
            const panels = people.filter((u) => u.role === "panel");
            const free = panels.filter((p) => p.status === "available").length;
            const isMine = me.zoneId === z.id;
            return (
              <button
                key={z.id}
                onClick={() => navigate({ name: "zoneDetail", zoneId: z.id })}
                className={`flex w-full items-center gap-4 rounded-2xl border bg-surface p-4 text-left ${
                  isMine ? "border-ink" : "border-line"
                }`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-ink text-2xl font-black text-surface">
                  {z.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold">
                    {z.name}
                    {isMine && <span className="ml-2 text-xs font-bold text-muted">You&apos;re here</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{z.landmark}</span>
                  <span className="mt-2 flex items-center gap-1.5">
                    {panels.slice(0, 4).map((p) => (
                      <Avatar key={p.id} user={p} size={26} />
                    ))}
                    <span className={`text-xs font-semibold text-muted ${panels.length ? "ml-1" : ""}`}>
                      {panels.length === 0
                        ? "No speakers"
                        : `${panels.length} speaker${panels.length > 1 ? "s" : ""}, ${free} free`}
                      {people.length - panels.length > 0 &&
                        `, ${people.length - panels.length} attendee${people.length - panels.length > 1 ? "s" : ""}`}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}

export function ZoneDetail({ zoneId }: { zoneId: string }) {
  const { state, me, navigate, back } = useApp();
  const zone = state.zones.find((z) => z.id === zoneId);
  if (!zone || !me) return null;

  const people = state.users.filter((u) => u.visible && u.zoneId === zone.id && u.id !== me.id);
  const panels = people.filter((u) => u.role === "panel");
  const attendees = people.filter((u) => u.role === "attendee");

  return (
    <>
      <Header title={`${zone.code}  ${zone.name}`} onBack={back} />
      <main className="px-5 pb-28 pt-5">
        <div className="rounded-2xl bg-board p-4 text-white">
          <p className="text-xs text-board-dim">How to find it</p>
          <p className="mt-1 text-lg font-extrabold">{zone.landmark}</p>
        </div>

        <SectionTitle aside={`${panels.length} here`}>Speakers and makers</SectionTitle>
        <div className="space-y-3">
          {panels.map((p) => (
            <PanelCard key={p.id} panel={p} onOpen={() => navigate({ name: "panelDetail", panelId: p.id })} />
          ))}
          {panels.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
              No speakers in this zone right now.
            </p>
          )}
        </div>

        {attendees.length > 0 && (
          <>
            <SectionTitle aside={`${attendees.length} here`}>Also here</SectionTitle>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {attendees.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-4">
                  <Avatar user={a} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{a.name}</span>
                    <span className="block truncate text-xs text-muted">{a.headline}</span>
                    <span className="block truncate text-xs text-muted">
                      Look for <span className="font-semibold text-ink">{a.outfit}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
