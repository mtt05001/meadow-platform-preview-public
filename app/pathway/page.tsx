"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathway } from "@/components/pathway/pathway-provider";
import { isPathwayDemo } from "@/lib/pathway-demo";
import { STEP_ROUTES } from "@/lib/pathway-types";

type Phase = "email" | "otp";

export default function PathwayEmailPage() {
  const { state, dispatch, goNext, saveStep } = usePathway();
  const router = useRouter();
  const demo = isPathwayDemo();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (demo && state.currentStep > 1) {
      const route = STEP_ROUTES[state.currentStep - 1];
      if (route) router.replace(route);
    }
  }, [demo, state.currentStep, router]);

  useEffect(() => {
    if (state.answers.email) setEmail(state.answers.email);
  }, [state.answers.email]);

  const handleEmailSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (demo) {
      dispatch({ type: "SET_EMAIL", email: trimmed });
      dispatch({ type: "SET_STEP", step: 2 });
      goNext();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });

      if (otpError) {
        setError(otpError.message);
        setLoading(false);
        return;
      }

      dispatch({ type: "SET_EMAIL", email: trimmed });
      setPhase("otp");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    if (val && !/^\d$/.test(val)) return;

    const next = [...otp];
    next[idx] = val;
    setOtp(next);

    if (val && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }

    if (next.every((d) => d !== "")) {
      verifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const digits = pasted.split("");
      setOtp(digits);
      verifyOtp(pasted);
    }
  };

  const verifyOtp = async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });

      if (verifyError) {
        setError("Invalid code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      if (data.user) {
        await fetch("/api/pathway/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            user_id: data.user.id,
          }),
        });

        await saveStep({ current_step: 2 });
        dispatch({ type: "SET_STEP", step: 2 });
        goNext();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setLoading(true);
    setError("");
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      setError("Code resent. Check your inbox.");
    } catch {
      setError("Failed to resend. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase === "otp") {
      otpRefs.current[0]?.focus();
    }
  }, [phase]);

  if (phase === "otp") {
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
              className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-3"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Check your email
            </h1>
            <p
              className="text-[#1a4d2e]/55 text-[15px] leading-relaxed mb-8"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-[#1a4d2e]">{email}</span>
            </p>

            <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-semibold text-[#1a4d2e]
                    bg-white border-2 border-[#e8e2d8] rounded-lg
                    focus:border-[#1a4d2e] focus:ring-1 focus:ring-[#1a4d2e]/20
                    outline-none transition-colors"
                  style={{ fontFamily: "var(--font-sans)" }}
                  disabled={loading}
                />
              ))}
            </div>

            {error && (
              <p
                className={`text-[13px] mb-4 ${error.includes("resent") ? "text-[#1a4d2e]/60" : "text-red-600"}`}
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {error}
              </p>
            )}

            {loading && (
              <div className="flex justify-center mb-4">
                <div className="w-5 h-5 border-2 border-[#1a4d2e]/20 border-t-[#1a4d2e]/60 rounded-full animate-spin" />
              </div>
            )}

            <div className="flex justify-center gap-6 text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>
              <button
                type="button"
                onClick={resendCode}
                disabled={loading}
                className="text-[#1a4d2e]/50 hover:text-[#1a4d2e] transition-colors cursor-pointer disabled:opacity-40"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setPhase("email"); setOtp(["", "", "", "", "", ""]); setError(""); }}
                className="text-[#1a4d2e]/50 hover:text-[#1a4d2e] transition-colors cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4px)] flex flex-col bg-[#f5f1eb]">
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <p
            className="text-[11px] tracking-[0.35em] uppercase font-medium text-[#1a4d2e]/40 mb-6"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Meadow Medicine
          </p>
          <h1
            className="text-[#1a4d2e] text-2xl sm:text-3xl leading-snug mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Let&rsquo;s figure out if Meadow is right for you
          </h1>
          <p
            className="text-[#1a4d2e]/55 text-[15px] leading-relaxed mb-8"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            This takes about 3 minutes. We&rsquo;ll start with your email so we can
            save your progress.
          </p>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              className="w-full px-5 py-4 bg-white border border-[#e8e2d8] rounded-lg
                focus:border-[#1a4d2e]/40 focus:ring-1 focus:ring-[#1a4d2e]/10
                outline-none text-[16px] text-[#1a4d2e] placeholder:text-[#1a4d2e]/30"
              style={{ fontFamily: "var(--font-sans)" }}
              autoFocus
              disabled={loading}
            />

            {error && (
              <p className="text-red-600 text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleEmailSubmit}
              disabled={loading || !email.trim()}
              className="w-full px-8 py-4 bg-[#1a4d2e] text-white text-[15px] font-semibold tracking-wide rounded-lg
                hover:bg-[#2d7a4a] transition-colors duration-200 cursor-pointer
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Continue
            </button>
          </div>

          <p
            className="text-[#1a4d2e]/30 text-[12px] mt-6 text-center leading-relaxed"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {demo ? (
              <>
                Demo: no email is sent. Enter any address to continue the preview.
              </>
            ) : (
              <>
                We&rsquo;ll send a verification code to confirm your email.
                <br />
                Your information is kept confidential.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
