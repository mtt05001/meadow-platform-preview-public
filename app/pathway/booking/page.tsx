"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";

export default function BookingPage() {
  const { state, dispatch, saveStep } = usePathway();
  const router = useRouter();
  const [firstName, setFirstName] = useState(state.booking.first_name);
  const [lastName, setLastName] = useState(state.booking.last_name);
  const [phone, setPhone] = useState(state.booking.phone);
  const [contactSaved, setContactSaved] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const calendarId = process.env.NEXT_PUBLIC_GHL_DISCOVERY_CALENDAR_ID || "";
  const email = state.answers.email;

  const handleSaveContact = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) return;
    setSaving(true);
    dispatch({ type: "SET_BOOKING", field: "first_name", value: firstName.trim() });
    dispatch({ type: "SET_BOOKING", field: "last_name", value: lastName.trim() });
    dispatch({ type: "SET_BOOKING", field: "phone", value: phone.trim() });
    await saveStep({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
    });
    setContactSaved(true);
    setSaving(false);
  };

  const handleBookingComplete = () => {
    router.push("/pathway/medications");
  };

  return (
    <div className="min-h-[calc(100dvh-4px)] flex flex-col bg-[#f5f1eb]">
      <div className="flex-1 flex flex-col items-center px-5 py-8">
        <div className="w-full max-w-lg">
          <p
            className="text-[11px] tracking-[0.35em] uppercase font-medium text-[#1a4d2e]/40 mb-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Almost there
          </p>
          <h1
            className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Book your discovery call
          </h1>
          <p
            className="text-[#1a4d2e]/55 text-[15px] leading-relaxed mb-8"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Based on your answers, the best next step is a 30-minute discovery call
            with our team. First, a few details so we can confirm your booking.
          </p>

          {!contactSaved ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-[#1a4d2e]/50 mb-1.5"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#e8e2d8] rounded-lg
                      focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
                      outline-none text-[14px] text-[#1a4d2e]"
                    style={{ fontFamily: "var(--font-sans)" }}
                    autoFocus
                  />
                </div>
                <div>
                  <label
                    className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-[#1a4d2e]/50 mb-1.5"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    Last name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#e8e2d8] rounded-lg
                      focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
                      outline-none text-[14px] text-[#1a4d2e]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-[#1a4d2e]/50 mb-1.5"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="w-full px-4 py-3 bg-white border border-[#e8e2d8] rounded-lg
                    focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
                    outline-none text-[14px] text-[#1a4d2e] placeholder:text-[#1a4d2e]/30"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
              </div>

              <div>
                <label
                  className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-[#1a4d2e]/50 mb-1.5"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full px-4 py-3 bg-[#f5f1eb] border border-[#e8e2d8] rounded-lg
                    text-[14px] text-[#1a4d2e]/60 cursor-not-allowed"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveContact}
                disabled={!firstName.trim() || !lastName.trim() || !phone.trim() || saving}
                className="w-full px-8 py-4 bg-[#1a4d2e] text-white text-[14px] font-semibold tracking-wide rounded-lg
                  hover:bg-[#2d7a4a] transition-colors duration-200 cursor-pointer
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Continue to calendar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-[#e8e2d8] rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium text-[#1a4d2e]">
                    {firstName} {lastName}
                  </p>
                  <p className="text-[12px] text-[#1a4d2e]/50">{email} &middot; {phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setContactSaved(false)}
                  className="text-[12px] text-[#1a4d2e]/40 hover:text-[#1a4d2e] transition-colors cursor-pointer"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Edit
                </button>
              </div>

              <p
                className="text-[13px] text-[#1a4d2e]/50 text-center"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Pick a time that works for you
              </p>

              <div className="relative bg-white border border-[#e8e2d8] rounded-lg overflow-hidden" style={{ minHeight: 500 }}>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#f5f1eb]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-5 h-5 border-2 border-[#1a4d2e]/20 border-t-[#1a4d2e]/60 rounded-full animate-spin" />
                      <span className="text-[#1a4d2e]/40 text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>
                        Loading calendar...
                      </span>
                    </div>
                  </div>
                )}
                {calendarId ? (
                  <iframe
                    src={`https://api.leadconnectorhq.com/widget/booking/${calendarId}`}
                    className={`w-full border-0 ${iframeLoaded ? "" : "invisible"}`}
                    style={{ height: 700 }}
                    onLoad={() => setIframeLoaded(true)}
                    title="Book a discovery call"
                  />
                ) : (
                  <div className="p-8 text-center text-[#1a4d2e]/50 text-[14px]">
                    Calendar not configured. Set GHL_DISCOVERY_CALENDAR_ID.
                  </div>
                )}
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleBookingComplete}
                  className="px-8 py-3 bg-[#1a4d2e] text-white text-[14px] font-semibold tracking-wide rounded-lg
                    hover:bg-[#2d7a4a] transition-colors duration-200 cursor-pointer"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  I&rsquo;ve booked my call
                </button>
                <p className="text-[12px] text-[#1a4d2e]/35 mt-2" style={{ fontFamily: "var(--font-sans)" }}>
                  Click after selecting a time above
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
