const MIN = 60_000;

export const STALE_AFTER_MIN = 15;
export const LEAVE_WARNING_MIN = 10;

export function minutesAgo(ts: number, now: number): string {
  const m = Math.max(0, Math.round((now - ts) / MIN));
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? "1 hr ago" : `${h} hr ago`;
}

export function minutesUntil(ts: number, now: number): number {
  return Math.max(0, Math.ceil((ts - now) / MIN));
}

export function isStale(updatedAt: number, now: number): boolean {
  return now - updatedAt > STALE_AFTER_MIN * MIN;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
