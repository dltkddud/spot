"use client";

import { useRef, useState } from "react";
import { linkHref } from "@/lib/links";
import type { ChatRequest, User } from "@/lib/types";
import { Icon, PillButton } from "./ui";

// After a speaker leaves with me still in line: their LinkedIn, a message I can
// send (drafted by Claude, or a template), and their other link.
export function FollowUp({ request, speaker }: { request: ChatRequest; speaker?: User }) {
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const first = speaker?.name.split(" ")[0] ?? "them";
  const draft = request.followUp;
  const text = edited ?? draft?.text ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access: select the message so it can be copied by hand.
      box.current?.focus();
      box.current?.select();
    }
  };

  return (
    <section className="mt-3 rounded-2xl border border-primary/30 bg-primary-soft p-4">
      <p className="font-extrabold text-primary-ink">Keep the conversation going</p>
      <p className="mt-0.5 text-sm text-muted">
        {first} left before your turn. Here&apos;s a message you can send.
      </p>

      {speaker?.linkedinUrl && (
        <a
          href={linkHref(speaker.linkedinUrl)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-on-primary shadow-sm shadow-primary/25 transition duration-150 hover:bg-primary-hover active:scale-[0.97]"
        >
          <Icon name="linkedin" />
          Message {first} on LinkedIn
        </a>
      )}

      <div className="mt-3 rounded-xl bg-surface p-3">
        {draft ? (
          <>
            <textarea
              ref={box}
              value={text}
              onChange={(e) => setEdited(e.target.value)}
              rows={Math.min(16, text.split("\n").length + Math.ceil(text.length / 40))}
              aria-label={`Message to ${first}`}
              className="w-full resize-none bg-transparent text-sm leading-relaxed text-ink focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                {draft.source === "claude" ? "Drafted by Claude. Edit it before you send." : "Edit it before you send."}
              </span>
              <PillButton icon={copied ? "check" : "copy"} onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </PillButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Writing a message you can send…</p>
        )}
      </div>

      {speaker?.contactUrl && (
        <a
          href={linkHref(speaker.contactUrl)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary-ink underline underline-offset-4"
        >
          <Icon name="link" size={16} />
          {first}&apos;s other link
        </a>
      )}
    </section>
  );
}
