import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { apiError, getErrorMessage } from "@/lib/api-utils";
import type { McData, McEvent, McAlert } from "@/lib/mission-control-types";

// GHL IDs
const LOCATION = "A4AjOJ6RQgzEHxtmZsOr";
const GEN_GROUP = "FHsE7quFyn9m6GLUBFIL";
const HI_CONTACT = "IzVEbjIlClmItowjxpwX";
const HI_OPP = "JD7nHdPbcHWnEh2OEhhI";
const OHA_OPP = "onZ8dloJ0Ho6JQpCt8PI";
const FAC_OPP = "H4LM6jbUwR1woLSj2kzV";
const OPP_FIELD = "V3QWXD7XKmXoKd9j7HnE";
const JOURNEY_PIPELINE = "b1raXFqNeALdRrsQwPD5";
const PREP1 = "47Nj5tCxZy6Zhze9m9c8";
const PREP2 = "RHZA1YmoHFAJlAbYrLvw";
const INTEG1 = "DkOFs5E0bvSEw9NkAYyv";
const INTEG2 = "vCu9ljd1boLc1iTYqEoD";
const JOURNEY = "1amX2K1pwdx2r39wwd9d";
const SKIP_KW = ["discovery", "consult", "personal", "hold"];
const TYPE_KW: Record<string, string[]> = {
  Journey: ["journey"],
  Room: ["room", "in-person"],
  Prep: ["prep"],
  Integration: ["integration"],
};
const PT_TZ = "America/Los_Angeles";

function parseHi(r: string | undefined | null): string {
  if (!r) return "None";
  const s = r.toLowerCase();
  if (s.includes("reviewed") || s.startsWith("3")) return "Reviewed";
  if (s.includes("signed") || s.startsWith("2")) return "Signed";
  if (s.includes("sent") || s.startsWith("1")) return "Sent";
  return "None";
}

function parseOha(r: string | undefined | null): string {
  if (!r) return "None";
  const s = r.toLowerCase();
  if (s.includes("reviewed") || s.startsWith("4")) return "Reviewed";
  if (s.includes("signed") || s.startsWith("3")) return "Signed";
  if (s.includes("sent") || s.startsWith("2")) return "Sent";
  if (s.includes("created") || s.startsWith("1")) return "Created";
  return "None";
}

async function ghlFetch(
  path: string,
  params: Record<string, string> | null,
  token: string,
  ver = "2021-07-28",
) {
  const url = new URL("https://services.leadconnectorhq.com" + path);
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: ver,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`GHL ${path} ${r.status}: ${body}`);
  }
  return r.json();
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

export async function GET() {
  await auth.protect();

  const token = process.env.GHL_ACCESS_TOKEN;
  if (!token) return apiError("GHL_ACCESS_TOKEN env var not set");

  try {
    // 7-day window in PT
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

    // Calendars
    const { calendars = [] } = await ghlFetch(
      "/calendars/",
      { locationId: LOCATION },
      token,
    );
    const calMap: Record<string, { type: string }> = {};
    for (const c of calendars) {
      const name = (c.name || "").toLowerCase();
      if (c.groupId === GEN_GROUP) {
        calMap[c.id] = { type: "Taper" };
        continue;
      }
      if (SKIP_KW.some((k) => name.includes(k))) continue;
      for (const [t, kws] of Object.entries(TYPE_KW)) {
        if (kws.some((k) => name.includes(k))) {
          calMap[c.id] = { type: t };
          break;
        }
      }
    }

    // Events — fetch all calendars in parallel
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
          const { events = [] } = await ghlFetch(
            "/calendars/events",
            {
              locationId: LOCATION,
              calendarId: calId,
              startTime: String(startUtcMs),
              endTime: String(endUtcMs),
            },
            token,
          );
          for (const e of events) {
            const s = (e.appointmentStatus || "").toLowerCase();
            if (s === "cancelled" || s === "canceled") continue;
            allEvents.push({ ...e, _calId: calId });
          }
        } catch {
          // skip calendar on error
        }
      }),
    );

    // Enrich contacts (cached — store promises to prevent duplicate concurrent calls)
    const cache: Record<string, Promise<ContactInfo>> = {};
    function enrich(cid: string): Promise<ContactInfo> {
      if (cid in cache) return cache[cid];
      cache[cid] = _enrich(cid);
      return cache[cid];
    }
    async function _enrich(cid: string): Promise<ContactInfo> {
      try {
        const { contact: c } = await ghlFetch(
          `/contacts/${cid}`,
          null,
          token!,
          "2021-07-28",
        );
        const name =
          `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unknown";
        const ccf: Record<string, string> = Object.fromEntries(
          (c.customFields || []).map((f: { id: string; value?: string }) => [
            f.id,
            f.value || "",
          ]),
        );
        let hi = parseHi(ccf[HI_CONTACT]);
        let oha = "None";
        let fac: string | null = null;
        let prep1 = "",
          prep2 = "",
          journey = "",
          integ1 = "",
          integ2 = "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let opp: any = null;
        try {
          const r = await ghlFetch(
            "/opportunities/search",
            { location_id: LOCATION, contact_id: cid, limit: "5" },
            token!,
            "2021-07-28",
          );
          const opps = r.opportunities || [];
          // Find the opportunity in the journey pipeline
          const match = opps.find((o: { pipelineId?: string }) => o.pipelineId === JOURNEY_PIPELINE) || opps[0];
          if (match) {
            const r2 = await ghlFetch(
              `/opportunities/${match.id}`,
              null,
              token!,
              "2021-07-28",
            );
            opp = r2.opportunity;
          }
        } catch {
          // ignore
        }
        if (opp) {
          const ocf: Record<string, string> = Object.fromEntries(
            (opp.customFields || []).map(
              (f: { id: string; fieldValue?: string; fieldValueString?: string; value?: string }) => [
                f.id,
                f.fieldValue || f.fieldValueString || f.value || "",
              ],
            ),
          );
          const oh = parseHi(ocf[HI_OPP]);
          if (oh !== "None") hi = oh;
          oha = parseOha(ocf[OHA_OPP]);
          fac = ocf[FAC_OPP] || null;
          prep1 = ocf[PREP1] || "";
          prep2 = ocf[PREP2] || "";
          journey = ocf[JOURNEY] || "";
          integ1 = ocf[INTEG1] || "";
          integ2 = ocf[INTEG2] || "";
        }
        return { name, hi, oha, fac, prep1, prep2, journey, integ1, integ2 };
      } catch {
        return { ...DEFAULT_INFO };
      }
    }

    // Build days map
    const daysMap: Record<string, McEvent[]> = {};
    await Promise.all(
      allEvents.map(async (ev) => {
        if (!ev.startTime) return;
        const dt = new Date(ev.startTime);
        const info = ev.contactId
          ? await enrich(ev.contactId)
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
        if (name === "Unknown") return;

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
          // Prep 1 only requires HI reviewed — OHA is due before Prep 2
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
      }),
    );

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
