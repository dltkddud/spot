"use client";

import { useState } from "react";
import { INTEREST_OPTIONS, OUTFIT_WORD_LIMIT } from "@/lib/mockData";
import { useApp } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Button, Chip, Field, Header, inputClass } from "../ui";

const MAX_INTERESTS = 5;

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function Onboarding() {
  const { dispatch, back } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [talkTitle, setTalkTitle] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [outfit, setOutfit] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [visible, setVisible] = useState(true);

  const outfitWords = wordCount(outfit);
  const canFinish =
    name.trim() && headline.trim() && interests.length > 0 && outfitWords > 0 && outfitWords <= OUTFIT_WORD_LIMIT;

  const toggleInterest = (i: string) =>
    setInterests((cur) =>
      cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < MAX_INTERESTS ? [...cur, i] : cur,
    );

  if (step === 1) {
    return (
      <>
        <Header title="Join the event" onBack={back} />
        <main className="px-5 pb-10 pt-6">
          <h2 className="text-2xl font-black">How are you here today?</h2>
          <p className="mt-2 text-muted">You can change this later.</p>

          <div className="mt-6 space-y-3">
            {(
              [
                {
                  value: "panel",
                  title: "I'm sharing something",
                  body: "You gave a talk, sit on a panel, or are showing a product. People can find you and line up to talk.",
                },
                {
                  value: "attendee",
                  title: "I'm here to meet people",
                  body: "You want to ask questions and talk with speakers and makers before they leave.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRole(opt.value)}
                aria-pressed={role === opt.value}
                className={`w-full rounded-2xl border-2 p-5 text-left transition ${
                  role === opt.value ? "border-ink bg-surface" : "border-line bg-surface"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-lg font-extrabold">{opt.title}</span>
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full border-2 ${
                      role === opt.value ? "border-ink bg-ink" : "border-line"
                    }`}
                  >
                    {role === opt.value && <span className="h-2 w-2 rounded-full bg-surface" />}
                  </span>
                </span>
                <span className="mt-1.5 block text-sm text-muted">{opt.body}</span>
              </button>
            ))}
          </div>

          <Button block className="mt-8" disabled={!role} onClick={() => setStep(2)}>
            Continue
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Your profile" onBack={() => setStep(1)} />
      <main className="space-y-6 px-5 pb-12 pt-6">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jiwoo Park" />
        </Field>

        <Field
          label="One line about you"
          hint={role === "panel" ? "What you work on or what you're showing." : "What you're working on or curious about."}
        >
          <input
            className={inputClass}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={70}
            placeholder={role === "panel" ? "Founder building voice tools for students" : "CS student building a networking app"}
          />
        </Field>

        {role === "panel" && (
          <Field label="Talk or product title" hint="Optional. Helps people recognize you from the stage.">
            <input
              className={inputClass}
              value={talkTitle}
              onChange={(e) => setTalkTitle(e.target.value)}
              placeholder="Shipping voice agents that don't interrupt you"
            />
          </Field>
        )}

        <div>
          <p className="mb-1.5 text-sm font-bold">Interests</p>
          <p className="mb-3 text-xs text-muted">
            Pick up to {MAX_INTERESTS}. Used to suggest who to talk to.
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((i) => (
              <Chip key={i} selected={interests.includes(i)} onClick={() => toggleInterest(i)}>
                {i}
              </Chip>
            ))}
          </div>
        </div>

        <Field
          label="What you're wearing today"
          hint={
            <span className={outfitWords > OUTFIT_WORD_LIMIT ? "font-bold text-busy-ink" : ""}>
              {outfitWords}/{OUTFIT_WORD_LIMIT} words. Clothes and accessories only, so others can spot you.
            </span>
          }
        >
          <input
            className={inputClass}
            value={outfit}
            onChange={(e) => setOutfit(e.target.value)}
            placeholder="navy hoodie, white cap"
          />
        </Field>

        <Field label="Contact link" hint="Optional. LinkedIn, personal site, or email, shared only after you meet.">
          <input
            className={inputClass}
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            inputMode="url"
            placeholder="linkedin.com/in/yourname"
          />
        </Field>

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--ink)]"
          />
          <span>
            <span className="block font-bold">Show me on the event map</span>
            <span className="mt-0.5 block text-sm text-muted">
              Others see your zone, status, and outfit. You can hide anytime. All of it is deleted when the event ends.
            </span>
          </span>
        </label>

        <Button
          block
          disabled={!canFinish}
          onClick={() =>
            role &&
            dispatch({
              type: "completeOnboarding",
              profile: {
                name: name.trim(),
                role,
                headline: headline.trim(),
                talkTitle: talkTitle.trim() || undefined,
                interests,
                outfit: outfit.trim(),
                contactUrl: contactUrl.trim() || undefined,
                visible,
              },
            })
          }
        >
          Choose my zone
        </Button>
      </main>
    </>
  );
}
