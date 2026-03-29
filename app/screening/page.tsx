"use client";

import { useState, useMemo, useRef } from "react";
import {
  ArrowRight,
  Copy,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  X,
  Pill,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import Nav from "@/components/nav";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MEDICATION_DATABASE,
  getCategoryLabel,
  getCategoryDetailLabel,
  FREQUENCY_OPTIONS,
  CANNABIS_OPTIONS,
  ALCOHOL_OPTIONS,
  HARD_DRUG_OPTIONS,
  type Medication,
  type MedicationEntry,
} from "@/lib/medication-data";
import {
  evaluateScreening,
  generateSummary,
  type SubstanceUse,
  type ScreeningResult,
} from "@/lib/screening-engine";

// ---------------------------------------------------------------------------
// Category color helper
// ---------------------------------------------------------------------------
const catColor = (cat: Medication["category"]) =>
  cat === "hard_always"
    ? "bg-tier-red/10 text-tier-red"
    : cat.startsWith("hard_if")
      ? "bg-tier-yellow/10 text-tier-yellow"
      : "bg-tier-green/10 text-tier-green";

// Group medications by type for browsing
const MED_GROUPS: { label: string; types: string[] }[] = [
  { label: "Antipsychotics", types: ["antipsychotic"] },
  { label: "Mood Stabilizers", types: ["mood_stabilizer"] },
  { label: "MAOIs", types: ["maoi"] },
  { label: "TCAs", types: ["tca"] },
  { label: "Anxiolytics", types: ["anxiolytic"] },
  { label: "Antidepressants (Other)", types: ["antidepressant"] },
  { label: "Benzodiazepines", types: ["benzodiazepine"] },
  { label: "Sleep Medications", types: ["sleep_med"] },
  { label: "Opioids", types: ["opioid"] },
  { label: "SSRIs", types: ["ssri"] },
  { label: "SNRIs", types: ["snri"] },
  { label: "Stimulants", types: ["stimulant"] },
  { label: "Other", types: ["other"] },
];

