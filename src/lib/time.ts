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

// Leaving times a speaker can type in, in minutes.
export const LEAVING_MIN_MAX = 180;

// Time left before a speaker leaves, the same everywhere it shows: "10 min"
// right after picking 10, "9 min" a minute later, then seconds in the last
// minute. now must be server time (store's state.now is).
export function timeLeft(leavingAt: number, now: number): { value: number; unit: "min" | "sec" } {
  const ms = Math.max(0, leavingAt - now);
  if (ms < MIN) return { value: Math.ceil(ms / 1000), unit: "sec" };
  return { value: Math.ceil(ms / MIN), unit: "min" };
}

export function timeLeftLabel(leavingAt: number, now: number): string {
  const { value, unit } = timeLeft(leavingAt, now);
  return value === 0 ? "now" : `${value} ${unit}`;
}

export function isStale(updatedAt: number, now: number): boolean {
  return now - updatedAt > STALE_AFTER_MIN * MIN;
}

// Always English and venue time (Pacific), whatever the browser is set to.
const VENUE_TIME_ZONE = "America/Los_Angeles";

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: VENUE_TIME_ZONE });
}

const venueParts = (ts: number) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: VENUE_TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(ts)
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", number>;

// "15:30" for a time input, in venue time.
export function venueHhmm(ts: number): string {
  const p = venueParts(ts);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

// A time input's "15:30" as a timestamp: that time today at the venue.
export function venueTimeToday(hhmm: string, now: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const today = venueParts(now);
  const asUtc = Date.UTC(today.year, today.month - 1, today.day, Number(m[1]), Number(m[2]));
  // How far the venue clock is from UTC around then (e.g. -7 hours in PDT).
  const there = venueParts(asUtc);
  const offset = Date.UTC(there.year, there.month - 1, there.day, there.hour, there.minute) - asUtc;
  return asUtc - offset;
}

// e.g. "Sun 4:00 PM"
export function dayTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: VENUE_TIME_ZONE,
  });
}

// "Sat Oct 24 – Sun Oct 25", or "Thu Oct 29, 8:00 – 11:00 AM" for one day.
export function eventDates(startsAt: number | undefined, endsAt: number): string {
  const day = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: VENUE_TIME_ZONE });
  if (!startsAt) return `Until ${day(endsAt)}`;
  if (day(startsAt) !== day(endsAt)) return `${day(startsAt)} – ${day(endsAt)}`;
  const start = clockTime(startsAt).replace(/ (AM|PM)$/, (m) => (clockTime(endsAt).endsWith(m.trim()) ? "" : m));
  return `${day(startsAt)}, ${start} – ${clockTime(endsAt)}`;
}
