"use client";

interface NavButtonsProps {
  onBack?: () => void;
  onContinue: () => void;
  canContinue?: boolean;
  continueLabel?: string;
  showBack?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  loading?: boolean;
}

export function NavButtons({
  onBack,
  onContinue,
  canContinue = true,
  continueLabel = "Continue",
  showBack = true,
  showSkip = false,
  onSkip,
  loading = false,
}: NavButtonsProps) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <div>
        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[#1a4d2e]/50 hover:text-[#1a4d2e] text-[14px]
              tracking-wide transition-colors duration-200 cursor-pointer"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M8.5 3L4.5 7L8.5 11"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {showSkip && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-[#1a4d2e]/40 hover:text-[#1a4d2e]/60 text-[13px] transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || loading}
          className="px-8 py-3 bg-[#1a4d2e] text-white text-[14px] font-semibold tracking-wide rounded-lg
            hover:bg-[#2d7a4a] transition-colors duration-200 cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center gap-2"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
