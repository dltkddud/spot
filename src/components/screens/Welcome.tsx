"use client";

import { useApp } from "@/lib/store";
import { dayTime } from "@/lib/time";
import { Button, Logo } from "../ui";

export function Welcome() {
  const { state, navigate } = useApp();
  const leaving = state.users.filter((u) => u.role === "panel" && u.status === "leaving" && u.visible).length;
  const free = state.users.filter((u) => u.role === "panel" && u.status === "available" && u.visible).length;

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-16">
      <Logo size="lg" />

      <h1 className="mt-14 text-[2.6rem] font-black leading-[1.02] tracking-tight">
        Find the right person before they leave.
      </h1>
      <p className="mt-4 max-w-[34ch] text-lg text-muted">
        See which zone people are in, whether they are free to talk, and get in line before they head out.
      </p>

      <div className="mt-10 rounded-2xl bg-board p-5 text-white">
        <p className="text-lg font-extrabold">{state.event.name}</p>
        <p className="text-sm text-board-dim">{state.event.venue}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-2xl font-black text-[#5ddc95]">{free}</p>
            <p className="text-board-dim">speakers free now</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-2xl font-black text-board-text">{leaving}</p>
            <p className="text-board-dim">leaving soon</p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10">
        <Button block icon="arrow" onClick={() => navigate({ name: "onboarding" })}>
          Join the event
        </Button>
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Only your zone is shared, never your exact location.
          <br />
          Zones and statuses are deleted when the event ends,{" "}
          <span className="whitespace-nowrap">{dayTime(state.event.endsAt)}</span>.
        </p>
      </div>
    </main>
  );
}
