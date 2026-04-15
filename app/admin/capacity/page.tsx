import Link from "next/link";
import Nav from "@/components/nav";
import CapacityDashboard from "@/components/admin/capacity-dashboard";

export default function AdminCapacityPage() {
  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <Nav subtitle="Admin" sticky />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/admin"
            className="text-sm font-medium text-[#2d7a4a] underline-offset-2 hover:underline"
          >
            ← Back to Admin
          </Link>
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-[#1a4d2e]">Facilitator capacity</h1>
        <p className="mb-8 max-w-3xl text-sm text-[#1a4d2e]/75">
          Live won opportunities from Go High Level, weekly caps (saved to the database), and routing
          suggestions for the sales team. Week boundaries use America/Los_Angeles (Portland).
        </p>
        <CapacityDashboard />
      </main>
    </div>
  );
}
