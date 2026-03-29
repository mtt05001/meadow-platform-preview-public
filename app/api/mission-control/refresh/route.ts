import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import { getClientCache } from "@/lib/db";
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
  };
}

export async function GET() {
  await auth.protect();

  try {
    // 1. Load enrichment data from Postgres client cache (synced by /api/clients/sync)
    const clientCache = await getClientCache();
    const contactIndex = new Map<string, ContactInfo>();
    if (clientCache) {
      for (const c of clientCache.clients) {
        if (c.contact_id) contactIndex.set(c.contact_id, clientToInfo(c));
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

    // 4. Fetch events from GHL calendars
    interface RawEvent {
      startTime?: string;
      contactId?: string;
      appointmentStatus?: string;
      title?: string;
      _calId: string;
    }
    const allEvents: RawEvent[] = [];
    await Promise.all(
      Object.keys(calMap).map(async (calId) => {
        try {
          const { events = [] } = (await ghl("/calendars/events", {
            locationId: LOCATION,
            calendarId: calId,
            startTime: String(startUtcMs),
            endTime: String(endUtcMs),
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

    // 5. Build days map — enrich from cached client data (no GHL calls)
    const daysMap: Record<string, McEvent[]> = {};
    for (const ev of allEvents) {
      if (!ev.startTime) continue;
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
      let etype = calMap[ev._calId]?.type || "Other";

      if (etype === "Room" && info.journey) {
        const jd = info.journey.slice(0, 10);
        if (eventDate < jd) etype = "In-Person Prep";
        else if (eventDate > jd) etype = "In-Person Integration";
      }
      const isPrep2 =
        etype === "Prep" &&
        !!info.prep1 &&
        !!info.prep2 &&
        eventDate === info.prep2.slice(0, 10);
      const isInteg2 =
        etype === "Integration" &&
        !!info.integ1 &&
        !!info.integ2 &&
        eventDate === info.integ2.slice(0, 10);

      const hiOk = ["Signed", "Reviewed"].includes(info.hi);
      const ohaOk = ["Signed", "Reviewed"].includes(info.oha);
      const isPrep1 = etype === "Prep" && !isPrep2;
      let status: "green" | "yellow" | "red";
      if (isPrep1) {
        status = hiOk ? "green" : "yellow";
      } else if (hiOk && ohaOk) {
        status = "green";
      } else if (
        ["Journey", "Room", "In-Person Prep", "In-Person Integration"].includes(
          etype,
        ) ||
        (etype === "Prep" && isPrep2)
      ) {
        status = ohaOk ? "yellow" : "red";
      } else if (etype === "Taper") {
        status = "green";
      } else {
        status = "yellow";
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

      const label =
        etype === "Prep"
          ? isPrep2
            ? "Prep 2"
            : "Prep 1"
          : etype === "Integration"
            ? isInteg2
              ? "Integration 2"
              : "Integration 1"
            : etype;

      if (!daysMap[dayKey]) daysMap[dayKey] = [];
      daysMap[dayKey].push({
        time: timeStr,
        sort_key: sortKey,
        type: label,
        name,
        facilitator: info.fac,
        hi: info.hi,
        oha: info.oha,
        status,
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
