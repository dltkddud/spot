import type { User } from "./types";

export function sharedInterests(a: User, b: User): string[] {
  return a.interests.filter((i) => b.interests.includes(i));
}
