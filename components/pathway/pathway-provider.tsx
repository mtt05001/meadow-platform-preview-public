"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  INITIAL_PATHWAY_STATE,
  STEP_ROUTES,
  type PathwayState,
  type PathwayMedication,
  type PathwayOutcome,
} from "@/lib/pathway-types";
import { routePathway, isDisqualifiedAtStep } from "@/lib/pathway-routing";

type Action =
  | { type: "SET_EMAIL"; email: string }
  | { type: "SET_ANSWER"; field: string; value: unknown }
  | { type: "SET_BOOKING"; field: string; value: string }
  | { type: "SET_MEDICATIONS"; meds: PathwayMedication[] }
  | { type: "SET_NOTES"; notes: string }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_OUTCOME"; outcome: PathwayOutcome }
  | { type: "HYDRATE"; state: Partial<PathwayState> & { answers?: Partial<PathwayState["answers"]> } };

function reducer(state: PathwayState, action: Action): PathwayState {
  switch (action.type) {
    case "SET_EMAIL":
      return { ...state, answers: { ...state.answers, email: action.email } };
    case "SET_ANSWER":
      return { ...state, answers: { ...state.answers, [action.field]: action.value } };
    case "SET_BOOKING":
      return { ...state, booking: { ...state.booking, [action.field]: action.value } };
    case "SET_MEDICATIONS":
      return { ...state, medications: action.meds };
    case "SET_NOTES":
      return { ...state, additionalNotes: action.notes };
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_OUTCOME":
      return { ...state, routedOutcome: action.outcome };
    case "HYDRATE": {
      const merged = { ...state };
      if (action.state.currentStep != null) merged.currentStep = action.state.currentStep;
      if (action.state.routedOutcome != null) merged.routedOutcome = action.state.routedOutcome as PathwayOutcome;
      if (action.state.medications) merged.medications = action.state.medications;
      if (action.state.additionalNotes != null) merged.additionalNotes = action.state.additionalNotes;
      if (action.state.answers) {
        merged.answers = { ...merged.answers, ...action.state.answers };
      }
      if (action.state.booking) {
        merged.booking = { ...merged.booking, ...action.state.booking };
      }
      return merged;
    }
    default:
      return state;
  }
}

interface PathwayContextValue {
  state: PathwayState;
  dispatch: Dispatch<Action>;
  userId: string | null;
  saving: boolean;
  goToStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;
  saveStep: (fields: Record<string, unknown>) => Promise<void>;
}

const PathwayContext = createContext<PathwayContextValue | null>(null);

export function usePathway() {
  const ctx = useContext(PathwayContext);
  if (!ctx) throw new Error("usePathway must be used within PathwayProvider");
  return ctx;
}

export function PathwayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_PATHWAY_STATE);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetch(`/api/pathway/save?user_id=${data.user.id}`)
          .then((r) => r.json())
          .then(({ data: saved }) => {
            if (saved) {
              dispatch({
                type: "HYDRATE",
                state: {
                  currentStep: saved.current_step || 1,
                  routedOutcome: saved.routed_outcome,
                  medications: saved.medications || [],
                  additionalNotes: saved.additional_notes || "",
                  answers: {
                    email: saved.email || "",
                    primary_reason: saved.primary_reason,
                    readiness: saved.readiness,
                    medical_flags: saved.medical_flags || [],
                    psych_flags: saved.psych_flags || [],
                    can_travel: saved.can_travel,
                    financial_ready: saved.financial_ready,
                    best_case: saved.best_case,
                    attribution: saved.attribution,
                  },
                  booking: {
                    first_name: saved.first_name || "",
                    last_name: saved.last_name || "",
                    phone: saved.phone || "",
                    booking_id: saved.booking_id,
                  },
                },
              });
            }
            setHydrated(true);
          })
          .catch(() => setHydrated(true));
      } else {
        setHydrated(true);
      }
    });
  }, []);

  const saveStep = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!userId) return;
      setSaving(true);
      try {
        await fetch("/api/pathway/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, ...fields }),
        });
      } catch (e) {
        console.error("[pathway] save error:", e);
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  const goToStep = useCallback(
    (step: number) => {
      dispatch({ type: "SET_STEP", step });
      const route = STEP_ROUTES[step - 1];
      if (route) router.push(route);
    },
    [router],
  );

  const goNext = useCallback(() => {
    const next = state.currentStep + 1;
    if (next <= STEP_ROUTES.length) {
      goToStep(next);
    }
  }, [state.currentStep, goToStep]);

  const goBack = useCallback(() => {
    const prev = state.currentStep - 1;
    if (prev >= 1) {
      goToStep(prev);
    }
  }, [state.currentStep, goToStep]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#f5f1eb] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#1a4d2e]/20 border-t-[#1a4d2e]/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PathwayContext.Provider
      value={{ state, dispatch, userId, saving, goToStep, goNext, goBack, saveStep }}
    >
      {children}
    </PathwayContext.Provider>
  );
}
