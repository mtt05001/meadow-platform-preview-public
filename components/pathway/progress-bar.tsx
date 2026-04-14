"use client";

import { TOTAL_STEPS } from "@/lib/pathway-types";

export function ProgressBar({ currentStep }: { currentStep: number }) {
  const pct = Math.min((currentStep / TOTAL_STEPS) * 100, 100);

  return (
    <div className="w-full h-1 bg-[#e8e2d8]">
      <div
        className="h-full bg-[#1a4d2e] transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
