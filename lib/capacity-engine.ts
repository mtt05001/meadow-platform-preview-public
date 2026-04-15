import { addDays, addWeeks, startOfWeek } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { STAGE_MAP } from "@/lib/ghl";

export const CAPACITY_TIMEZONE = "America/Los_Angeles";

/** Default weekly journey caps (overridable in DB). */
export const DEFAULT_FACILITATOR_CAPS: Record<string, number> = {
  "Evelyn Cushing": 2,
  "Nitai Aleksiewicz": 2,
  "Michael Kelly": 2,
  "Anne Harris": 1,
  "Laurent Picard": 1,
};

export type FacilitatorStatusBadge = "has_capacity" | "near_full" | "over_capacity" | "no_clients";

export interface CapacityOppInput {
  oppId: string;
  firstName: string;
  facilitator: string;
  stageId: string;
  journeyYmd: string | null;
}

export interface CapacitySnapshot {
  revalidatedAt: string;
  summary: {
    activePreJourneyTotal: number;
    journeysNext4Weeks: number;
    openSlotsNext4Weeks: number;
    facilitatorsAtOrOverCap: number;
  };
  routing: {
    names: string[];
    details: { name: string; used: number; total: number }[];
  };
  facilitators: {
    name: string;
    weekCap: number;
    activePreJourney: number;
    upcomingJourneys: number;
    nextJourneyYmd: string | null;
    badge: FacilitatorStatusBadge;
  }[];
  calendar: {
    weekStarts: string[];
    columns: string[];
    cells: { count: number; firstNames: string[]; tone: "green" | "amber" | "red" }[][];
  };
  flags: string[];
  /** Non-fatal messages (e.g. GHL env not set — UI shows empty data + banner). */
  warnings?: string[];
}

function stageBucket(stageId: string): "pre" | "post" | "complete" {
  const s = STAGE_MAP[stageId];
  if (!s) return "complete";
  if (s.order >= 1 && s.order <= 6) return "pre";
  if (s.group === "integration" || (s.order >= 7 && s.order <= 10)) return "post";
  return "complete";
}

/** Parse GHL journey field: epoch ms/s, ISO date, or M/D/YYYY → yyyy-MM-dd or null. */
export function parseJourneyYmd(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const mm = mdy[1].padStart(2, "0");
    const dd = mdy[2].padStart(2, "0");
    return `${mdy[3]}-${mm}-${dd}`;
  }
  return null;
}

function todayYmdPT(now: Date): string {
  return formatInTimeZone(now, CAPACITY_TIMEZONE, "yyyy-MM-dd");
}

/** Calendar add days using UTC noon anchor (stable yyyy-MM-dd). */
function ymdAddDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + delta, 12, 0, 0);
  return new Date(t).toISOString().slice(0, 10);
}

function ymdCmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function journeyInRange(j: string | null, start: string, endInclusive: string): boolean {
  if (!j) return false;
  return ymdCmp(j, start) >= 0 && ymdCmp(j, endInclusive) <= 0;
}

function getWeekStartsMondayPT(now: Date, count: number): string[] {
  const z = toZonedTime(now, CAPACITY_TIMEZONE);
  const mon = startOfWeek(z, { weekStartsOn: 1 });
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = addWeeks(mon, i);
    out.push(formatInTimeZone(d, CAPACITY_TIMEZONE, "yyyy-MM-dd"));
  }
  return out;
}

function defaultCapForName(name: string): number {
  if (DEFAULT_FACILITATOR_CAPS[name] != null) return DEFAULT_FACILITATOR_CAPS[name]!;
  return 2;
}

function orderedFacilitatorNames(opps: CapacityOppInput[]): string[] {
  const seen = new Set<string>();
  for (const o of opps) seen.add(o.facilitator || "Unassigned");
  const defaults = Object.keys(DEFAULT_FACILITATOR_CAPS);
  const extras = [...seen]
    .filter((n) => !DEFAULT_FACILITATOR_CAPS[n] && n !== "Unassigned")
    .sort((a, b) => a.localeCompare(b));
  const tail = seen.has("Unassigned") ? ["Unassigned"] : [];
  return [...defaults, ...extras, ...tail];
}

function mergeCaps(
  names: string[],
  db: Map<string, number>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of names) {
    const v = db.get(n);
    m.set(n, v != null ? v : defaultCapForName(n));
  }
  return m;
}

function badgeFor(active: number, cap: number, upcoming: number): FacilitatorStatusBadge {
  if (active === 0 && upcoming === 0) return "no_clients";
  if (active > cap) return "over_capacity";
  if (active === cap) return "near_full";
  if (cap > 1 && active >= Math.ceil(cap * 0.8)) return "near_full";
  return "has_capacity";
}

