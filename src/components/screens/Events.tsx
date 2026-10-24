"use client";

import { useApp } from "@/lib/store";
import { eventDates } from "@/lib/time";
import { Header, Icon, RoleBadge } from "../ui";

// Every event, with my role at the ones I've joined. Tapping one goes in.
export function Events() {
  const { state, dispatch, back } = useApp();

  return (
    <>
      <Header title="Events" onBack={state.stack.length > 1 ? back : undefined} />
      <main className="px-5 pb-12 pt-5">
        <p className="text-muted">Pick an event to see who&apos;s there. You choose how you&apos;re there at each one.</p>
        <div className="mt-5 space-y-3">
          {state.events.map((e) => {
            const mine = state.participations.find((p) => p.eventId === e.id);
            const live = (e.startsAt ?? 0) <= state.now && state.now < e.endsAt;
            const ended = state.now >= e.endsAt;
            const current = e.id === state.event.id && !!mine;
            return (
              <button
                key={e.id}
                onClick={() => dispatch({ type: "enterEvent", eventId: e.id })}
                className={`w-full rounded-2xl border-2 bg-surface p-4 text-left transition duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.99] ${
                  current ? "border-primary" : "border-line"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-lg font-extrabold leading-tight">{e.name}</span>
                    <span className="mt-1 block text-sm text-muted">{eventDates(e.startsAt, e.endsAt)}</span>
                    <span className="block text-sm text-muted">{e.venue}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      live ? "bg-go-soft text-go-ink" : ended ? "bg-surface-2 text-muted" : "bg-primary-soft text-primary-ink"
                    }`}
                  >
                    {live ? "Live now" : ended ? "Ended" : "Upcoming"}
                  </span>
                </span>
                <span className="mt-3 flex items-center justify-between gap-2">
                  {mine ? (
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
                      You&apos;re in as <RoleBadge role={mine.role} />
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-muted">Not joined yet</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary-ink">
                    {mine ? "Open" : "Join"}
                    <Icon name="arrow" size={16} />
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
