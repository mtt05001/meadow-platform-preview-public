import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getRoleFromClaims } from "@/lib/auth";
import { isClerkEnabled } from "@/lib/clerk-env";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/api/intakes/webhook",
  "/api/medication-intake",
  "/intakes/:id/readonly",
  "/api/intakes/:id/readonly",
  "/api/intakes/:id/pdf",
  "/schedule",
  "/api/schedule",
  "/pathway(.*)",
  "/api/pathway(.*)",
  "/apply",
  "/capacity",
  "/api/capacity",
  "/admin/capacity",
]);

// Routes accessible to facilitators (and admins)
const isFacilitatorRoute = createRouteMatcher([
  "/clients",
  "/api/clients",
  "/api/facilitator",
  "/screening",
  "/api/medication-submissions(.*)",
]);

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

const clerkMiddlewareFn = clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { sessionClaims } = await auth.protect();
  const role = getRoleFromClaims(sessionClaims);

  // Clients can't access anything (placeholder — no pages yet)
  if (role === "client") return forbidden();

  // Facilitators can only access their allowed routes
  if (role === "facilitator" && !isFacilitatorRoute(request)) {
    return forbidden();
  }

  // Admins can access everything
});

/** When Clerk env is unset (e.g. preview), skip auth so public routes like /capacity work. */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!isClerkEnabled()) {
    return NextResponse.next();
  }
  return clerkMiddlewareFn(request, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
