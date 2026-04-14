"use client";

import type { ReactNode } from "react";
import { PathwayProvider, usePathway } from "./pathway-provider";
import { ProgressBar } from "./progress-bar";
import { DemoBanner } from "./demo-banner";

function ShellInner({ children }: { children: ReactNode }) {
  const { state, isDemo } = usePathway();

  return (
    <div className="min-h-screen bg-[#f5f1eb] flex flex-col">
      {isDemo ? <DemoBanner /> : null}
      <ProgressBar currentStep={state.currentStep} />
      {children}
    </div>
  );
}

export function PathwayShell({ children }: { children: ReactNode }) {
  return (
    <PathwayProvider>
      <ShellInner>{children}</ShellInner>
    </PathwayProvider>
  );
}
