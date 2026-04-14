"use client";

import { useState } from "react";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className="shrink-0 bg-amber-950/90 text-amber-50 px-4 py-2.5 text-center text-[13px] leading-snug"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="font-medium">Demo mode</span>
      <span className="opacity-90"> — nothing is saved to our servers. Use this to preview layout and flow only.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-3 underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
      >
        Dismiss
      </button>
    </div>
  );
}
