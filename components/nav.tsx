"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import type { UserRole } from "@/lib/auth";
import {
  ClipboardList,
  Users,
  Gauge,
  BarChart3,
  CalendarDays,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: UserRole; // omit = everyone can see
}

const navLinks: NavLink[] = [
  { href: "/intakes", label: "Intakes", icon: ClipboardList, minRole: "admin" },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/mission-control", label: "Mission Control", icon: Gauge, minRole: "admin" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, minRole: "admin" },
  // { href: "/schedule", label: "Schedule", icon: CalendarDays }, // Removed from admin portal — will move to facilitator/client portals
  { href: "/admin", label: "Admin", icon: Settings, minRole: "admin" },
];

export default function Nav({
  subtitle = "Health Intake Review Platform",
  sticky = false,
}: {
  subtitle?: string;
  sticky?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as UserRole) || "client";

  const visibleLinks = navLinks.filter(
    (link) => !link.minRole || link.minRole === role || role === "admin",
  );

  return (
    <nav
      className={`bg-[#1a4d2e] shadow-[0_2px_12px_rgba(0,0,0,0.15)] ${sticky ? "sticky top-0 z-40" : ""}`}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4 no-underline">
          <div className="text-[28px] leading-none select-none" aria-hidden>
            🌿
          </div>
          <div>
            <h1 className="text-white text-[20px] font-semibold tracking-[0.5px] leading-tight">
              Meadow Medicine
            </h1>
            <p className="text-white/70 text-[13px] italic">{subtitle}</p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium no-underline transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
          <div className="ml-3">
            <UserButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
