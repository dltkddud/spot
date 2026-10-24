"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { AppProvider, useApp } from "@/lib/store";
import { Explore } from "./screens/Explore";
import { Me } from "./screens/Me";
import { MyRequests } from "./screens/MyRequests";
import { Onboarding } from "./screens/Onboarding";
import { PanelDetail } from "./screens/PanelDetail";
import { PanelNow } from "./screens/PanelNow";
import { Welcome } from "./screens/Welcome";
import { ZonePicker } from "./screens/ZonePicker";
import { ZoneDetail } from "./screens/Zones";
import { PhoneFrame, scrollAppToTop } from "./PhoneFrame";
import { PinMark, TabBar, Toasts } from "./ui";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function HomeHeader() {
  const { state, me } = useApp();
  return (
    <header className="sticky top-[var(--safe-top)] z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-5 backdrop-blur">
      <PinMark size={30} />
      <span className="flex-1 leading-tight">
        <span className="block text-base font-black">Spot</span>
        <span className="block text-[11px] text-muted">{state.event.name}</span>
      </span>
      {me && <span className="text-xs font-semibold text-muted">Hi, {me.name.split(" ")[0]}</span>}
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
    case "onboarding":
      return <Onboarding />;
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
