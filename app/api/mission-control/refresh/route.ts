import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { getClientCache, getMedicallyComplexMap } from "@/lib/db";
import { ghlFetch } from "@/lib/ghl";
import type { Client } from "@/lib/types";
import type { McData, McEvent, McAlert } from "@/lib/mission-control-types";

export const dynamic = "force-dynamic";

// GHL IDs
const LOCATION = "A4AjOJ6RQgzEHxtmZsOr";
const GEN_GROUP = "FHsE7quFyn9m6GLUBFIL";
const SKIP_KW = ["discovery", "consult", "personal", "hold"];
const TYPE_KW: Record<string, string[]> = {
  Journey: ["journey"],
  Room: ["room", "in-person"],
  Prep: ["prep"],
  Integration: ["integration"],
};
const PT_TZ = "America/Los_Angeles";

async function ghl(path: string, params?: Record<string, string>) {
  const url = params
    ? `${path}?${new URLSearchParams(params)}`
    : path;
  return ghlFetch(url) as Promise<Record<string, unknown>>;
}

interface ContactInfo {
  name: string;
  hi: string;
  oha: string;
  fac: string | null;
  prep1: string;
  prep2: string;
  journey: string;
  integ1: string;
  integ2: string;
  program: string;
}

const DEFAULT_INFO: ContactInfo = {
  name: "Unknown",
  hi: "None",
  oha: "None",
  fac: null,
  prep1: "",
  prep2: "",
  journey: "",
  integ1: "",
  integ2: "",
  program: "",
};

/** Convert a cached Client record into ContactInfo for event enrichment. */
function clientToInfo(c: Client): ContactInfo {
  return {
    name: c.name || "Unknown",
    hi: c.hi_status || "None",
    oha: c.oha_status || "None",
    fac: c.facilitator || null,
    prep1: c.prep1 || "",
    prep2: c.prep2 || "",
    journey: c.journey || "",
    integ1: c.integ1 || "",
    integ2: c.integ2 || "",
    program: c.program || "",
  };
}

interface RawEvent {
  startTime?: string;
  contactId?: string;
  appointmentStatus?: string;
  title?: string;
  _calId: string;
}

type EventBuckets = Record<string, RawEvent[]>;

/**
 * Label a Prep or Integration event by its position within the contact's
 * journey cycle. Each "cycle" is bounded by Journey events on the calendar.
 *   - Integration N: Nth integration after the most recent journey
 *   - Prep N:        Nth prep before the next upcoming journey
 *
 * `buckets[type]` must be sorted chronologically (ascending).
 */
function labelChronological(
  ev: RawEvent,
  type: "Prep" | "Integration",
  buckets: EventBuckets,
): string {
  const journeys = buckets.Journey || [];
  const sameType = buckets[type] || [];
  const evMs = new Date(ev.startTime!).getTime();

  if (type === "Integration") {
    // Most recent journey at or before this event = cycle lower bound
    const prevJourney = [...journeys]
      .reverse()
      .find((j) => new Date(j.startTime!).getTime() <= evMs);
    const prevMs = prevJourney
      ? new Date(prevJourney.startTime!).getTime()
      : -Infinity;
    // Next journey strictly after = cycle upper bound
    const nextJourney = journeys.find(
      (j) => new Date(j.startTime!).getTime() > evMs,
    );
    const nextMs = nextJourney
      ? new Date(nextJourney.startTime!).getTime()
      : Infinity;
    const cycleEvents = sameType.filter((e) => {
      const t = new Date(e.startTime!).getTime();
      return t >= prevMs && t < nextMs;
    });
    const idx = cycleEvents.indexOf(ev);
    return `${type} ${idx + 1}`;
  } else {
    // Prep: associate with the next upcoming journey (its cycle)
    const nextJourney = journeys.find(
      (j) => new Date(j.startTime!).getTime() >= evMs,
    );
    const nextMs = nextJourney
      ? new Date(nextJourney.startTime!).getTime()
      : Infinity;
    const prevJourney = [...journeys]
      .reverse()
      .find((j) => new Date(j.startTime!).getTime() < evMs);
    const prevMs = prevJourney
      ? new Date(prevJourney.startTime!).getTime()
      : -Infinity;
    const cycleEvents = sameType.filter((e) => {
      const t = new Date(e.startTime!).getTime();
      return t > prevMs && t <= nextMs;
    });
    const idx = cycleEvents.indexOf(ev);
    return `${type} ${idx + 1}`;
  }
}

/**
 * Label a Room event as In-Person Prep or In-Person Integration based on its
 * position relative to the closest journey. Falls back to the journey field
 * from the contact's GHL opportunity when no journey appointment exists on
 * the calendar (handles cases like Norman Rose where the journey only lives
 * in the field).
 */
