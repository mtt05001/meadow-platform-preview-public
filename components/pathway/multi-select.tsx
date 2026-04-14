"use client";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: readonly Option[];
  values: string[];
  onChange: (values: string[]) => void;
  noneValue?: string;
}

export function MultiSelect({
  options,
  values,
  onChange,
  noneValue = "none",
}: MultiSelectProps) {
  const toggle = (val: string) => {
    if (val === noneValue) {
      onChange(values.includes(noneValue) ? [] : [noneValue]);
      return;
    }
    const without = values.filter((v) => v !== noneValue);
    if (without.includes(val)) {
      onChange(without.filter((v) => v !== val));
    } else {
      onChange([...without, val]);
    }
  };

  return (
    <div className="space-y-2.5">
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`w-full text-left px-5 py-4 border rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-3 ${
              selected
                ? "border-[#1a4d2e] bg-[#1a4d2e]/[0.04] shadow-[0_0_0_1px_#1a4d2e]"
                : "border-[#e8e2d8] bg-white hover:border-[#1a4d2e]/30"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                selected
                  ? "border-[#1a4d2e] bg-[#1a4d2e]"
                  : "border-[#d4cfc7]"
              }`}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span
              className="text-[#1a4d2e] text-[14px] leading-relaxed"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
