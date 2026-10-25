"use client";

import { useState } from "react";
import { looksLikeLinkedin } from "@/lib/links";
import { INTEREST_OPTIONS, OUTFIT_WORD_LIMIT } from "@/lib/mockData";
import { useApp, type ProfileInput } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Button, Chip, Field, Header, Icon, inputClass } from "../ui";

const MAX_INTERESTS = 5;

export function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export type ProfileDraft = { name: string; headline: string; interests: string[]; linkedinUrl: string; contactUrl: string };

export const emptyProfile: ProfileDraft = { name: "", headline: "", interests: [], linkedinUrl: "", contactUrl: "" };

export function profileReady(p: ProfileDraft) {
  return !!p.name.trim() && !!p.headline.trim() && p.interests.length > 0 && looksLikeLinkedin(p.linkedinUrl);
}

export function toProfileInput(p: ProfileDraft): ProfileInput {
  return {
    name: p.name.trim(),
    headline: p.headline.trim(),
    interests: p.interests,
    linkedinUrl: p.linkedinUrl.trim(),
    contactUrl: p.contactUrl.trim() || undefined,
  };
}

// Required: people a speaker couldn't get to (and speakers I miss) reach me here.
export function LinkedinField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const bad = !!value.trim() && !looksLikeLinkedin(value);
  return (
    <Field
      label="LinkedIn"
      hint={
        <span className={bad ? "font-bold text-busy-ink" : ""}>
          {bad
            ? "Use your profile link, like linkedin.com/in/yourname."
            : "Required, so people you miss can still reach you."}
        </span>
      }
    >
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="url"
        autoComplete="url"
        placeholder="linkedin.com/in/yourname"
      />
    </Field>
  );
}

// Profiles made before LinkedIn was required: add it before anything else.
export function AddLinkedin() {
  const { dispatch } = useApp();
  const [url, setUrl] = useState("");
  return (
    <>
      <Header title="One more thing" />
      <main className="px-5 pb-12 pt-6">
        <h2 className="text-2xl font-black">Add your LinkedIn to continue</h2>
        <p className="mb-6 mt-2 text-muted">
          If a speaker can&apos;t get to you, or you miss them, this is how you&apos;ll still connect.
        </p>
        <LinkedinField value={url} onChange={setUrl} />
        <Button
          block
          icon="check"
          className="mt-8"
          disabled={!looksLikeLinkedin(url)}
          onClick={() => dispatch({ type: "saveLinkedin", linkedinUrl: url.trim() })}
        >
          Save and continue
        </Button>
      </main>
    </>
  );
}

// Who I am at every event: name, one line, interests, LinkedIn, another link.
export function ProfileFields({ value, onChange }: { value: ProfileDraft; onChange: (p: ProfileDraft) => void }) {
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...value, ...patch });
  const toggleInterest = (i: string) =>
    set({
      interests: value.interests.includes(i)
        ? value.interests.filter((x) => x !== i)
        : value.interests.length < MAX_INTERESTS
          ? [...value.interests, i]
          : value.interests,
    });

  return (
    <div className="space-y-6">
      <Field label="Name">
        <input className={inputClass} value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Jiwoo Park" />
      </Field>

      <Field label="One line about you" hint="What you work on, what you're showing, or what you're curious about.">
        <input
          className={inputClass}
          value={value.headline}
          onChange={(e) => set({ headline: e.target.value })}
          maxLength={70}
          placeholder="CS student building a networking app"
        />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-bold">Interests</p>
        <p className="mb-3 text-xs text-muted">Pick up to {MAX_INTERESTS}. Used to suggest who to talk to.</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((i) => (
            <Chip key={i} selected={value.interests.includes(i)} onClick={() => toggleInterest(i)}>
              {i}
            </Chip>
          ))}
        </div>
      </div>

      <LinkedinField value={value.linkedinUrl} onChange={(linkedinUrl) => set({ linkedinUrl })} />

      <Field label="Other link" hint="Optional. Personal site, GitHub, or email.">
        <input
          className={inputClass}
          value={value.contactUrl}
          onChange={(e) => set({ contactUrl: e.target.value })}
          inputMode="url"
          placeholder="github.com/yourname"
        />
      </Field>
    </div>
  );
}

export type EventDraft = { role: Role | null; talkTitle: string; outfit: string };

