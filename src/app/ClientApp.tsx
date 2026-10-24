"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-bg" />,
});

export default function ClientApp() {
  return <App />;
}
