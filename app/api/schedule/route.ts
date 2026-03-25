import { NextResponse } from "next/server";
import { fetchCalendars, fetchCalendarGroups } from "@/lib/ghl";
import { apiError, getErrorMessage } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// GHL group IDs → session type labels
const SESSION_TYPE_GROUPS: Record<string, string> = {
  q1lW3mRpppULJbamMvBv: "Preparation (Zoom)",
  QCO31LIgZtROfoDIrrL8: "Integration (Zoom)",
  FHsE7quFyn9m6GLUBFIL: "30 Minute (Zoom)",
  xi6Hn2H3xr3h5BI5BKR5: "60 Minute (Zoom)",
  qdrH3LF2uiCIedrT26Mj: "90 Minute (Zoom)",
  Ae6z3q5FAetBC5bx419H: "In-Person / Journey",
};

// Display order for session types
const SESSION_TYPE_ORDER = [
  "Preparation (Zoom)",
  "Integration (Zoom)",
  "In-Person",
  "Journey",
  "30 Minute (Zoom)",
  "60 Minute (Zoom)",
  "90 Minute (Zoom)",
];

/** Extract facilitator name from calendar name. */
function extractFacilitatorName(name: string): string {
  let cleaned = name.replace(/\[Open\]\s*/g, "").trim();

  // "Tracy Townsend - 30 min" → "Tracy Townsend"
  const dashDuration = cleaned.match(/^(.+?)\s*-\s*\d+\s*min$/);
  if (dashDuration) return dashDuration[1].trim();

  // "Preparation - Tracy Townsend (1 hr)" → "Tracy Townsend"
  const typeDashName = cleaned.match(
    /^(?:Preparation|Integration)\s*-\s*(.+?)\s*\(/,
  );
  if (typeDashName) return typeDashName[1].trim();

  return "";
}

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
  /** Direct calendar (no facilitator selection needed, e.g. In-Person/Journey) */
  directCalendar: ScheduleCalendar | null;
  /** Facilitators available for this session type */
  facilitators: FacilitatorEntry[];
}

/** GET /api/schedule — Public. Returns session types with facilitators and calendars. */
export async function GET() {
  try {
    const [calendars, groups] = await Promise.all([
      fetchCalendars(),
      fetchCalendarGroups(),
    ]);

    const groupMap = new Map(groups.map((g) => [g.id, g]));

    // Only include calendars that belong to a recognized session type group
    const relevantCalendars = calendars.filter(
      (c) =>
        c.isActive &&
        c.groupId &&
        SESSION_TYPE_GROUPS[c.groupId] &&
        groupMap.get(c.groupId)?.isActive,
    );

    // Split the In-Person/Journey group into separate session types
    // and build facilitator-based structure for the rest
    const sessionTypeMap = new Map<string, SessionType>();

    for (const type of SESSION_TYPE_ORDER) {
      sessionTypeMap.set(type, {
        type,
        directCalendar: null,
        facilitators: [],
      });
    }

    // Track facilitators per session type
    const facByType = new Map<
      string,
      Map<string, FacilitatorEntry>
    >();

    for (const cal of relevantCalendars) {
      const groupLabel = SESSION_TYPE_GROUPS[cal.groupId!];
      const isOpen = cal.name.includes("[Open]");
      const calEntry: ScheduleCalendar = {
        id: cal.id,
        name: cal.name,
        widgetSlug: cal.widgetSlug,
        isOpen,
      };

      // Handle In-Person/Journey group — these are direct calendars (no facilitator)
      if (groupLabel === "In-Person / Journey") {
        const nameLower = cal.name.toLowerCase();
        if (nameLower.includes("journey")) {
          const st = sessionTypeMap.get("Journey")!;
          st.directCalendar = calEntry;
        } else if (nameLower.includes("in-person") || nameLower.includes("inperson")) {
          // Skip test calendars
          if (nameLower.includes("test")) continue;
          const st = sessionTypeMap.get("In-Person")!;
          st.directCalendar = calEntry;
        }
        continue;
      }

      // Facilitator-based session types
      const userId = cal.teamMembers?.[0]?.userId;
      if (!userId) continue;
      const facName = extractFacilitatorName(cal.name);
      if (!facName) continue;

      if (!facByType.has(groupLabel)) {
        facByType.set(groupLabel, new Map());
      }
      const facMap = facByType.get(groupLabel)!;

      if (!facMap.has(userId)) {
        facMap.set(userId, {
          userId,
          name: facName,
          preApproved: null,
          open: null,
        });
      }

      const entry = facMap.get(userId)!;
      if (isOpen) {
        entry.open = calEntry;
      } else {
        entry.preApproved = calEntry;
      }
    }

    // Merge facilitators into session types
    for (const [typeLabel, facMap] of facByType) {
      const st = sessionTypeMap.get(typeLabel);
      if (!st) continue;
      st.facilitators = Array.from(facMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    // Remove session types with no calendars and no facilitators
    const sessionTypes = SESSION_TYPE_ORDER
      .map((type) => sessionTypeMap.get(type)!)
      .filter((st) => st.directCalendar || st.facilitators.length > 0);

    return NextResponse.json({ sessionTypes });
  } catch (e) {
    return apiError(getErrorMessage(e));
  }
}
