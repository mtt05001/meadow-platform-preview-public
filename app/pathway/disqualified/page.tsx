"use client";

import { useEffect } from "react";
import { usePathway } from "@/components/pathway/pathway-provider";

export default function DisqualifiedPage() {
  const { userId, isDemo } = usePathway();

  useEffect(() => {
    if (isDemo || !userId) return;
    fetch("/api/pathway/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }).catch(console.error);
  }, [userId, isDemo]);

  return (
    <div className="min-h-[calc(100dvh-4px)] flex flex-col bg-[#f5f1eb]">
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg text-center">
          <p
            className="text-[11px] tracking-[0.35em] uppercase font-medium text-[#1a4d2e]/40 mb-6"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Meadow Medicine
          </p>

          <h1
            className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            This isn&rsquo;t the right path right now
          </h1>

          <div className="w-8 h-px bg-[#1a4d2e]/20 mx-auto mb-6" />

          <p
            className="text-[#1a4d2e]/60 text-[15px] leading-relaxed mb-4 max-w-md mx-auto"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Based on the health information you shared, psilocybin-assisted therapy
            at Meadow Medicine isn&rsquo;t a safe option for you at this time.
          </p>

          <p
            className="text-[#1a4d2e]/60 text-[15px] leading-relaxed mb-8 max-w-md mx-auto"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Your safety is our highest priority. We encourage you to continue
            working with your healthcare provider to explore options that are
            right for your situation.
          </p>

          <div className="space-y-3 text-left mb-8">
            <a
              href="https://www.samhsa.gov/find-help/national-helpline"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-[#e8e2d8] rounded-lg px-5 py-4 hover:border-[#1a4d2e]/30 transition-colors"
            >
              <p className="font-medium text-[14px] text-[#1a4d2e]" style={{ fontFamily: "var(--font-sans)" }}>
                SAMHSA National Helpline
              </p>
              <p className="text-[12px] text-[#1a4d2e]/45 mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>
                Free, confidential, 24/7 treatment referral and information &mdash; 1-800-662-4357
              </p>
            </a>
            <a
              href="https://www.psychologytoday.com/us/therapists"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-[#e8e2d8] rounded-lg px-5 py-4 hover:border-[#1a4d2e]/30 transition-colors"
            >
              <p className="font-medium text-[14px] text-[#1a4d2e]" style={{ fontFamily: "var(--font-sans)" }}>
                Find a Therapist
              </p>
              <p className="text-[12px] text-[#1a4d2e]/45 mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>
                Psychology Today&rsquo;s directory of licensed mental health professionals
              </p>
            </a>
            <a
              href="https://988lifeline.org"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-[#e8e2d8] rounded-lg px-5 py-4 hover:border-[#1a4d2e]/30 transition-colors"
            >
              <p className="font-medium text-[14px] text-[#1a4d2e]" style={{ fontFamily: "var(--font-sans)" }}>
                988 Suicide &amp; Crisis Lifeline
              </p>
              <p className="text-[12px] text-[#1a4d2e]/45 mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>
                Call or text 988 for immediate support
              </p>
            </a>
          </div>

          <p
            className="text-[#1a4d2e]/30 text-[12px] leading-relaxed max-w-sm mx-auto"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            If your health situation changes in the future, you&rsquo;re always
            welcome to revisit this process.
          </p>
        </div>
      </div>
    </div>
  );
}
