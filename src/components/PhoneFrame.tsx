"use client";

import { useEffect, useState, type ReactNode } from "react";

// On a laptop or desktop the app runs inside a phone-sized frame, so demos
// look like the real thing. On a phone, or opened from the home screen, it
// runs full screen as before.

const SCREEN = { width: 390, height: 844 };
const STATUS_BAR = 47;
const BEZEL = 12;
const MARGIN = 24;
const SCROLL_ID = "spot-scroll";

const WIDE = "(min-width: 640px) and (min-height: 520px)";
const STANDALONE = "(display-mode: standalone)";

function shouldFrame() {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia(WIDE).matches && !standalone;
}

function fitScale() {
  const w = SCREEN.width + BEZEL * 2;
  const h = SCREEN.height + BEZEL * 2;
  return Math.min(1, (window.innerHeight - MARGIN * 2) / h, (window.innerWidth - MARGIN * 2) / w);
}

// The element that scrolls the app: the frame's screen, or the page itself.
export function scrollAppToTop() {
  const el = document.getElementById(SCROLL_ID);
  if (el) el.scrollTo(0, 0);
  else window.scrollTo(0, 0);
}

function StatusBar() {
  return (
    <div
      className="relative flex shrink-0 items-center justify-between bg-bg px-8 text-[15px] font-bold text-ink"
      style={{ height: STATUS_BAR }}
      aria-hidden
    >
      <span className="w-14">9:41</span>
      <span className="absolute left-1/2 top-[11px] h-[30px] w-[118px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex w-14 items-center justify-end gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1.5 4.5a9.5 9.5 0 0 1 13 0M4 7.2a6 6 0 0 1 8 0" />
          <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
        </svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
          <rect x="0.75" y="0.75" width="21.5" height="11.5" rx="3.5" stroke="currentColor" strokeWidth="1.3" opacity="0.45" />
          <rect x="2.5" y="2.5" width="18" height="8" rx="2" fill="currentColor" />
          <path d="M24 4.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [framed, setFramed] = useState(shouldFrame);
  const [scale, setScale] = useState(() => (shouldFrame() ? fitScale() : 1));

  useEffect(() => {
    const update = () => {
      setFramed(shouldFrame());
      setScale(fitScale());
    };
    const wide = window.matchMedia(WIDE);
    const standalone = window.matchMedia(STANDALONE);
    window.addEventListener("resize", update);
    wide.addEventListener("change", update);
    standalone.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      wide.removeEventListener("change", update);
      standalone.removeEventListener("change", update);
    };
  }, []);

  if (!framed) return <>{children}</>;

  return (
    <div className="phone-stage fixed inset-0 overflow-hidden">
      <div
        className="phone-body absolute left-1/2 top-1/2 rounded-[60px] bg-[#0b0f1a]"
        style={{
          padding: BEZEL,
          width: SCREEN.width + BEZEL * 2,
          height: SCREEN.height + BEZEL * 2,
          // A faint edge so the phone stands out on the dark background too.
          boxShadow: "0 0 0 1.5px rgba(148, 163, 184, 0.28), 0 32px 64px -16px rgba(2, 8, 23, 0.55)",
          // Centered on the screen, then shrunk to fit short laptop screens.
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div
          className="flex flex-col overflow-hidden rounded-[48px] bg-bg"
          style={{ width: SCREEN.width, height: SCREEN.height }}
        >
          <StatusBar />
          {/* The transform makes this box, not the browser window, the frame for
              fixed elements (tab bar, banners), so they stay on the phone. */}
          <div
            className="phone-screen relative min-h-0 flex-1 overflow-hidden"
            style={{ transform: "translateZ(0)" }}
          >
            <div id={SCROLL_ID} className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none]">
              {children}
            </div>
            <span
              className="pointer-events-none absolute bottom-2 left-1/2 z-40 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-ink/80"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