function labelRoomHybrid(
  ev: RawEvent,
  buckets: EventBuckets,
  fallbackJourney: string,
  eventDateYmd: string,
): string {
  const journeys = buckets.Journey || [];
  const evMs = new Date(ev.startTime!).getTime();

  if (journeys.length > 0) {
    let closest = journeys[0];
    let closestDelta = Math.abs(
      new Date(closest.startTime!).getTime() - evMs,
    );
    for (const j of journeys) {
      const d = Math.abs(new Date(j.startTime!).getTime() - evMs);
      if (d < closestDelta) {
        closest = j;
        closestDelta = d;
      }
    }
    const closestMs = new Date(closest.startTime!).getTime();
    if (evMs < closestMs) return "In-Person Prep";
    if (evMs > closestMs) return "In-Person Integration";
    return "Room";
  }

  // Fallback: contact has no journey appointment on the calendar — use the
  // journey date from the opportunity custom field if available.
  if (fallbackJourney) {
    const jd = fallbackJourney.slice(0, 10);
    if (eventDateYmd < jd) return "In-Person Prep";
    if (eventDateYmd > jd) return "In-Person Integration";
  }
  return "Room";
}

export async function GET() {
  await auth.protect();

  try {
    // 1. Load enrichment data from Postgres client cache (synced by /api/clients/sync)
    const clientCache = await getClientCache();
    const medicallyComplexMap = await getMedicallyComplexMap();
    // When a contact has multiple opportunities, prefer the one with the most
    // journey-related data populated. Otherwise the Map would silently overwrite
    // with whichever opp comes last, which can pick a stale/wrong record.
    const contactIndex = new Map<string, ContactInfo>();
    const score = (i: ContactInfo) =>
      [i.journey, i.prep1, i.prep2, i.integ1, i.integ2].filter(Boolean).length;
    if (clientCache) {
      for (const c of clientCache.clients) {
        if (!c.contact_id) continue;
        const info = clientToInfo(c);
        const existing = contactIndex.get(c.contact_id);
        if (!existing || score(info) > score(existing)) {
          contactIndex.set(c.contact_id, info);
        }
      }
    }

    // 2. Compute 7-day window in PT
    const ptMidnight = new Date(
      new Date().toLocaleString("en-US", { timeZone: PT_TZ }),
    );
    ptMidnight.setHours(0, 0, 0, 0);
    const offsetMs =
      new Date().getTime() -
      new Date(
        new Date().toLocaleString("en-US", { timeZone: PT_TZ }),
      ).getTime();
    const startUtcMs = ptMidnight.getTime() + offsetMs;
    const endUtcMs = startUtcMs + 7 * 24 * 60 * 60 * 1000;

    // 3. Fetch calendars from GHL
    const { calendars = [] } = (await ghl("/calendars/", {
      locationId: LOCATION,
    })) as { calendars?: Record<string, unknown>[] };
    const calMap: Record<string, { type: string }> = {};
    for (const c of calendars) {
      const name = String(c.name || "").toLowerCase();
      if (c.groupId === GEN_GROUP) {
        calMap[c.id as string] = { type: "Taper" };
        continue;
      }
      if (SKIP_KW.some((k) => name.includes(k))) continue;
      for (const [t, kws] of Object.entries(TYPE_KW)) {
        if (kws.some((k) => name.includes(k))) {
          calMap[c.id as string] = { type: t };
          break;
        }
      }
    }

    // 4. Fetch events from GHL calendars.
    //
    // Calendars whose events need chronological context (Journey/Room/Prep/
    // Integration) are fetched in a wider ±180 day window so we can correctly
    // partition each contact's prep/integration cycles around their journeys.
    // Other calendar types (Taper, etc.) are fetched only in the 7-day display
    // window since they don't need chronological history.
    const widenedTypes = new Set(["Journey", "Room", "Prep", "Integration"]);
    const widenedStartMs = startUtcMs - 180 * 24 * 60 * 60 * 1000;
    const widenedEndMs = endUtcMs + 180 * 24 * 60 * 60 * 1000;

    const allEvents: RawEvent[] = [];
    await Promise.all(
      Object.entries(calMap).map(async ([calId, meta]) => {
        const widened = widenedTypes.has(meta.type);
        try {
          const { events = [] } = (await ghl("/calendars/events", {
            locationId: LOCATION,
            calendarId: calId,
            startTime: String(widened ? widenedStartMs : startUtcMs),
            endTime: String(widened ? widenedEndMs : endUtcMs),
          })) as { events?: Record<string, unknown>[] };
          for (const e of events) {
            const s = String(e.appointmentStatus || "").toLowerCase();
            if (s === "cancelled" || s === "canceled") continue;
            allEvents.push({ ...(e as unknown as RawEvent), _calId: calId });
          }
        } catch {
          // skip calendar on error
        }
      }),
    );

    // 4b. Build per-contact event index (sorted chronologically per type) for
    // chronological labeling. Includes all fetched events, even those outside
    // the 7-day display window — they're needed to determine cycle position.
    const eventsByContact = new Map<string, EventBuckets>();
    for (const ev of allEvents) {
      if (!ev.contactId || !ev.startTime) continue;
      const meta = calMap[ev._calId];
      if (!meta) continue;
      if (!eventsByContact.has(ev.contactId))
        eventsByContact.set(ev.contactId, {});
      const buckets = eventsByContact.get(ev.contactId)!;
      if (!buckets[meta.type]) buckets[meta.type] = [];
      buckets[meta.type].push(ev);
    }
    for (const buckets of eventsByContact.values()) {
      for (const t of Object.keys(buckets)) {
        buckets[t].sort(
          (a, b) =>
            new Date(a.startTime!).getTime() -
            new Date(b.startTime!).getTime(),
        );
      }
    }

    // 5. Build days map — only events within the 7-day display window get
    // returned. Labels come from chronological position (using the wider per-
    // contact event history fetched above), not from stale opportunity fields.
    const daysMap: Record<string, McEvent[]> = {};
    for (const ev of allEvents) {
      if (!ev.startTime) continue;
      const evMs = new Date(ev.startTime).getTime();
      // Skip events outside the 7-day display window
      if (evMs < startUtcMs || evMs >= endUtcMs) continue;

      const dt = new Date(ev.startTime);
      const info = ev.contactId
        ? contactIndex.get(ev.contactId) ?? { ...DEFAULT_INFO }
        : { ...DEFAULT_INFO };

      let name = info.name;
      if (name === "Unknown" && ev.title) {
        const parts = ev.title.split("|");
        const fb = (parts[parts.length - 1] || "").trim();
        if (
          fb &&
          !["prep", "journey", "room", "integration", "meadow"].some((k) =>
            fb.toLowerCase().includes(k),
          )
        )
          name = fb;
      }
      if (name === "Unknown") continue;

      const eventDate = dt.toLocaleDateString("en-CA", { timeZone: PT_TZ });
      const calType = calMap[ev._calId]?.type || "Other";
      const buckets = ev.contactId
        ? eventsByContact.get(ev.contactId) ?? {}
        : {};

      // Compute the display label using chronological logic (not stale fields)
      let label: string;
      if (calType === "Prep" || calType === "Integration") {
        label = labelChronological(ev, calType, buckets);
      } else if (calType === "Room") {
        label = labelRoomHybrid(ev, buckets, info.journey, eventDate);
      } else if (calType === "Taper") {
        // Taper calendar groups many appointment types — show the actual title
        label = (ev.title || "").split("|")[0]?.trim() || "Taper";
      } else {
        label = calType;
      }

      // Determine which docs are needed per appointment type:
      //   Prep 1: only HI needed (OHA not yet required)
      //   Taper: neither needed
      //   Everything else: both HI and OHA needed
      const isPrep1 = label === "Prep 1";
      const isTaper = calType === "Taper";
      const hiNeeded = !isTaper;
      const ohaNeeded = !isTaper && !isPrep1;

      const hiOk = info.hi === "Reviewed";
      const ohaOk = ["Signed", "Reviewed"].includes(info.oha);
      // Only two states: Ready (green) or Missing (red).
      let status: "green" | "red";
      if (isTaper) {
        status = "green";
      } else if (isPrep1) {
        status = hiOk ? "green" : "red";
      } else {
        status = hiOk && ohaOk ? "green" : "red";
      }

      const dayKey = dt.toLocaleDateString("en-US", {
        timeZone: PT_TZ,
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const timeStr = dt
        .toLocaleTimeString("en-US", {
          timeZone: PT_TZ,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(/\s/g, "");
      const sortKey = dt.toLocaleTimeString("en-US", {
        timeZone: PT_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      if (!daysMap[dayKey]) daysMap[dayKey] = [];
      const medicallyComplex = ev.contactId
        ? medicallyComplexMap.get(ev.contactId) === "Yes"
        : false;
      daysMap[dayKey].push({
        time: timeStr,
        sort_key: sortKey,
        type: label,
        name,
        facilitator: info.fac,
        journey: info.journey,
        hi: info.hi,
        oha: info.oha,
        hi_needed: hiNeeded,
        oha_needed: ohaNeeded,
        program: info.program,
        status,
        medically_complex: medicallyComplex,
      });
    }

    const daysList = Object.entries(daysMap)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => a.sort_key.localeCompare(b.sort_key)),
      }));

    const flat = daysList.flatMap((d) => d.events);
    const alerts: McAlert[] = flat
      .filter((e) => e.status === "red")
      .map((e) => ({ name: e.name, type: e.type, issue: "Missing HI or OHA" }));

    const result: McData = {
      generated: new Date().toISOString(),
      stats: {
        journeys: flat.filter((e) => e.type === "Journey").length,
        rooms: flat.filter((e) =>
          ["Room", "In-Person Prep", "In-Person Integration"].includes(e.type),
        ).length,
        preps: flat.filter((e) => e.type.includes("Prep")).length,
        integration: flat.filter((e) => e.type.includes("Integration")).length,
        alerts: alerts.length,
        total: flat.length,
      },
      days: daysList,
      alerts,
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("mission-control refresh error:", err);
    return apiError(getErrorMessage(err));
  }
}
