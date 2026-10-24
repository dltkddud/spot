"use client";

import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { minutesAgo } from "@/lib/time";
import type { ShareWith, User } from "@/lib/types";
import { Avatar, Button, Icon, inputClass, PillButton, SectionTitle, StatusPill, ZoneBadge } from "./ui";

// The people I'm connected with, as I'm allowed to see them right now.
export function useMyPeople(): User[] {
  const { state } = useApp();
  return state.connections
    .map((c) => state.users.find((u) => u.id === c.userId))
    .filter((u): u is User => !!u);
}

// Top of Discover: where my connections are, by zone only.
export function YourPeople() {
  const { state, navigate } = useApp();
  const people = useMyPeople();
  if (people.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold">
          <Icon name="link" size={18} />
          Your people
        </h2>
        <span className="text-xs text-muted">Zones only, never exact location</span>
      </div>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {people.map((p) => {
          const zone = p.visible ? state.zones.find((z) => z.id === p.zoneId) : undefined;
          return (
            <button
              key={p.id}
              onClick={() => zone && navigate({ name: "zoneDetail", zoneId: zone.id })}
              disabled={!zone}
              className="w-[210px] shrink-0 rounded-2xl border border-line bg-surface p-3 text-left transition duration-150 enabled:hover:border-primary/50 enabled:hover:shadow-md enabled:active:scale-[0.98]"
            >
              <span className="flex items-center gap-2.5">
                <Avatar user={p} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="block text-xs text-muted">Updated {minutesAgo(p.updatedAt, state.now)}</span>
                </span>
              </span>
              <span className="mt-2.5 flex flex-wrap items-center gap-2">
                {zone ? (
                  <>
                    <ZoneBadge zone={zone} />
                    <StatusPill user={p} now={state.now} />
                  </>
                ) : (
                  <span className="text-xs font-semibold text-muted">Not sharing a zone right now</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const shareOptions: { value: ShareWith; label: string; body: string }[] = [
  { value: "everyone", label: "Everyone", body: "Anyone at the event can see your zone, status, and outfit." },
  {
    value: "connections",
    label: "Only my connections",
    body: "Only people you've connected with see your zone. Others can't find you on the map.",
  },
  { value: "nobody", label: "No one", body: "You're hidden. No one can see your zone or send you requests." },
];

// Who sees my zone: everyone, only my connections, or no one.
export function ShareWithPicker() {
  const { me, dispatch } = useApp();
  if (!me) return null;
  const current: ShareWith = me.shareWith ?? (me.visible ? "everyone" : "nobody");
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-bold">Who can see your zone</legend>
      {shareOptions.map((o) => (
        <label
          key={o.value}
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition duration-150 ${
            current === o.value ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/50"
          }`}
        >
          <input
            type="radio"
            name="shareWith"
            checked={current === o.value}
            onChange={() => dispatch({ type: "updateMe", patch: { shareWith: o.value } })}
            className="mt-1 h-5 w-5 accent-[var(--primary)]"
          />
          <span>
            <span className="block font-bold">{o.label}</span>
            <span className="mt-0.5 block text-sm text-muted">{o.body}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// Me: my code, invite link, a box for a friend's code, and my connections.
export function ConnectWithFriends() {
  const { state, me, dispatch } = useApp();
  const people = useMyPeople();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const linkBox = useRef<HTMLInputElement>(null);
  if (!me) return null;

  const link = me.connectCode ? `${window.location.origin}/?connect=${me.connectCode}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access: select the link so it can be copied by hand.
      linkBox.current?.focus();
      linkBox.current?.select();
    }
  };
  const submit = () => {
    if (!code.trim()) return;
    dispatch({ type: "connectCode", code });
    setCode("");
  };

  return (
    <>
      <SectionTitle aside="Zones only, never GPS">Connect with friends</SectionTitle>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">
          Connect before the event. When you pick a zone, your connections see it automatically.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
          <span>
            <span className="block text-xs font-semibold text-muted">Your code</span>
            <span className="block font-mono text-2xl font-black tracking-[0.25em]">{me.connectCode ?? "······"}</span>
          </span>
          <PillButton icon="copy" onClick={copy} disabled={!link}>
            {copied ? "Link copied" : "Copy invite link"}
          </PillButton>
        </div>
        <input
          ref={linkBox}
          readOnly
          value={link}
          aria-label="Your invite link"
          className="mt-2 w-full truncate rounded-lg bg-transparent px-1 text-xs text-muted focus:outline-none"
        />
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className={`${inputClass} font-mono uppercase tracking-[0.2em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Friend's code"
            aria-label="Friend's code"
            autoCapitalize="characters"
          />
          <Button type="submit" icon="link" disabled={code.trim().length < 6}>
            Connect
          </Button>
        </form>
      </section>

      {people.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {people.map((p) => {
            const zone = p.visible ? state.zones.find((z) => z.id === p.zoneId) : undefined;
            return (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <Avatar user={p} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="mt-0.5 block">
                    {zone ? <ZoneBadge zone={zone} /> : <span className="text-xs text-muted">Not sharing a zone</span>}
                  </span>
                </span>
                <button
                  onClick={() => dispatch({ type: "removeConnection", userId: p.id })}
                  className="rounded-full px-3 py-1.5 text-sm font-bold text-muted transition hover:bg-busy-soft hover:text-busy-ink"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
