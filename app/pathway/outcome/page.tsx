"use client";

import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";

export default function OutcomePage() {
  const { userId, isDemo } = usePathway();
  const router = useRouter();

  const handleContinue = async () => {
    if (!isDemo && userId) {
      await fetch("/api/pathway/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
    }
    router.push("/pathway/confirm");
  };

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
            Thank you for sharing
          </h1>

          <div className="w-8 h-px bg-[#1a4d2e]/20 mx-auto mb-6" />

          <p
            className="text-[#1a4d2e]/60 text-[15px] leading-relaxed mb-8 max-w-md mx-auto"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Based on your answers, now might not be the ideal time for a discovery
            call — but we&rsquo;d love to stay connected. Here are some resources
            to explore in the meantime.
          </p>

          <div className="space-y-3 text-left mb-8">
            <a
              href="https://www.youtube.com/@meadowmedicine"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-[#e8e2d8] rounded-lg px-5 py-4 hover:border-[#1a4d2e]/30 transition-colors"
            >
              <p className="font-medium text-[14px] text-[#1a4d2e]" style={{ fontFamily: "var(--font-sans)" }}>
                Dr. Tracy&rsquo;s YouTube Channel
              </p>
              <p className="text-[12px] text-[#1a4d2e]/45 mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>
                Learn about psilocybin therapy from our Medical Director
              </p>
            </a>
            <a
              href="https://meadowmedicine.org/faq"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white border border-[#e8e2d8] rounded-lg px-5 py-4 hover:border-[#1a4d2e]/30 transition-colors"
            >
              <p className="font-medium text-[14px] text-[#1a4d2e]" style={{ fontFamily: "var(--font-sans)" }}>
                Frequently Asked Questions
              </p>
              <p className="text-[12px] text-[#1a4d2e]/45 mt-0.5" style={{ fontFamily: "var(--font-sans)" }}>
                Common questions about the process, safety, and what to expect
              </p>
            </a>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="px-8 py-3 bg-[#1a4d2e] text-white text-[14px] font-semibold tracking-wide rounded-lg
              hover:bg-[#2d7a4a] transition-colors duration-200 cursor-pointer"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Done
          </button>

          <p
            className="text-[#1a4d2e]/30 text-[12px] mt-6 leading-relaxed"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            We&rsquo;ll keep your information on file. When the time feels right,
            reach out and we&rsquo;ll pick up where you left off.
          </p>
        </div>
      </div>
    </div>
  );
}