// ---------------------------------------------------------------------------
// Medication search + browse dropdown
// ---------------------------------------------------------------------------
function MedPicker({
  onSelect,
  selected,
}: {
  onSelect: (m: Medication) => void;
  selected: MedicationEntry[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = useMemo(
    () =>
      MEDICATION_DATABASE.filter(
        (m) => !selected.some((s) => s.medication.name === m.name),
      ),
    [selected],
  );

  const filtered = useMemo(() => {
    if (query.length === 0) return available;
    const q = query.toLowerCase();
    return available.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.brandNames.some((b) => b.toLowerCase().includes(q)),
    );
  }, [query, available]);

  // When searching, show flat list. When browsing (empty query), show grouped.
  const isSearching = query.length > 0;

  const pick = (m: Medication) => {
    onSelect(m);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const flatList = isSearching ? filtered.slice(0, 12) : [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-foreground/45" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search or browse medications..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={(e) => {
            if (!open) return;
            if (isSearching && flatList.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlighted((p) => Math.min(p + 1, flatList.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlighted((p) => Math.max(p - 1, 0));
              } else if (e.key === "Enter" && flatList[highlighted]) {
                e.preventDefault();
                pick(flatList[highlighted]);
              }
            }
            if (e.key === "Escape") setOpen(false);
          }}
          className="w-full pl-12 pr-10 py-3 bg-cream-warm border border-foreground/8 rounded-lg focus:border-meadow focus:ring-1 focus:ring-meadow/20 transition-colors outline-none text-foreground placeholder:text-foreground/45 text-sm"
        />
        <ChevronDown
          className={`absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {isSearching ? (
            // Search results — flat list
            flatList.length > 0 ? (
              flatList.map((med, i) => (
                <button
                  key={med.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(med)}
                  className={`w-full px-4 py-2.5 text-left flex items-center gap-2 text-sm transition-colors ${
                    i === highlighted ? "bg-cream" : "hover:bg-cream/50"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground">
                      {med.name}
                    </span>
                    {med.brandNames.length > 0 && (
                      <span className="text-foreground/40 ml-1.5 text-xs">
                        ({med.brandNames.join(", ")})
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0 ${catColor(med.category)}`}
                  >
                    {getCategoryLabel(med.category)}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-center text-foreground/40 text-sm">
                No medications match &ldquo;{query}&rdquo;
              </div>
            )
          ) : (
            // Browse mode — grouped by type
            MED_GROUPS.map((group) => {
              const meds = available.filter((m) =>
                group.types.includes(m.type),
              );
              if (meds.length === 0) return null;
              return (
                <div key={group.label}>
                  <div className="px-4 py-1.5 bg-cream-warm/60 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40 sticky top-0">
                    {group.label}
                  </div>
                  {meds.map((med) => (
                    <button
                      key={med.name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(med)}
                      className="w-full px-4 py-2 text-left flex items-center gap-2 text-sm hover:bg-cream/50 transition-colors"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">
                          {med.name}
                        </span>
                        {med.brandNames.length > 0 && (
                          <span className="text-foreground/40 ml-1.5 text-xs">
                            ({med.brandNames.join(", ")})
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0 ${catColor(med.category)}`}
                      >
                        {getCategoryLabel(med.category)}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ title, label }: { title: string; label: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-foreground/8 pb-1.5">
      <h2 className="font-serif text-xl text-meadow">{title}</h2>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/50 hidden sm:block">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ScreeningPage() {
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [substanceUse, setSubstanceUse] = useState<SubstanceUse>({
    cannabis: "none",
    alcohol: "none",
    hardDrugs: "no",
  });
  const [age, setAge] = useState("");
  const [screeningResult, setScreeningResult] =
    useState<ScreeningResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const addMed = (m: Medication) =>
    setMedications((prev) => [
      ...prev,
      { medication: m, frequency: null, dailyUse: null, chronicUse: null },
    ]);
  const updateMed = (i: number, entry: MedicationEntry) =>
    setMedications((prev) => prev.map((e, idx) => (idx === i ? entry : e)));
  const removeMed = (i: number) =>
    setMedications((prev) => prev.filter((_, idx) => idx !== i));

  const evaluate = () => {
    const result = evaluateScreening({ medications, substanceUse, age });
    setScreeningResult(result);
    setShowResults(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setMedications([]);
    setSubstanceUse({ cannabis: "none", alcohol: "none", hardDrugs: "no" });
    setAge("");
    setScreeningResult(null);
    setShowResults(false);
  };

  const copySummary = () => {
    if (!screeningResult) return;
    navigator.clipboard.writeText(generateSummary(screeningResult));
    toast.success("Summary copied to clipboard");
  };

  const allFreqsSet = medications.every((m) => m.frequency !== null);
  const canEvaluate = medications.length === 0 || allFreqsSet;

  // -------------------------------------------------------------------------
  // Results view
  // -------------------------------------------------------------------------
  if (showResults && screeningResult) {
    const r = screeningResult;
    const colorMap = {
      green: { icon: CheckCircle, bg: "from-meadow to-[#2d7a4a]" },
      yellow: { icon: AlertTriangle, bg: "from-[#8b6914] to-[#d4a017]" },
      red: { icon: XCircle, bg: "from-[#7c1d1d] to-[#c0392b]" },
    };
    const c = colorMap[r.resultColor];
    const Icon = c.icon;

    return (
      <>
        <Nav />
        <main className="px-6 md:px-10 lg:px-16 py-5">
          <div
            className={`bg-gradient-to-br ${c.bg} rounded-2xl px-8 py-6 mb-6 shadow-lg`}
          >
            <Icon className="h-6 w-6 text-white/80 mb-2" />
            <h1 className="font-serif text-2xl md:text-3xl text-white tracking-tight mb-1">
              {r.result}
            </h1>
            <p className="text-white/60 text-sm">
              Next step:{" "}
              <span className="text-white font-semibold">{r.nextAction}</span>
            </p>
          </div>

          <div className="space-y-5">
            {r.hardContraindications.length > 0 && (
              <section>
                <SectionHeader
                  title="Hard Contraindications"
                  label={`${r.hardContraindications.length} found`}
                />
                <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {r.hardContraindications.map((item, i) => (
                    <div
                      key={i}
                      className="bg-tier-red-bg/50 border border-tier-red/10 rounded-lg px-3 py-2.5"
                    >
                      <p className="font-semibold text-sm text-tier-red">
                        {item.trigger}
                      </p>
                      <p className="text-xs text-tier-red/60 mt-0.5">
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!r.hasHardContraindication && (
              <section>
                <SectionHeader
                  title="Soft Score Analysis"
                  label={`Score: ${r.softScore}`}
                />
                <div className="mt-2">
                  {r.softContraindications.length > 0 ? (
                    r.softContraindications.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-baseline py-2 border-b border-foreground/6 last:border-0"
                      >
                        <span className="text-sm">
                          <span className="font-semibold">{item.trigger}</span>
                          <span className="text-foreground/50 ml-1">
                            &mdash; {item.reason}
                          </span>
                        </span>
                        <span className="text-xs font-mono text-foreground/40">
                          +1
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-foreground/50">
                      No soft contraindications detected
                    </p>
                  )}
                  <div className="flex gap-4 pt-2 mt-1 text-[10px] font-bold uppercase tracking-[0.15em]">
                    <span className={r.softScore <= 2 ? "text-tier-green" : "text-foreground/20"}>0–2 Green</span>
                    <span className={r.softScore >= 3 && r.softScore <= 4 ? "text-tier-yellow" : "text-foreground/20"}>3–4 Yellow</span>
                    <span className={r.softScore >= 5 ? "text-tier-red" : "text-foreground/20"}>5+ Red</span>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-foreground/8 flex flex-col sm:flex-row gap-3">
            <Button onClick={copySummary} variant="outline" className="h-10 px-6 text-sm">
              <Copy className="mr-2 h-4 w-4" />
              Copy Internal Summary
            </Button>
            <button
              onClick={reset}
              className="h-10 px-8 bg-meadow text-white font-semibold text-sm rounded-lg hover:bg-meadow-light transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              New Screening
            </button>
          </div>
        </main>
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Form view
  // -------------------------------------------------------------------------
  return (
    <>
      <Nav />
      <main className="px-6 md:px-10 lg:px-16 py-5">
        {/* Header — compact */}
        <header className="mb-5">
          <h1 className="font-serif text-3xl md:text-4xl text-meadow tracking-tight leading-tight mb-1">
            Medication Screening
          </h1>
          <p className="text-foreground/70 max-w-xl text-sm">
            Evaluate patient eligibility based on current prescriptions and
            lifestyle factors.
          </p>
        </header>

        {/* Two-column on wide screens */}
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_400px] gap-x-10 gap-y-6 items-start">
          {/* ── Left: Medications (always full width row on <2xl) ─── */}
          <section className="space-y-3 2xl:row-span-3">
            <SectionHeader
              title="Medication Search"
              label="Pharmacological Database"
            />
            <MedPicker onSelect={addMed} selected={medications} />

            {medications.length > 0 ? (
              <div className="space-y-1.5">
                {medications.map((entry, i) => {
                  const m = entry.medication;
                  const showBenzo =
                    m.type === "benzodiazepine" &&
                    entry.frequency &&
                    entry.frequency !== "not_taking";
                  const showOpioid =
                    m.type === "opioid" &&
                    entry.frequency &&
                    entry.frequency !== "not_taking";

                  const borderColor =
                    m.category === "hard_always"
                      ? "border-l-tier-red"
                      : m.category.startsWith("hard_if")
                        ? "border-l-tier-yellow"
                        : "border-l-tier-green";

                  return (
                    <div
                      key={`${m.name}-${i}`}
                      className={`bg-cream-warm/40 border border-foreground/6 border-l-[3px] ${borderColor} rounded-lg px-4 py-3`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {m.name}
                            </span>
                            {m.brandNames.length > 0 && (
                              <span className="text-foreground/40 text-xs">
                                {m.brandNames.join(", ")}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${catColor(m.category)}`}
                            >
                              {getCategoryDetailLabel(m.category)}
                            </span>
                          </div>

                          <div className="mt-2">
                            <Select
                              value={entry.frequency || ""}
                              onValueChange={(v) =>
                                v !== null &&
                                updateMed(i, { ...entry, frequency: v })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-44 bg-card border-foreground/10">
                                <SelectValue placeholder="Select frequency..." />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {showBenzo && (
                            <div className="flex items-center justify-between mt-2 p-2 bg-tier-yellow-bg/40 border border-tier-yellow/10 rounded text-xs">
                              <span className="text-tier-yellow font-medium">
                                Daily benzodiazepine use?
                              </span>
                              <Switch
                                checked={entry.dailyUse || false}
                                onCheckedChange={(v) =>
                                  updateMed(i, { ...entry, dailyUse: v })
                                }
                              />
                            </div>
                          )}
                          {showOpioid && (
                            <div className="flex items-center justify-between mt-2 p-2 bg-tier-yellow-bg/40 border border-tier-yellow/10 rounded text-xs">
                              <span className="text-tier-yellow font-medium">
                                Chronic opioid use?
                              </span>
                              <Switch
                                checked={entry.chronicUse || false}
                                onCheckedChange={(v) =>
                                  updateMed(i, { ...entry, chronicUse: v })
                                }
                              />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => removeMed(i)}
                          className="text-foreground/25 hover:text-foreground p-1 rounded hover:bg-cream-dark/40 transition-colors shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-cream-warm/60 rounded-xl py-12 flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-full bg-cream-dark/40 flex items-center justify-center mb-2.5">
                  <Pill className="h-5 w-5 text-foreground/35" />
                </div>
                <p className="text-foreground/70 font-medium text-sm">
                  Search and add medications above
                </p>
                <p className="text-foreground/50 text-xs mt-0.5">
                  No contraindications detected yet
                </p>
              </div>
            )}
          </section>

          {/* ── Right column on 2xl / below meds on smaller ────── */}

          {/* Substance Use */}
          <section className="space-y-3">
            <SectionHeader title="Substance Use" label="Lifestyle Factors" />
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/70 mb-1.5">
                  Cannabis Use
                </label>
                <Select
                  value={substanceUse.cannabis}
                  onValueChange={(v) =>
                    v !== null &&
                    setSubstanceUse((s) => ({ ...s, cannabis: v }))
                  }
                >
                  <SelectTrigger className="bg-card border-foreground/10 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANNABIS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {substanceUse.cannabis === "daily" && (
                  <p className="text-[11px] text-tier-red font-semibold mt-1">Hard contraindication</p>
                )}
                {substanceUse.cannabis === "2_6_weekly" && (
                  <p className="text-[11px] text-tier-yellow mt-1">Soft (+1)</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/70 mb-1.5">
                  Alcohol Use
                </label>
                <Select
                  value={substanceUse.alcohol}
                  onValueChange={(v) =>
                    v !== null &&
                    setSubstanceUse((s) => ({ ...s, alcohol: v }))
                  }
                >
                  <SelectTrigger className="bg-card border-foreground/10 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALCOHOL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {substanceUse.alcohol === "daily" && (
                  <p className="text-[11px] text-tier-red font-semibold mt-1">Hard contraindication</p>
                )}
                {substanceUse.alcohol === "less_6_weekly" && (
                  <p className="text-[11px] text-tier-yellow mt-1">Soft (+1)</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/70 mb-1.5">
                  Hard Drug Use
                </label>
                <Select
                  value={substanceUse.hardDrugs}
                  onValueChange={(v) =>
                    v !== null &&
                    setSubstanceUse((s) => ({ ...s, hardDrugs: v }))
                  }
                >
                  <SelectTrigger className="bg-card border-foreground/10 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HARD_DRUG_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {substanceUse.hardDrugs === "yes" && (
                  <p className="text-[11px] text-tier-red font-semibold mt-1">Hard contraindication</p>
                )}
              </div>
            </div>
          </section>

          {/* Client Age */}
          <section className="space-y-3">
            <SectionHeader title="Client Age" label="Biometric Factor" />
            <div className="flex items-start gap-6">
              <p className="text-foreground/60 text-sm leading-relaxed max-w-xs hidden md:block">
                Age is a critical biometric marker for metabolic clearance rates
                of specific compounds.
              </p>
              <div className="flex items-baseline gap-3">
                <input
                  type="number"
                  placeholder="—"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min={0}
                  max={120}
                  className="w-20 bg-cream-warm border border-foreground/8 rounded-lg py-2.5 px-3 text-2xl font-serif text-foreground text-center outline-none focus:border-meadow focus:ring-1 focus:ring-meadow/20 transition-colors placeholder:text-foreground/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 leading-tight">
                  Years
                  <br />
                  Old
                </span>
              </div>
            </div>
            {age && parseInt(age) < 26 && (
              <p className="text-[11px] text-tier-yellow">
                Under 26: Soft contraindication (+1 point)
              </p>
            )}
            {age && parseInt(age) >= 80 && (
              <p className="text-[11px] text-tier-yellow">
                80 or older: Soft contraindication (+1 point)
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-6 pt-5 border-t border-foreground/8 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            {medications.length > 0 && !allFreqsSet && (
              <p className="text-xs text-tier-yellow italic mr-2">
                Set frequency for all medications
              </p>
            )}
            <button
              onClick={evaluate}
              disabled={!canEvaluate}
              className="px-8 py-2.5 bg-meadow text-white font-semibold text-sm rounded-lg hover:bg-meadow-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Evaluate Eligibility
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </main>
    </>
  );
}