const roleOptions = [
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
] as const;

export function RolePicker({ role, onChange }: { role: Role | null; onChange: (role: Role) => void }) {
  return (
    <div className="space-y-3">
      {roleOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={role === opt.value}
          className={`w-full rounded-2xl border-2 p-5 text-left transition ${
            role === opt.value ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/50"
          }`}
        >
          <span className="flex items-center justify-between">
            <span className="text-lg font-extrabold">{opt.title}</span>
            <span
              className={`grid h-6 w-6 place-items-center rounded-full border-2 ${
                role === opt.value ? "border-primary bg-primary" : "border-line"
              }`}
            >
              {role === opt.value && <span className="h-2 w-2 rounded-full bg-surface" />}
            </span>
          </span>
          <span className="mt-1.5 block text-sm text-muted">{opt.body}</span>
        </button>
      ))}
    </div>
  );
}

// What's true at this event only: the talk or product (speakers) and today's outfit.
export function EventFields({ value, onChange }: { value: EventDraft; onChange: (e: EventDraft) => void }) {
  const set = (patch: Partial<EventDraft>) => onChange({ ...value, ...patch });
  const words = wordCount(value.outfit);
  return (
    <div className="space-y-6">
      {value.role === "panel" && (
        <Field label="Talk or product title" hint="Optional. Helps people recognize you from the stage.">
          <input
            className={inputClass}
            value={value.talkTitle}
            onChange={(e) => set({ talkTitle: e.target.value })}
            placeholder="Shipping voice agents that don't interrupt you"
          />
        </Field>
      )}
      <Field
        label="What you're wearing today"
        hint={
          <span className={words > OUTFIT_WORD_LIMIT ? "font-bold text-busy-ink" : ""}>
            {words}/{OUTFIT_WORD_LIMIT} words. Clothes and accessories only, so others can spot you.
          </span>
        }
      >
        <input
          className={inputClass}
          value={value.outfit}
          onChange={(e) => set({ outfit: e.target.value })}
          placeholder="navy hoodie, white cap"
        />
      </Field>
    </div>
  );
}

export type MatchDraft = { learnToday: string; canShare: string };

const MATCH_MAX = 140;

// Optional, for AI matching at this event.
export function MatchInputFields({ value, onChange }: { value: MatchDraft; onChange: (m: MatchDraft) => void }) {
  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-xl bg-primary-soft p-3 text-sm font-semibold text-primary-ink">
        <Icon name="sparkle" size={18} />
        It&apos;s optional, but it might find you the best person to talk with!
      </p>
      <Field label="What I want to learn today" hint={`${value.learnToday.length}/${MATCH_MAX}`}>
        <textarea
          className={`${inputClass} min-h-20 resize-none`}
          value={value.learnToday}
          onChange={(e) => onChange({ ...value, learnToday: e.target.value })}
          maxLength={MATCH_MAX}
          rows={2}
          placeholder="How to run user interviews on a tight budget"
        />
      </Field>
      <Field label="What I can share" hint={`${value.canShare.length}/${MATCH_MAX}`}>
        <textarea
          className={`${inputClass} min-h-20 resize-none`}
          value={value.canShare}
          onChange={(e) => onChange({ ...value, canShare: e.target.value })}
          maxLength={MATCH_MAX}
          rows={2}
          placeholder="Lessons from shipping a voice app to 200 users"
        />
      </Field>
    </div>
  );
}

export function eventReady(e: EventDraft) {
  const words = wordCount(e.outfit);
  return !!e.role && words > 0 && words <= OUTFIT_WORD_LIMIT;
}

// Coming back on another browser, or after logging out: LinkedIn finds the profile.
export function LogIn() {
  const { dispatch, back, navigate } = useApp();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const bad = !!linkedinUrl.trim() && !looksLikeLinkedin(linkedinUrl);
  return (
    <>
      <Header title="Log in" onBack={back} />
      <main className="px-5 pb-12 pt-6">
        <p className="mb-6 text-muted">Enter the LinkedIn you used when you made your profile.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (looksLikeLinkedin(linkedinUrl)) dispatch({ type: "logIn", linkedinUrl: linkedinUrl.trim() });
          }}
        >
          <Field
            label="LinkedIn"
            hint={bad && <span className="font-bold text-busy-ink">That doesn&apos;t look like a LinkedIn link (linkedin.com/in/…).</span>}
          >
            <input
              className={inputClass}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              inputMode="url"
              autoFocus
              placeholder="linkedin.com/in/yourname"
            />
          </Field>
          <Button type="submit" block icon="arrow" className="mt-8" disabled={!looksLikeLinkedin(linkedinUrl)}>
            Log in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          New to Spot?{" "}
          <button
            onClick={() => navigate({ name: "profileSetup" }, true)}
            className="font-bold text-primary-ink underline underline-offset-2"
          >
            Make a profile
          </button>
        </p>
      </main>
    </>
  );
}

