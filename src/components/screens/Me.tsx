"use client";

import { useState } from "react";
import { OUTFIT_WORD_LIMIT } from "@/lib/mockData";
import { useApp } from "@/lib/store";
import { dayTime } from "@/lib/time";
import { ConnectWithFriends, ShareWithPicker } from "../Connections";
import { Avatar, Button, Header, inputClass, PillButton, RoleBadge, SectionTitle, StatusPill, ZoneBadge } from "../ui";

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function Me() {
  const { state, me, dispatch, navigate } = useApp();
  const [outfit, setOutfit] = useState(me?.outfit ?? "");
  if (!me) return null;

  const zone = state.zones.find((z) => z.id === me.zoneId);
  const words = wordCount(outfit);
  const outfitChanged = outfit.trim() !== me.outfit;

  const count = (t: string) => state.activity.filter((a) => a.type === t).length;
  const missed = state.requests.filter((r) => r.status === "missed").length;
  const huddlesFormed = state.stats.huddle_formed ?? 0;
  const connectionsMade = state.stats.connection_made ?? 0;
  const stats = [
    { label: "Profile views", value: count("view_panel") },
    { label: "Chat requests", value: count("request_chat") },
    { label: "Accepted", value: count("accept_request") },
    { label: "Met", value: count("mark_met") },
    { label: "Missed", value: missed },
    { label: "AI matches accepted", value: state.stats.match_accepted ?? 0 },
    { label: "Huddles formed", value: huddlesFormed },
    { label: "Connections made", value: connectionsMade },
  ];

  return (
    <>
      <Header title="Me" />
      <main className="px-5 pb-28 pt-5">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar user={me} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold">{me.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <RoleBadge role={me.role} />
                at {state.event.name}
              </p>
            </div>
            <StatusPill user={me} now={state.now} />
          </div>
          <p className="mt-3 text-sm">{me.headline}</p>
          {me.talkTitle && <p className="mt-1 text-sm font-semibold">{me.talkTitle}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {me.interests.map((i) => (
              <span key={i} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
                {i}
              </span>
            ))}
          </div>
          <Button variant="secondary" icon="edit" block className="mt-4" onClick={() => navigate({ name: "editProfile" })}>
            Edit profile
          </Button>
        </section>

        <SectionTitle>Where you are</SectionTitle>
        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
          <ZoneBadge zone={zone} />
          <PillButton icon="pin" onClick={() => navigate({ name: "zonePicker" })}>
            Change zone
          </PillButton>
        </div>

        <SectionTitle aside={`${words}/${OUTFIT_WORD_LIMIT} words`}>What you&apos;re wearing</SectionTitle>
        <div className="flex gap-2">
          <input className={inputClass} value={outfit} onChange={(e) => setOutfit(e.target.value)} />
          <Button
            icon="check"
            disabled={!outfitChanged || words === 0 || words > OUTFIT_WORD_LIMIT}
            onClick={() => dispatch({ type: "updateMe", patch: { outfit: outfit.trim() } })}
          >
            Save
          </Button>
        </div>

        <ConnectWithFriends />

        <SectionTitle>Privacy</SectionTitle>
        <ShareWithPicker />
        {(
          <label className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <input
              type="checkbox"
              role="switch"
              checked={me.openToHuddles !== false}
              onChange={() => dispatch({ type: "updateMe", patch: { openToHuddles: me.openToHuddles === false } })}
              className="mt-1 h-5 w-5 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-bold">Open to huddles</span>
              <span className="mt-0.5 block text-sm text-muted">
                {me.openToHuddles !== false
                  ? "We may suggest meeting a speaker together with people in the same line who share your interests."
                  : "You won't get huddle suggestions."}
              </span>
            </span>
          </label>
        )}
        <p className="mt-3 text-sm text-muted">
          Your zone and status are deleted when {state.event.name} ends,{" "}
          <span className="whitespace-nowrap">{dayTime(state.event.endsAt)}</span>. Your
          basic profile stays so you can use it at the next event.
        </p>

        <SectionTitle aside="Live from this session">Activity</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-2xl font-black tabular-nums">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>

      </main>
    </>
  );
}
