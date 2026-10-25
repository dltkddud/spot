"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { AppProvider, useApp } from "@/lib/store";
import { Explore } from "./screens/Explore";
import { Me } from "./screens/Me";
import { MyRequests } from "./screens/MyRequests";
import { EditProfile } from "./screens/EditProfile";
import { Events } from "./screens/Events";
import { JoinEvent, LogIn, MatchInput, ProfileSetup } from "./screens/Onboarding";
import { PanelDetail } from "./screens/PanelDetail";
import { PanelNow } from "./screens/PanelNow";
import { Welcome } from "./screens/Welcome";
import { ZonePicker } from "./screens/ZonePicker";
import { ZoneDetail } from "./screens/Zones";
import { PhoneFrame, scrollAppToTop } from "./PhoneFrame";
import { Icon, PinMark, RoleBadge, TabBar, Toasts } from "./ui";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Home screens: which event I'm at and how. Tapping it opens the Events list.
function HomeHeader() {
  const { state, me, navigate } = useApp();
  return (
    <header className="sticky top-[var(--safe-top)] z-20 border-b border-line bg-bg/95 backdrop-blur">
      <button
        onClick={() => navigate({ name: "events" })}
        className="flex h-14 w-full items-center gap-3 px-5 text-left transition hover:bg-primary-soft/50"
        aria-label={`${state.event.name}. Switch event`}
      >
        <PinMark size={30} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1 truncate text-base font-black">
            {state.event.name}
            <Icon name="chevron" size={16} />
          </span>
          <span className="block truncate text-[11px] text-muted">{state.event.venue}</span>
        </span>
        {me && (
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <RoleBadge role={me.role} />
            <span className="text-[11px] font-semibold text-muted">{me.name.split(" ")[0]}</span>
          </span>
        )}
      </button>
    </header>
  );
}

function Router() {
  const { screen, me, state } = useApp();

  useEffect(() => {
    scrollAppToTop();
  }, [state.stack.length, screen.name]);

  const withTabs = (node: ReactNode, home = false) => (
    <>
      {home && <HomeHeader />}
      {node}
      <TabBar />
    </>
  );

  switch (screen.name) {
    case "welcome":
      return <Welcome />;
    case "profileSetup":
      return <ProfileSetup />;
    case "logIn":
      return <LogIn />;
    case "events":
      return <Events />;
    case "joinEvent":
      return <JoinEvent key={screen.eventId} eventId={screen.eventId} />;
    case "editProfile":
      return withTabs(<EditProfile key={me?.id} />);
    case "matchInput":
      return withTabs(<MatchInput key={me?.id} />);
    case "zonePicker":
      return screen.fromOnboarding ? <ZonePicker fromOnboarding /> : withTabs(<ZonePicker />);
    case "explore":
      return withTabs(<Explore view={screen.view ?? "people"} />, true);
    case "panelNow":
      return withTabs(<PanelNow />, true);
    case "zoneDetail":
      return withTabs(<ZoneDetail zoneId={screen.zoneId} />);
    case "panelDetail":
      return withTabs(<PanelDetail key={screen.panelId} panelId={screen.panelId} />);
    case "requests":
      return withTabs(<MyRequests />);
    case "me":
      return withTabs(<Me key={me?.id} />);
  }
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <PhoneFrame>
        <AppProvider>
          <div className="mx-auto min-h-[var(--app-h)] max-w-[480px] bg-bg">
            <Router />
          </div>
          <Toasts />
        </AppProvider>
      </PhoneFrame>
    </ConvexProvider>
  );
}
