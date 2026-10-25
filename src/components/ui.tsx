"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { queueFor, useApp, type Screen } from "@/lib/store";
import { isStale, minutesAgo, minutesUntil } from "@/lib/time";
import type { Status, User, Zone } from "@/lib/types";
import { PIN_PATH, ZoneMark } from "./ZoneIcon";

const iconPaths = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  chat: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </>
  ),  chevron: <path d="M7 10l5 5 5-5" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 10.5V17M8 7.2v.3M12 17v-6.5M12 13.5c0-1.8 1-3 2.5-3s2.5 1 2.5 3V17" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19.5c.8-3.3 3.1-5 6-5s5.2 1.7 6 5" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M16.2 14.6c2.5.2 4.2 1.8 4.8 4.4" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
};

export type IconName = keyof typeof iconPaths;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {iconPaths[name]}
    </svg>
  );
}

// The Spot pin: a map pin that connects people and places.
export function PinMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 24 30" aria-hidden className="shrink-0">
      <path d={PIN_PATH} fill="var(--primary)" />
      <circle cx="12" cy="11.5" r="4.2" fill="var(--on-primary)" />
    </svg>
  );
}

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <PinMark size={size === "lg" ? 40 : 28} />
      <span className={`font-black tracking-tight ${size === "lg" ? "text-3xl" : "text-lg"}`}>Spot</span>
    </span>
  );
}

// How someone is at this event. Stored as panel/attendee; shown as Speaker/Guest.
export const roleLabel = (role: "panel" | "attendee") => (role === "panel" ? "Speaker" : "Guest");

export function RoleBadge({ role }: { role: "panel" | "attendee" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
        role === "panel" ? "bg-primary text-on-primary" : "bg-primary-soft text-primary-ink"
      }`}
    >
      {roleLabel(role)}
    </span>
  );
}

// Says whether some text came from Claude or from the fallback rule, so the
// screen alone shows whether Claude ran.
export function AiTag({ claude, fallback = "Based on shared interests" }: { claude: boolean; fallback?: string }) {
  return claude ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-on-primary">
      <Icon name="sparkle" size={12} />
      Claude
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-muted">
      {fallback}
    </span>
  );
}

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
  return (
    <span className="inline-flex items-center gap-2">
      <ZoneMark zone={zone} size={size === "lg" ? 48 : 26} />
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
  icon?: IconName;
};

export function Button({ variant = "primary", block, icon, className = "", children, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-primary text-on-primary shadow-sm shadow-primary/25 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30",
    secondary: "bg-primary-soft text-primary-ink hover:bg-primary-soft-hover",
    ghost: "text-primary-ink hover:bg-primary-soft",
    go: "bg-go text-white shadow-sm shadow-go/25 hover:brightness-110 hover:shadow-md",
    busy: "bg-busy text-white shadow-sm shadow-busy/25 hover:brightness-110 hover:shadow-md",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition duration-150 ease-out active:translate-y-px active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${styles} ${block ? "w-full" : ""} ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

// Small rounded action, e.g. "I moved" or "Still here?".
export function PillButton({
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName }) {
  return (
    <button
      {...props}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-3.5 py-2 text-sm font-bold text-primary-ink transition duration-150 hover:bg-primary-soft-hover active:scale-[0.96] disabled:opacity-50 ${className}`}
    >
      {icon && <Icon name={icon} size={16} />}
      {props.children}
    </button>
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
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition duration-150 active:scale-[0.96] ${
        selected
          ? "border-primary bg-primary text-on-primary"
          : "border-line bg-surface text-ink hover:border-primary/50 hover:bg-primary-soft"
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
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none";

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="sticky top-[var(--safe-top)] z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur">
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
  explore: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
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

  // Guests: Explore / Requests / Me. Speakers add Now, their own line, in front.
  const shared: Tab[] = [
    { label: "Explore", screen: { name: "explore" }, match: ["explore", "zoneDetail", "panelDetail", "matchInput"], icon: icons.explore },
    { label: "Requests", screen: { name: "requests" }, match: ["requests"], icon: icons.requests, badge: myActive },
    { label: "Me", screen: { name: "me" }, match: ["me", "zonePicker", "editProfile"], icon: icons.me },
  ];
  const tabs: Tab[] =
    me.role === "panel"
      ? [{ label: "Now", screen: { name: "panelNow" }, match: ["panelNow"], icon: icons.now, badge: incoming }, ...shared]
      : shared;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[480px]">
        {tabs.map((t) => {
          const active = t.match.includes(screen.name);
          return (
            <button
              key={t.label}
              onClick={() => dispatch({ type: "resetTo", screen: t.screen })}
              className={`relative flex flex-1 flex-col items-center gap-0.5 pb-[max(10px,var(--safe-bottom))] pt-2.5 text-[11px] font-bold ${
                active ? "text-primary" : "text-muted"
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

// Someone tapped "Still here?" on my zone. Stays up until I answer.
function StillHerePrompt() {
  const { state, me, screen, dispatch, navigate } = useApp();
  if (!me || me.stillHereAskedAt === undefined || !me.zoneId || screen.name === "zonePicker") return null;
  const zone = state.zones.find((z) => z.id === me.zoneId);
  return (
    <div role="alert" className="toast-in pointer-events-auto rounded-xl bg-board px-4 py-3 text-white shadow-lg">
      <p className="text-sm font-bold">Someone is looking for you.</p>
      <p className="mt-0.5 text-sm text-board-dim">Are you still at {zone?.name ?? "your zone"}?</p>
      <div className="mt-3 flex gap-2">
        <PillButton icon="check" onClick={() => dispatch({ type: "confirmStillHere" })}>
          Still here
        </PillButton>
        <PillButton icon="pin" onClick={() => navigate({ name: "zonePicker" })}>
          I moved
        </PillButton>
      </div>
    </div>
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
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+12px)] z-50 mx-auto flex max-w-[480px] flex-col gap-2 px-4">
      <StillHerePrompt />
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
