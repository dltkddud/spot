"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { queueFor, useApp, type Screen } from "@/lib/store";
import { isStale, minutesAgo, minutesUntil } from "@/lib/time";
import type { Status, User, Zone } from "@/lib/types";

export function statusLabel(status: Status, leavingAt: number | undefined, now: number) {
  if (status === "available") return "Free to talk";
  if (status === "talking") return "In a conversation";
  const m = leavingAt ? minutesUntil(leavingAt, now) : 0;
  return m <= 1 ? "Leaving now" : `Leaving in ${m} min`;
}

const statusStyles: Record<Status, string> = {
  available: "bg-go-soft text-go-ink",
  talking: "bg-busy-soft text-busy-ink",
  leaving: "bg-soon-soft text-soon-ink",
};

const dotStyles: Record<Status, string> = {
  available: "bg-go",
  talking: "bg-busy",
  leaving: "bg-soon",
};

export function StatusPill({ user, now }: { user: User; now: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[user.status]}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotStyles[user.status]}`} aria-hidden />
      {statusLabel(user.status, user.leavingAt, now)}
    </span>
  );
}

export function ZoneBadge({ zone, size = "sm" }: { zone?: Zone; size?: "sm" | "lg" }) {
  if (!zone) return <span className="text-sm text-muted">No zone set</span>;
  const box = size === "lg" ? "h-12 w-12 text-2xl rounded-lg" : "h-6 w-6 text-sm rounded-[5px]";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`grid place-items-center bg-ink font-extrabold text-surface ${box}`}>{zone.code}</span>
      <span className={size === "lg" ? "text-lg font-bold" : "text-sm font-semibold"}>{zone.name}</span>
    </span>
  );
}

export function Avatar({ user, size = 44 }: { user: User; size?: number }) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${dotStyles[user.status]}`}
        aria-hidden
      />
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "go" | "busy";
  block?: boolean;
};

export function Button({ variant = "primary", block, className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-ink text-surface",
    secondary: "border border-line bg-surface text-ink",
    ghost: "text-ink underline-offset-4 hover:underline",
    go: "bg-go text-white",
    busy: "bg-busy text-white",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${block ? "w-full" : ""} ${className}`}
    />
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
        selected ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none";

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur">
      {onBack && (
        <button onClick={onBack} className="-ml-2 grid h-10 w-10 place-items-center rounded-full" aria-label="Go back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-extrabold">{title}</h1>
      {right}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-extrabold">{children}</h2>
      {aside && <span className="text-xs text-muted">{aside}</span>}
    </div>
  );
}

export function PanelCard({ panel, onOpen }: { panel: User; onOpen: () => void }) {
  const { state } = useApp();
  const zone = state.zones.find((z) => z.id === panel.zoneId);
  const waiting = queueFor(state.requests, panel.id).filter((r) => r.status === "waiting").length;
  const stale = isStale(panel.updatedAt, state.now);

  return (
    <button
      onClick={onOpen}
      className={`flex w-full gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition active:scale-[0.99] ${stale ? "opacity-55" : ""}`}
    >
      <Avatar user={panel} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-extrabold">{panel.name}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{panel.headline}</span>
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusPill user={panel} now={state.now} />
          <ZoneBadge zone={zone} />
          <span className="text-xs text-muted">
            {waiting > 0 ? `${waiting} waiting` : "No one waiting"}
          </span>
        </span>
        <span className="mt-1.5 block text-xs text-muted">
          Look for <span className="font-semibold text-ink">{panel.outfit}</span>
        </span>
        {stale && (
          <span className="mt-1 block text-xs font-semibold text-muted">
            Last update {minutesAgo(panel.updatedAt, state.now)}, may have moved
          </span>
        )}
      </span>
    </button>
  );
}

type Tab = { label: string; screen: Screen; match: Screen["name"][]; icon: ReactNode; badge?: number };

const icons = {
  discover: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  zones: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  requests: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h10M4 18h6" />
    </svg>
  ),
  now: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  ),
  me: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  ),
};

export function TabBar() {
  const { me, screen, state, dispatch } = useApp();
  if (!me) return null;

  const myActive = state.requests.filter(
    (r) => r.attendeeId === me.id && (r.status === "waiting" || r.status === "accepted"),
  ).length;
  const incoming = state.requests.filter((r) => r.panelId === me.id && r.status === "waiting").length;

  const tabs: Tab[] =
    me.role === "panel"
      ? [
          { label: "Now", screen: { name: "panelNow" }, match: ["panelNow"], icon: icons.now, badge: incoming },
          { label: "Zones", screen: { name: "zones" }, match: ["zones", "zoneDetail"], icon: icons.zones },
          { label: "Me", screen: { name: "me" }, match: ["me", "zonePicker"], icon: icons.me },
        ]
      : [
          { label: "Discover", screen: { name: "discover" }, match: ["discover", "panelDetail"], icon: icons.discover },
          { label: "Zones", screen: { name: "zones" }, match: ["zones", "zoneDetail"], icon: icons.zones },
          { label: "Requests", screen: { name: "requests" }, match: ["requests"], icon: icons.requests, badge: myActive },
          { label: "Me", screen: { name: "me" }, match: ["me", "zonePicker"], icon: icons.me },
        ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[480px]">
        {tabs.map((t) => {
          const active = t.match.includes(screen.name);
          return (
            <button
              key={t.label}
              onClick={() => dispatch({ type: "resetTo", screen: t.screen })}
              className={`relative flex flex-1 flex-col items-center gap-0.5 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 text-[11px] font-bold ${
                active ? "text-ink" : "text-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.icon}
              {t.label}
              {!!t.badge && (
                <span className="absolute right-[calc(50%-20px)] top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-busy px-1 text-[10px] text-white">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Toasts() {
  const { state, dispatch } = useApp();
  const latest = state.toasts[state.toasts.length - 1]?.id;

  useEffect(() => {
    if (!latest) return;
    const t = setTimeout(() => dispatch({ type: "dismissToast", id: latest }), 6000);
    return () => clearTimeout(t);
  }, [latest, dispatch]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+12px)] z-50 mx-auto flex max-w-[480px] flex-col gap-2 px-4">
      {state.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="toast-in pointer-events-auto flex items-start gap-3 rounded-xl bg-board px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-board-text" aria-hidden />
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dispatch({ type: "dismissToast", id: t.id })}
            className="-mr-1 text-board-dim"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
