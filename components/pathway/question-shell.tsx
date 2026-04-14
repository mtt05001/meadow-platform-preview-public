"use client";

import type { ReactNode } from "react";

interface QuestionShellProps {
  step: number;
  heading: string;
  description?: string;
  children: ReactNode;
}

export function QuestionShell({
  step,
  heading,
  description,
  children,
}: QuestionShellProps) {
  return (
    <div className="min-h-[calc(100dvh-4px)] flex flex-col bg-[#f5f1eb]">
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <p
            className="text-[11px] tracking-[0.2em] uppercase font-medium text-[#1a4d2e]/40 mb-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Step {step}
          </p>
          <h1
            className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {heading}
          </h1>
          {description && (
            <p
              className="text-[#1a4d2e]/55 text-[15px] leading-relaxed mb-8"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {description}
            </p>
          )}
          {!description && <div className="mb-8" />}
          {children}
        </div>
      </div>
    </div>
  );
}
