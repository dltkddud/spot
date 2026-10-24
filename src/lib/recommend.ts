import type { Recommendation, User, Zone } from "./types";

export function sharedInterests(a: User, b: User): string[] {
  return a.interests.filter((i) => b.interests.includes(i));
}

export function localRecommendations(me: User, panels: User[], zones: Zone[]): Recommendation[] {
  const zoneName = (id?: string) => zones.find((z) => z.id === id)?.name ?? "the venue";

  return panels
    .filter((p) => p.visible && !p.requestsPaused && p.status !== "talking")
    .map((p) => {
      const shared = sharedInterests(me, p);
      const score =
        shared.length * 2 +
        (p.status === "available" ? 2 : 1) +
        (p.zoneId && p.zoneId === me.zoneId ? 1 : 0);
      return { p, shared, score };
    })
    .filter((x) => x.shared.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ p, shared }) => {
      const topic = shared.slice(0, 2).join(" and ");
      const when =
        p.status === "available"
          ? `free to talk now at ${zoneName(p.zoneId)}`
          : `leaving soon, so this is the moment`;
      return {
        panelId: p.id,
        sharedInterests: shared,
        reason: `You both care about ${topic}. ${p.name.split(" ")[0]} is ${when}.`,
      };
    });
}
