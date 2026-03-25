"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

/* ---------- Types ---------- */

interface ScheduleCalendar {
  id: string;
  name: string;
  widgetSlug: string;
  isOpen: boolean;
}

interface FacilitatorEntry {
  userId: string;
  name: string;
  preApproved: ScheduleCalendar | null;
  open: ScheduleCalendar | null;
}

interface SessionType {
  type: string;
  directCalendar: ScheduleCalendar | null;
  facilitators: FacilitatorEntry[];
}

interface ScheduleData {
  sessionTypes: SessionType[];
}

/* ---------- Constants ---------- */

const AGE_KEY = "meadow_age_verified";

/* ---------- Small Components ---------- */

function AgeGate({ onVerified }: { onVerified: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a4d2e]">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px),
            radial-gradient(circle at 50% 80%, #fff 1px, transparent 1px)`,
          backgroundSize: "120px 120px, 80px 80px, 100px 100px",
        }}
      />
      <div className="relative text-center px-6 max-w-md">
        <p
          className="text-[#c8d8c0] tracking-[0.35em] uppercase text-[11px] font-medium mb-6"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Meadow Medicine
        </p>
        <h1
          className="text-white text-3xl sm:text-4xl leading-tight mb-4"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Schedule a Session
        </h1>
        <div className="w-8 h-px bg-[#c8d8c0]/40 mx-auto mb-8" />
        <p
          className="text-[#c8d8c0]/80 text-[15px] leading-relaxed mb-10"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          You must be 21 years or older to access our scheduling services.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onVerified}
            className="px-8 py-3 bg-white text-[#1a4d2e] text-[14px] font-semibold tracking-wide rounded-sm
              hover:bg-[#f5f1eb] transition-colors duration-200 cursor-pointer"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            I am 21 or older
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-8 py-3 border border-[#c8d8c0]/30 text-[#c8d8c0]/70 text-[14px] tracking-wide rounded-sm
              hover:border-[#c8d8c0]/50 hover:text-[#c8d8c0] transition-colors duration-200 cursor-pointer"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            I am under 21
          </button>
        </div>
      </div>
    </div>
  );
}

function StepLabel({
  number,
  label,
  active,
}: {
  number: number;
  label: string;
  active: boolean;
}) {
  return (
    <div className="mb-4">
      <span
        className={`text-[11px] tracking-[0.2em] uppercase font-medium ${
          active ? "text-[#1a4d2e]/50" : "text-[#1a4d2e]/25"
        }`}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Step {number}
      </span>
      <h2
        className={`text-lg mt-0.5 ${
          active ? "text-[#1a4d2e]" : "text-[#1a4d2e]/30"
        }`}
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {label}
      </h2>
    </div>
  );
}

function OptionButton({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 border rounded-sm transition-all duration-150 cursor-pointer ${
        selected
          ? "border-[#1a4d2e] bg-[#1a4d2e]/[0.04] shadow-[0_0_0_1px_#1a4d2e]"
          : "border-[#e8e2d8] bg-white hover:border-[#1a4d2e]/30"
      }`}
    >
      <span
        className="text-[#1a4d2e] text-[13px] font-medium"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {label}
      </span>
      {description && (
        <span
          className="block text-[#1a4d2e]/45 text-[12px] mt-0.5"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {description}
        </span>
      )}
    </button>
  );
}

function BookingView({
  calendar,
  onBack,
}: {
  calendar: ScheduleCalendar;
  onBack: () => void;
}) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      {/* Thin top bar with start over */}
      <div className="shrink-0 px-4 py-2 border-b border-[#e8e2d8] bg-[#f5f1eb] flex items-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[#1a4d2e]/60 hover:text-[#1a4d2e] text-[13px]
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
          Start over
        </button>
      </div>

      {/* Iframe fills remaining space */}
      {!iframeLoaded && (
        <div className="flex-1 flex items-center justify-center bg-[#f5f1eb]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#1a4d2e]/20 border-t-[#1a4d2e]/60 rounded-full animate-spin" />
            <span
              className="text-[#1a4d2e]/40 text-[13px]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Loading calendar...
            </span>
          </div>
        </div>
      )}
      <iframe
        src={`https://api.leadconnectorhq.com/widget/booking/${calendar.id}`}
        className={`w-full border-0 ${iframeLoaded ? "flex-1" : "hidden"}`}
        onLoad={() => setIframeLoaded(true)}
        title={`Book — ${calendar.name}`}
      />
    </div>
  );
}

/* ---------- Main Flow ---------- */

function ScheduleFlow() {
  const [selectedType, setSelectedType] = useState<SessionType | null>(null);
  const [selectedFacilitator, setSelectedFacilitator] =
    useState<FacilitatorEntry | null>(null);
  const [selectedMode, setSelectedMode] = useState<
    "preApproved" | "open" | null
  >(null);
  const [bookingCalendar, setBookingCalendar] =
    useState<ScheduleCalendar | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => apiFetch<ScheduleData>("/api/schedule"),
    staleTime: 5 * 60 * 1000,
  });

  const reset = useCallback(() => {
    setSelectedType(null);
    setSelectedFacilitator(null);
    setSelectedMode(null);
    setBookingCalendar(null);
  }, []);

  const handleTypeChange = useCallback((st: SessionType) => {
    setSelectedType(st);
    setSelectedFacilitator(null);
    setSelectedMode(null);
    setBookingCalendar(null);

    // If direct calendar (In-Person/Journey), go straight to booking
    if (st.directCalendar) {
      setBookingCalendar(st.directCalendar);
    }
  }, []);

  const handleFacilitatorChange = useCallback(
    (fac: FacilitatorEntry) => {
      if (fac.userId === selectedFacilitator?.userId) return;
      setSelectedFacilitator(fac);
      setSelectedMode(null);
      setBookingCalendar(null);
    },
    [selectedFacilitator],
  );

  const handleModeChange = useCallback(
    (mode: "preApproved" | "open") => {
      setSelectedMode(mode);
      if (!selectedFacilitator) return;
      const cal =
        mode === "preApproved"
          ? selectedFacilitator.preApproved
          : selectedFacilitator.open;
      if (cal) setBookingCalendar(cal);
    },
    [selectedFacilitator],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#1a4d2e]/20 border-t-[#1a4d2e]/60 rounded-full animate-spin" />
          <span
            className="text-[#1a4d2e]/40 text-[13px]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (bookingCalendar) {
    return <BookingView calendar={bookingCalendar} onBack={reset} />;
  }

  const sessionTypes = data?.sessionTypes || [];
  const needsFacilitator =
    selectedType && !selectedType.directCalendar && selectedType.facilitators.length > 0;

  // Current step number for facilitator/mode (shifts based on whether facilitator step exists)
  const facilitatorStepNum = 2;
  const modeStepNum = needsFacilitator ? 3 : 2;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Step 1: Session Type */}
      <section>
        <StepLabel number={1} label="Session Type" active />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {sessionTypes.map((st) => (
            <OptionButton
              key={st.type}
              label={st.type}
              selected={selectedType?.type === st.type}
              onClick={() => handleTypeChange(st)}
            />
          ))}
        </div>
      </section>

      {/* Step 2: Facilitator (only for facilitator-based session types) */}
      {needsFacilitator && (
        <section>
          <StepLabel
            number={facilitatorStepNum}
            label="Facilitator"
            active={!!selectedType}
          />
          <select
            value={selectedFacilitator?.userId || ""}
            onChange={(e) => {
              const fac = selectedType!.facilitators.find(
                (f) => f.userId === e.target.value,
              );
              if (fac) handleFacilitatorChange(fac);
            }}
            className="w-full px-4 py-3 bg-white border border-[#e8e2d8] rounded-sm text-[14px] text-[#1a4d2e]
              focus:outline-none focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
              appearance-none cursor-pointer"
            style={{
              fontFamily: "var(--font-sans)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%231a4d2e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 16px center",
            }}
          >
            <option value="">Select a facilitator</option>
            {selectedType!.facilitators.map((fac) => (
              <option key={fac.userId} value={fac.userId}>
                {fac.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* Step 3 (or 2): Scheduling Mode */}
      {needsFacilitator && selectedFacilitator && (
        <section>
          <StepLabel
            number={modeStepNum}
            label="Scheduling Mode"
            active={!!selectedFacilitator}
          />
          <div className="space-y-2.5">
            {selectedFacilitator.preApproved && (
              <OptionButton
                label="Pre-Approved Availability"
                description="Select from pre-approved time slots"
                selected={selectedMode === "preApproved"}
                onClick={() => handleModeChange("preApproved")}
              />
            )}
            {selectedFacilitator.open && (
              <OptionButton
                label="Open Availability"
                description="View all available times 24/7"
                selected={selectedMode === "open"}
                onClick={() => handleModeChange("open")}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function SchedulePage() {
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setAgeVerified(sessionStorage.getItem(AGE_KEY) === "true");
  }, []);

  const handleVerified = useCallback(() => {
    sessionStorage.setItem(AGE_KEY, "true");
    setAgeVerified(true);
  }, []);

  if (ageVerified === null) return null;

  if (!ageVerified) {
    return <AgeGate onVerified={handleVerified} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f1eb] flex flex-col">
      <header className="border-b border-[#e8e2d8] bg-[#f5f1eb]">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <p
            className="text-[#1a4d2e] text-[11px] tracking-[0.3em] uppercase font-medium"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Meadow Medicine
          </p>
          <h1
            className="text-[#1a4d2e] text-2xl mt-1"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Schedule a Session
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        <ScheduleFlow />
      </main>

      <footer className="border-t border-[#e8e2d8]">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <p
            className="text-[#1a4d2e]/30 text-[12px] tracking-wide"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Meadow Medicine &middot; Portland, Oregon
          </p>
        </div>
      </footer>
    </div>
  );
}
