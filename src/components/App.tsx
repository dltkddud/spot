"use client";

import { useEffect, type ReactNode } from "react";
import { AppProvider, useApp } from "@/lib/store";
import { Discover } from "./screens/Discover";
import { Me } from "./screens/Me";
import { MyRequests } from "./screens/MyRequests";
import { Onboarding } from "./screens/Onboarding";
import { PanelDetail } from "./screens/PanelDetail";
import { PanelNow } from "./screens/PanelNow";
import { Welcome } from "./screens/Welcome";
import { ZonePicker } from "./screens/ZonePicker";
import { ZoneDetail, Zones } from "./screens/Zones";
import { TabBar, Toasts } from "./ui";

function HomeHeader() {
  const { state, me } = useApp();
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-5 backdrop-blur">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-base font-black text-surface">S</span>
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
    window.scrollTo(0, 0);
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
    case "discover":
      return withTabs(<Discover />, true);
    case "panelNow":
      return withTabs(<PanelNow />, true);
    case "zones":
      return withTabs(<Zones />);
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
    <AppProvider>
      <div className="mx-auto min-h-dvh max-w-[480px] bg-bg sm:border-x sm:border-line">
        <Router />
      </div>
      <Toasts />
    </AppProvider>
  );
}
