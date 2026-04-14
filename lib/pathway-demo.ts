import { INITIAL_PATHWAY_STATE, type PathwayState } from "./pathway-types";

/** Stable fake user id for demo persistence (never sent to production APIs). */
export const PATHWAY_DEMO_USER_ID = "00000000-0000-4000-a000-000000000001";

const STORAGE_KEY = "meadow_pathway_demo_v1";

/** True when pathway should skip Supabase OTP and server APIs (demo flag, or no Supabase configured). */
export function isPathwayDemo(): boolean {
  if (process.env.NEXT_PUBLIC_PATHWAY_DEMO === "true") return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) return true;
  return false;
}

function mergePathwayState(saved: Partial<PathwayState>): PathwayState {
  return {
    ...INITIAL_PATHWAY_STATE,
    ...saved,
    answers: { ...INITIAL_PATHWAY_STATE.answers, ...saved.answers },
    booking: { ...INITIAL_PATHWAY_STATE.booking, ...saved.booking },
    medications: Array.isArray(saved.medications) ? saved.medications : INITIAL_PATHWAY_STATE.medications,
  };
}

export function loadDemoPathwayState(): PathwayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PathwayState>;
    if (!parsed || typeof parsed !== "object") return null;
    return mergePathwayState(parsed);
  } catch {
    return null;
  }
}

export function saveDemoPathwayState(state: PathwayState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode
  }
}

export function clearDemoPathwayState(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function initPathwayStateForEnv(): PathwayState {
  if (typeof window === "undefined") return INITIAL_PATHWAY_STATE;
  if (!isPathwayDemo()) return INITIAL_PATHWAY_STATE;
  return loadDemoPathwayState() ?? INITIAL_PATHWAY_STATE;
}
