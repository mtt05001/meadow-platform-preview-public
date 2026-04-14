"use client";

import { usePathway } from "@/components/pathway/pathway-provider";

export default function ConfirmPage() {
  const { state } = usePathway();
  const outcome = state.routedOutcome;
  const isDiscovery = outcome === "discovery_call";
  const name = state.booking.first_name
    ? `${state.booking.first_name}`
    : "";

  return (
    <div className="min-h-[calc(100dvh-4px)] flex flex-col bg-[#f5f1eb]">
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M7 14.5L12 19.5L21 9.5"
                stroke="#1a4d2e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1
            className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-3"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isDiscovery
              ? `You're all set${name ? `, ${name}` : ""}`
              : "Thank you"}
          </h1>

          <div className="w-8 h-px bg-[#1a4d2e]/20 mx-auto mb-6" />

          {isDiscovery ? (
            <>
              <p
                className="text-[#1a4d2e]/60 text-[15px] leading-relaxed mb-6 max-w-md mx-auto"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Your discovery call is booked. You&rsquo;ll receive a confirmation
                email shortly with the details and a link to join.
              </p>

              <div className="bg-white border border-[#e8e2d8] rounded-lg px-5 py-4 text-left mb-6">
                <p
                  className="text-[11px] uppercase tracking-[0.1em] font-semibold text-[#1a4d2e]/40 mb-2"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  What happens next
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-[#1a4d2e]">1</span>
                    <span className="text-[14px] text-[#1a4d2e]/70" style={{ fontFamily: "var(--font-sans)" }}>
                      Check your email for the calendar confirmation
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-[#1a4d2e]">2</span>
                    <span className="text-[14px] text-[#1a4d2e]/70" style={{ fontFamily: "var(--font-sans)" }}>
                      A team member will call you at your scheduled time
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-[#1a4d2e]">3</span>
                    <span className="text-[14px] text-[#1a4d2e]/70" style={{ fontFamily: "var(--font-sans)" }}>
                      We&rsquo;ll discuss your goals and answer any questions
                    </span>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <p
              className="text-[#1a4d2e]/60 text-[15px] leading-relaxed mb-6 max-w-md mx-auto"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              We&rsquo;ve saved your information. When the time is right,
              we&rsquo;ll be here.
            </p>
          )}

          <a
            href="https://meadowmedicine.org"
            className="inline-block px-8 py-3 border border-[#e8e2d8] text-[#1a4d2e] text-[14px] font-medium tracking-wide rounded-lg
              hover:border-[#1a4d2e]/30 transition-colors duration-200"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Visit meadowmedicine.org
          </a>

          <p
            className="text-[#1a4d2e]/25 text-[12px] mt-8"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Meadow Medicine &middot; Portland, Oregon
          </p>
        </div>
      </div>
    </div>
  );
}
