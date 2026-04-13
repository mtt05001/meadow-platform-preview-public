import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { getRoleFromClaims } from "@/lib/auth";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/api/intakes/webhook",
  "/intakes/:id/readonly",
  "/api/intakes/:id/readonly",
  "/api/intakes/:id/pdf",
  "/schedule",
  "/api/schedule",
]);

// Routes accessible to facilitators (and admins)
const isFacilitatorRoute = createRouteMatcher([
  "/clients",
  "/api/clients",
  "/api/facilitator",
]);

const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

export default clerkMiddleware(async (auth, request) => {
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

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
