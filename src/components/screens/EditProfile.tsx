"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button, Header, SectionTitle } from "../ui";
import {
  EventFields,
  eventReady,
  MatchInputFields,
  ProfileFields,
  profileReady,
  toProfileInput,
  type EventDraft,
  type MatchDraft,
  type ProfileDraft,
} from "./Onboarding";

// Me → Edit profile: who I am everywhere, and how I'm at this event.
export function EditProfile() {
  const { state, me, dispatch, back } = useApp();
  const profile = state.profile;
  const [draft, setDraft] = useState<ProfileDraft>({
    name: profile?.name ?? "",
    headline: profile?.headline ?? "",
    interests: profile?.interests ?? [],
    linkedinUrl: profile?.linkedinUrl ?? "",
    contactUrl: profile?.contactUrl ?? "",
  });
  const [here, setHere] = useState<EventDraft>({
    role: me?.role ?? null,
    talkTitle: me?.talkTitle ?? "",
    outfit: me?.outfit ?? "",
  });
  const [match, setMatch] = useState<MatchDraft>({ learnToday: me?.learnToday ?? "", canShare: me?.canShare ?? "" });
  if (!profile || !me) return null;

  const save = () => {
    if (!here.role) return;
    dispatch({
      type: "saveProfile",
      profile: toProfileInput(draft),
      here: {
        role: here.role,
        talkTitle: here.talkTitle.trim() || undefined,
        outfit: here.outfit.trim(),
        learnToday: match.learnToday,
        canShare: match.canShare,
      },
    });
  };

  return (
    <>
      <Header title="Edit profile" onBack={back} />
      <main className="px-5 pb-28 pt-2">
        <SectionTitle aside="Shown at every event">About you</SectionTitle>
        <ProfileFields value={draft} onChange={setDraft} />

        <SectionTitle aside="Only this event">At {state.event.name}</SectionTitle>
        {/* The role is set when joining and stays for the whole event. */}
        <p className="rounded-2xl border border-line bg-surface p-4">
          <span className="block font-extrabold">You&apos;re a {me.role === "panel" ? "Speaker" : "Guest"} here</span>
          <span className="mt-1 block text-sm text-muted">Your role stays the same for this whole event.</span>
        </p>
        <div className="mt-6">
          <EventFields value={here} onChange={setHere} />
        </div>
        <div className="mt-6">
          <MatchInputFields value={match} onChange={setMatch} />
        </div>

        <Button block icon="check" className="mt-8" disabled={!profileReady(draft) || !eventReady(here)} onClick={save}>
          Save
        </Button>
      </main>
    </>
  );
}