export function buildCapacitySnapshot(
  opps: CapacityOppInput[],
  dbCaps: Map<string, number>,
  now: Date = new Date(),
): CapacitySnapshot {
  const today = todayYmdPT(now);
  const fourWeekEnd = ymdAddDays(today, 27);
  const names = orderedFacilitatorNames(opps);
  const caps = mergeCaps(names, dbCaps);

  const activePreByFac = new Map<string, number>();
  const upcomingByFac = new Map<string, number>();
  const nextJourneyByFac = new Map<string, string | null>();
  const journeysIn4WeeksByFac = new Map<string, number>();

  for (const n of names) {
    activePreByFac.set(n, 0);
    upcomingByFac.set(n, 0);
    nextJourneyByFac.set(n, null);
    journeysIn4WeeksByFac.set(n, 0);
  }

  let activePreJourneyTotal = 0;
  let journeysNext4Weeks = 0;

  for (const o of opps) {
    const fac = o.facilitator || "Unassigned";

    const b = stageBucket(o.stageId);
    const j = o.journeyYmd;

    if (b === "pre" && (!j || ymdCmp(j, today) >= 0)) {
      const cur = activePreByFac.get(fac) ?? 0;
      activePreByFac.set(fac, cur + 1);
      activePreJourneyTotal += 1;
    }

    if (j && ymdCmp(j, today) >= 0) {
      const u = upcomingByFac.get(fac) ?? 0;
      upcomingByFac.set(fac, u + 1);
      const prev = nextJourneyByFac.get(fac);
      if (!prev || ymdCmp(j, prev) < 0) nextJourneyByFac.set(fac, j);
    }

    if (j && journeyInRange(j, today, fourWeekEnd)) {
      journeysNext4Weeks += 1;
      journeysIn4WeeksByFac.set(fac, (journeysIn4WeeksByFac.get(fac) ?? 0) + 1);
    }
  }

  let openSlotsNext4Weeks = 0;
  let facilitatorsAtOrOverCap = 0;
  const facRows: CapacitySnapshot["facilitators"] = [];

  for (const n of names) {
    const cap = caps.get(n) ?? 2;
    const active = activePreByFac.get(n) ?? 0;
    const upcoming = upcomingByFac.get(n) ?? 0;
    if (active >= cap) facilitatorsAtOrOverCap += 1;
    const used4 = journeysIn4WeeksByFac.get(n) ?? 0;
    openSlotsNext4Weeks += Math.max(0, 4 * cap - used4);
    facRows.push({
      name: n,
      weekCap: cap,
      activePreJourney: active,
      upcomingJourneys: upcoming,
      nextJourneyYmd: nextJourneyByFac.get(n) ?? null,
      badge: badgeFor(active, cap, upcoming),
    });
  }

  const routingDetails = names.map((name) => {
    const cap = caps.get(name) ?? 2;
    const used = journeysIn4WeeksByFac.get(name) ?? 0;
    return { name, used, total: 4 * cap };
  });
  routingDetails.sort((a, b) => a.used - b.used || a.name.localeCompare(b.name));
  const minUsed = routingDetails[0]?.used ?? 0;
  const routingNames = routingDetails.filter((r) => r.used === minUsed).map((r) => r.name);

  const weekStarts = getWeekStartsMondayPT(now, 10);
  const columns = [...names];
  const cells: CapacitySnapshot["calendar"]["cells"] = [];

  for (let wi = 0; wi < weekStarts.length; wi++) {
    const row: CapacitySnapshot["calendar"]["cells"][number] = [];
    const w0 = weekStarts[wi];
    const w1 = ymdAddDays(w0, 6);
    for (const col of columns) {
      const cap = caps.get(col) ?? 2;
      const firstNames: string[] = [];
      let count = 0;
      for (const o of opps) {
        if (o.facilitator !== col) continue;
        const j = o.journeyYmd;
        if (!j || !journeyInRange(j, w0, w1)) continue;
        count += 1;
        if (firstNames.length < 6) firstNames.push(o.firstName || "—");
      }
      let tone: "green" | "amber" | "red" = "green";
      if (count > cap) tone = "red";
      else if (count === cap) tone = "amber";
      row.push({ count, firstNames, tone });
    }
    cells.push(row);
  }

  const flags: string[] = [];
  for (const n of names) {
    const active = activePreByFac.get(n) ?? 0;
    const upcoming = upcomingByFac.get(n) ?? 0;
    if (active === 0 && upcoming === 0) flags.push(`${n} has no active pre-journey or upcoming journeys.`);
  }

  const cap = (n: string) => caps.get(n) ?? 2;
  for (let wi = 0; wi < weekStarts.length; wi++) {
    for (let ci = 0; ci < columns.length; ci++) {
      const c = cells[wi][ci];
      if (c.count > cap(columns[ci])) {
        flags.push(
          `${columns[ci]}: week of ${weekStarts[wi]} has ${c.count} journeys vs weekly cap ${cap(columns[ci])}.`,
        );
      }
    }
  }

  for (let ci = 0; ci < columns.length; ci++) {
    const n = columns[ci];
    const k = cap(n);
    let run = 0;
    let maxRun = 0;
    for (let wi = 0; wi < weekStarts.length; wi++) {
      if (cells[wi][ci].count > k) {
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else {
        run = 0;
      }
    }
    if (maxRun >= 3) flags.push(`${n} is over weekly journey cap for 3+ consecutive weeks.`);
  }

  return {
    revalidatedAt: now.toISOString(),
    summary: {
      activePreJourneyTotal,
      journeysNext4Weeks,
      openSlotsNext4Weeks,
      facilitatorsAtOrOverCap,
    },
    routing: { names: routingNames, details: routingDetails },
    facilitators: facRows,
    calendar: { weekStarts, columns, cells },
    flags: [...new Set(flags)],
  };
}
