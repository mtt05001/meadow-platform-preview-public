const tierConfig = {
  red: {
    label: "High Risk",
    bg: "bg-[#fdeaea]",
    text: "text-[#c0392b]",
    border: "border-[#e8a9a3]",
    dot: "bg-[#c0392b]",
  },
  yellow: {
    label: "Moderate",
    bg: "bg-[#fff8e1]",
    text: "text-[#8a6d00]",
    border: "border-[#e8d590]",
    dot: "bg-[#d4a017]",
  },
  green: {
    label: "Cleared",
    bg: "bg-[#eafaf1]",
    text: "text-[#1a7a42]",
    border: "border-[#a3dbb8]",
    dot: "bg-[#27ae60]",
  },
  unknown: {
    label: "Unknown",
    bg: "bg-[#f0ede8]",
    text: "text-[#7f8c8d]",
    border: "border-[#d5cfc5]",
    dot: "bg-[#7f8c8d]",
  },
} as const;

export default function RiskTierBadge({
  tier,
  size = "default",
}: {
  tier: string;
  size?: "default" | "lg";
}) {
  const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.unknown;
  const isLg = size === "lg";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold tracking-wide
        border rounded-full
        ${config.bg} ${config.text} ${config.border}
        ${isLg ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-0.5 text-[11px]"}
      `}
    >
      <span
        className={`rounded-full ${config.dot} ${isLg ? "w-2 h-2" : "w-1.5 h-1.5"}`}
      />
      {config.label}
    </span>
  );
}