// First run, once: the profile every event will share.
export function ProfileSetup() {
  const { dispatch, back } = useApp();
  const [draft, setDraft] = useState<ProfileDraft>(emptyProfile);
  return (
    <>
      <Header title="Your profile" onBack={back} />
      <main className="px-5 pb-12 pt-6">
        <p className="mb-6 text-muted">You make this once. It comes with you to every event.</p>
        <ProfileFields value={draft} onChange={setDraft} />
        <Button
          block
          icon="arrow"
          className="mt-8"
          disabled={!profileReady(draft)}
          onClick={() => dispatch({ type: "createProfile", profile: toProfileInput(draft) })}
        >
          Find an event
        </Button>
      </main>
    </>
  );
}

// Joining an event: speaker or guest here, then the talk title and today's outfit.
export function JoinEvent({ eventId }: { eventId: string }) {
  const { state, dispatch, back } = useApp();
  const event = state.events.find((e) => e.id === eventId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<EventDraft>({ role: null, talkTitle: "", outfit: "" });
  const [match, setMatch] = useState<MatchDraft>({ learnToday: "", canShare: "" });
  const [visible, setVisible] = useState(true);

  if (step === 1) {
    return (
      <>
        <Header title={event?.name ?? "Join the event"} onBack={back} />
        <main className="px-5 pb-10 pt-6">
          <h2 className="text-2xl font-black">How are you here at this event?</h2>
          <p className="mt-2 text-muted">It can be different at every event. You can change it later.</p>
          <div className="mt-6">
            <RolePicker role={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
          </div>
          <Button block icon="arrow" className="mt-8" disabled={!draft.role} onClick={() => setStep(2)}>
            Continue
          </Button>
        </main>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <Header title={event?.name ?? "Join the event"} onBack={() => setStep(1)} />
        <main className="px-5 pb-12 pt-6">
          <h2 className="text-2xl font-black">What brings you here today?</h2>
          <div className="mt-6">
            <MatchInputFields value={match} onChange={setMatch} />
          </div>
          <div className="mt-8 grid grid-cols-[auto_1fr] gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setMatch({ learnToday: "", canShare: "" });
                setStep(3);
              }}
            >
              Skip
            </Button>
            <Button icon="arrow" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={event?.name ?? "Join the event"} onBack={() => setStep(2)} />
      <main className="space-y-6 px-5 pb-12 pt-6">
        <EventFields value={draft} onChange={setDraft} />

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--primary)]"
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
          icon="pin"
          disabled={!eventReady(draft)}
          onClick={() =>
            draft.role &&
            dispatch({
              type: "joinEvent",
              eventId,
              join: {
                role: draft.role,
                talkTitle: draft.talkTitle.trim() || undefined,
                outfit: draft.outfit.trim(),
                visible,
                learnToday: match.learnToday.trim() || undefined,
                canShare: match.canShare.trim() || undefined,
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

// From the AI matches prompt in Explore: just the two match fields.
export function MatchInput() {
  const { me, dispatch, back } = useApp();
  const [match, setMatch] = useState<MatchDraft>({ learnToday: me?.learnToday ?? "", canShare: me?.canShare ?? "" });
  return (
    <>
      <Header title="What brings you here today?" onBack={back} />
      <main className="px-5 pb-28 pt-6">
        <MatchInputFields value={match} onChange={setMatch} />
        <Button
          block
          icon="sparkle"
          className="mt-8"
          disabled={!match.learnToday.trim() && !match.canShare.trim()}
          onClick={() => dispatch({ type: "saveMatchInputs", learnToday: match.learnToday, canShare: match.canShare })}
        >
          Find my matches
        </Button>
      </main>
    </>
  );
}
