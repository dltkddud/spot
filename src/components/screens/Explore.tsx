"use client";

import { useApp, type ExploreView } from "@/lib/store";
import { Icon, type IconName } from "../ui";
import { ExplorePeople } from "./Discover";
import { ExploreMap } from "./Zones";

const views: { value: ExploreView; label: string; icon: IconName }[] = [
  { value: "people", label: "People", icon: "users" },
  { value: "map", label: "Map", icon: "pin" },
];

// Explore: who's here (People) and where (Map), one tap apart.
export function Explore({ view }: { view: ExploreView }) {
  const { navigate } = useApp();
  return (
    <>
      <div className="sticky top-[calc(var(--safe-top)+56px)] z-10 border-b border-line bg-bg/95 px-5 py-2.5 backdrop-blur">
        <div role="tablist" aria-label="Explore" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {views.map((v) => {
            const active = v.value === view;
            return (
              <button
                key={v.value}
                role="tab"
                aria-selected={active}
                onClick={() => navigate({ name: "explore", view: v.value }, true)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold transition duration-150 active:scale-[0.97] ${
                  active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <Icon name={v.icon} size={16} />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>
      <main className="px-5 pb-28 pt-4">{view === "map" ? <ExploreMap /> : <ExplorePeople />}</main>
    </>
  );
}
