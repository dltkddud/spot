"use client";

import { useState, type ReactNode } from "react";
import { homeFor, useApp } from "@/lib/store";
import type { Zone } from "@/lib/types";
import { CrowdLegend, FloorPlan, ZoneGlyph } from "../FloorPlan";
import { Button, CrowdBadge, Header, PinMark, SectionTitle } from "../ui";

function peopleHere(n: number) {
  return n === 0 ? "No one here yet" : n === 1 ? "1 person here" : `${n} people here`;
}

// Close-up of one zone: the floor plan zoomed in, its landmark, and how busy it is.
export function ZonePreview({ zone, here, action }: { zone: Zone; here: number; action?: ReactNode }) {
  const { state } = useApp();
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <FloorPlan zones={state.zones} activity={state.zoneActivity} focusId={zone.id} selectedId={zone.id} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
            <ZoneGlyph code={zone.code} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-lg font-extrabold leading-tight">
              <PinMark size={22}>{zone.code}</PinMark>
              {zone.name}
            </p>
            <p className="mt-1 text-sm text-muted">{zone.landmark}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CrowdBadge level={state.zoneActivity[zone.id] ?? "quiet"} />
              <span className="text-xs font-semibold text-muted">{peopleHere(here)}</span>
            </div>
          </div>
        </div>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </section>
  );
}

export function ZonePicker({ fromOnboarding }: { fromOnboarding?: boolean }) {
  const { state, me, dispatch, back } = useApp();
  const [picked, setPicked] = useState(me?.zoneId);
  if (!me) return null;

  const choose = (zoneId: string) => {
    dispatch({ type: "updateMe", patch: { zoneId } });
    if (fromOnboarding) dispatch({ type: "resetTo", screen: homeFor(me.role) });
    else back();
  };
  const hereCount = (zoneId: string) =>
    state.users.filter((u) => u.visible && u.zoneId === zoneId && u.id !== me.id).length;
  const pickedZone = state.zones.find((z) => z.id === picked);

  return (
    <>
      <Header title="Where are you now?" onBack={fromOnboarding ? undefined : back} />
      <main className="px-5 pb-28 pt-5">
        <p className="text-muted">Tap where you&apos;re standing on the floor plan. Use the landmark if you&apos;re not sure.</p>
        <div className="mt-4">
          <FloorPlan
            zones={state.zones}
            activity={state.zoneActivity}
            selectedId={picked}
            myZoneId={me.zoneId}
            onSelect={setPicked}
          />
        </div>
        <div className="mt-2">
          <CrowdLegend />
        </div>

        {pickedZone && (
          <div className="mt-4">
            <ZonePreview
              zone={pickedZone}
              here={hereCount(pickedZone.id)}
              action={
                <Button block icon="pin" onClick={() => choose(pickedZone.id)}>
                  I&apos;m at {pickedZone.name}
                </Button>
              }
            />
          </div>
        )}

        <SectionTitle>All zones</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {state.zones.map((z) => {
            const selected = me.zoneId === z.id;
            return (
              <button
                key={z.id}
                onClick={() => choose(z.id)}
                aria-pressed={selected}
                className={`flex min-h-[148px] flex-col rounded-2xl border-2 p-4 text-left transition duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98] ${
                  selected ? "border-primary bg-primary-soft" : "border-line bg-surface"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <PinMark size={40}>{z.code}</PinMark>
                  <span className="text-primary-ink">
                    <ZoneGlyph code={z.code} size={24} />
                  </span>
                </span>
                <span className="mt-3 text-base font-extrabold leading-tight">{z.name}</span>
                <span className="mt-1 text-xs leading-snug text-muted">{z.landmark}</span>
                <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                  <CrowdBadge level={state.zoneActivity[z.id] ?? "quiet"} />
                </span>
                <span className="mt-1 text-xs font-semibold text-muted">{peopleHere(hereCount(z.id))}</span>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
