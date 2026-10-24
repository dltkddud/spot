"use client";

import { homeFor, useApp } from "@/lib/store";
import { Header } from "../ui";

export function ZonePicker({ fromOnboarding }: { fromOnboarding?: boolean }) {
  const { state, me, dispatch, back } = useApp();
  if (!me) return null;

  const choose = (zoneId: string) => {
    dispatch({ type: "updateMe", patch: { zoneId } });
    if (fromOnboarding) dispatch({ type: "resetTo", screen: homeFor(me.role) });
    else back();
  };

  return (
    <>
      <Header title="Where are you now?" onBack={fromOnboarding ? undefined : back} />
      <main className="px-5 pb-28 pt-5">
        <p className="text-muted">Pick the zone you&apos;re standing in. Use the landmark if you&apos;re not sure.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {state.zones.map((z) => {
            const here = state.users.filter((u) => u.visible && u.zoneId === z.id && u.id !== me.id).length;
            const selected = me.zoneId === z.id;
            return (
              <button
                key={z.id}
                onClick={() => choose(z.id)}
                aria-pressed={selected}
                className={`flex min-h-[148px] flex-col rounded-2xl border-2 p-4 text-left transition active:scale-[0.98] ${
                  selected ? "border-ink bg-surface" : "border-line bg-surface"
                }`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-xl font-black text-surface">
                  {z.code}
                </span>
                <span className="mt-3 text-base font-extrabold leading-tight">{z.name}</span>
                <span className="mt-1 text-xs leading-snug text-muted">{z.landmark}</span>
                <span className="mt-auto pt-2 text-xs font-semibold text-muted">
                  {here === 0 ? "No one here yet" : here === 1 ? "1 person here" : `${here} people here`}
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
