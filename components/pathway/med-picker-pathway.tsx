"use client";

import { useState, useMemo, useRef } from "react";
import {
  MEDICATION_DATABASE,
  type Medication,
} from "@/lib/medication-data";
import { MED_DURATION_OPTIONS, type PathwayMedication } from "@/lib/pathway-types";

const MED_GROUPS: { label: string; types: string[] }[] = [
  { label: "SSRIs", types: ["ssri"] },
  { label: "SNRIs", types: ["snri"] },
  { label: "Benzodiazepines", types: ["benzodiazepine"] },
  { label: "Sleep Medications", types: ["sleep_med"] },
  { label: "Stimulants", types: ["stimulant"] },
  { label: "Antipsychotics", types: ["antipsychotic"] },
  { label: "Mood Stabilizers", types: ["mood_stabilizer"] },
  { label: "MAOIs", types: ["maoi"] },
  { label: "TCAs", types: ["tca"] },
  { label: "Anxiolytics", types: ["anxiolytic"] },
  { label: "Antidepressants", types: ["antidepressant"] },
  { label: "Opioids", types: ["opioid"] },
  { label: "Other", types: ["other"] },
];

interface MedPickerPathwayProps {
  medications: PathwayMedication[];
  onChange: (meds: PathwayMedication[]) => void;
}

export function MedPickerPathway({ medications, onChange }: MedPickerPathwayProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedNames = useMemo(
    () => new Set(medications.map((m) => m.name.toLowerCase())),
    [medications],
  );

  const available = useMemo(
    () => MEDICATION_DATABASE.filter((m) => !selectedNames.has(m.name.toLowerCase())),
    [selectedNames],
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

  const isSearching = query.length > 0;

  const addMed = (name: string, isCustom: boolean) => {
    onChange([
      ...medications,
      { name, dosage: "", duration: "", isCustom },
    ]);
    setQuery("");
    setOpen(false);
    setCustomMode(false);
    setCustomName("");
    inputRef.current?.focus();
  };

  const pickDb = (m: Medication) => {
    const display = m.brandNames.length > 0 ? `${m.name} (${m.brandNames[0]})` : m.name;
    addMed(display, false);
  };

  const updateMed = (idx: number, field: keyof PathwayMedication, value: string) => {
    const updated = [...medications];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const removeMed = (idx: number) => {
    onChange(medications.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search medications or type to add..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setCustomMode(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          className="w-full px-4 py-3 bg-white border border-[#e8e2d8] rounded-lg
            focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
            outline-none text-[14px] text-[#1a4d2e] placeholder:text-[#1a4d2e]/35"
          style={{ fontFamily: "var(--font-sans)" }}
        />

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-[#e8e2d8] rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {isSearching ? (
              <>
                {filtered.slice(0, 10).map((med) => (
                  <button
                    key={med.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickDb(med)}
                    className="w-full px-4 py-2.5 text-left text-[14px] hover:bg-[#f5f1eb] transition-colors"
                  >
                    <span className="font-medium text-[#1a4d2e]">{med.name}</span>
                    {med.brandNames.length > 0 && (
                      <span className="text-[#1a4d2e]/40 ml-1.5 text-[12px]">
                        ({med.brandNames.join(", ")})
                      </span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addMed(query.trim(), true)}
                    className="w-full px-4 py-3 text-left text-[14px] hover:bg-[#f5f1eb] transition-colors"
                  >
                    <span className="text-[#1a4d2e]/60">
                      Add &ldquo;{query.trim()}&rdquo; as custom medication
                    </span>
                  </button>
                )}
              </>
            ) : (
              MED_GROUPS.map((group) => {
                const meds = available.filter((m) => group.types.includes(m.type));
                if (meds.length === 0) return null;
                return (
                  <div key={group.label}>
                    <div className="px-4 py-1.5 bg-[#f5f1eb] text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a4d2e]/40 sticky top-0">
                      {group.label}
                    </div>
                    {meds.map((med) => (
                      <button
                        key={med.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickDb(med)}
                        className="w-full px-4 py-2 text-left text-[14px] hover:bg-[#f5f1eb]/50 transition-colors"
                      >
                        <span className="font-medium text-[#1a4d2e]">{med.name}</span>
                        {med.brandNames.length > 0 && (
                          <span className="text-[#1a4d2e]/40 ml-1.5 text-[12px]">
                            ({med.brandNames.join(", ")})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {medications.length > 0 && (
        <div className="space-y-3">
          {medications.map((med, i) => (
            <div
              key={`${med.name}-${i}`}
              className="bg-white border border-[#e8e2d8] rounded-lg px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span className="font-medium text-[14px] text-[#1a4d2e]">{med.name}</span>
                  {med.isCustom && (
                    <span className="text-[10px] ml-2 text-[#1a4d2e]/40 uppercase tracking-wider">
                      Custom
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeMed(i)}
                  className="text-[#1a4d2e]/25 hover:text-[#1a4d2e] p-1 rounded transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Dosage (optional)"
                  value={med.dosage}
                  onChange={(e) => updateMed(i, "dosage", e.target.value)}
                  className="px-3 py-2 bg-[#f5f1eb] border border-[#e8e2d8] rounded text-[13px] text-[#1a4d2e]
                    placeholder:text-[#1a4d2e]/30 outline-none focus:border-[#1a4d2e]/30"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
                <select
                  value={med.duration}
                  onChange={(e) => updateMed(i, "duration", e.target.value)}
                  className="px-3 py-2 bg-[#f5f1eb] border border-[#e8e2d8] rounded text-[13px] text-[#1a4d2e]
                    outline-none focus:border-[#1a4d2e]/30 appearance-none cursor-pointer"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <option value="">How long?</option>
                  {MED_DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {medications.length === 0 && (
        <p
          className="text-center text-[#1a4d2e]/35 text-[13px] py-4"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Search above to add your current medications, or skip if you&rsquo;re not taking any.
        </p>
      )}
    </div>
  );
}
