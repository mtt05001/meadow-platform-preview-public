"use client";

interface Option {
  value: string;
  label: string;
}

interface SingleSelectProps {
  options: readonly Option[];
  value: string | null;
  onChange: (value: string) => void;
}

export function SingleSelect({ options, value, onChange }: SingleSelectProps) {
  return (
    <div className="space-y-2.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`w-full text-left px-5 py-4 border rounded-lg transition-all duration-150 cursor-pointer ${
            value === opt.value
              ? "border-[#1a4d2e] bg-[#1a4d2e]/[0.04] shadow-[0_0_0_1px_#1a4d2e]"
              : "border-[#e8e2d8] bg-white hover:border-[#1a4d2e]/30"
          }`}
        >
          <span
            className="text-[#1a4d2e] text-[14px] leading-relaxed"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
