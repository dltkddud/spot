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
  RolePicker,
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
  const [confirming, setConfirming] = useState(false);
  if (!profile || !me) return null;

  // Speaker → guest closes the line, so check first if anyone is in it.
  const inLine = state.requests.filter(
    (r) => r.panelId === me.id && (r.status === "waiting" || r.status === "accepted"),
  ).length;
  const closesLine = me.role === "panel" && here.role === "attendee" && inLine > 0;

  const save = () => {
    if (closesLine && !confirming) {
      setConfirming(true);
      return;
    }
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
        <RolePicker
          role={here.role}
          onChange={(role) => {
            setHere({ ...here, role });
            setConfirming(false);
          }}
        />
        <div className="mt-6">
          <EventFields value={here} onChange={setHere} />
        </div>
        <div className="mt-6">
          <MatchInputFields value={match} onChange={setMatch} />
        </div>

        {confirming ? (
          <section className="mt-8 rounded-2xl border-2 border-soon bg-soon-soft p-4">
            <p className="font-extrabold text-soon-ink">
              {inLine} {inLine === 1 ? "person is" : "people are"} in your line
            </p>
            <p className="mt-1 text-sm">
              If you switch to guest, your line closes as if you&apos;d left. They&apos;ll see your LinkedIn and a
              message they can send you.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="px-3 text-sm" onClick={() => setConfirming(false)}>
                Keep my line
              </Button>
              <Button className="px-3 text-sm" disabled={!profileReady(draft) || !eventReady(here)} onClick={save}>
                Switch and save
              </Button>
            </div>
          </section>
        ) : (
          <Button block icon="check" className="mt-8" disabled={!profileReady(draft) || !eventReady(here)} onClick={save}>
            Save
          </Button>
        )}
      </main>
    </>
  );
}
