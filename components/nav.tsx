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
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: UserRole;
}

const navLinks: NavLink[] = [
  { href: "/intakes", label: "Intakes", icon: ClipboardList, minRole: "admin" },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/mission-control", label: "Mission Control", icon: Gauge, minRole: "admin" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, minRole: "admin" },
  { href: "/capacity", label: "Capacity", icon: LayoutDashboard },
  { href: "/admin", label: "Admin", icon: Settings, minRole: "admin" },
];

function NavPublic({
  subtitle,
  sticky,
}: {
  subtitle?: string;
  sticky?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      className={`bg-[#1a4d2e] shadow-[0_2px_12px_rgba(0,0,0,0.15)] ${sticky ? "sticky top-0 z-40" : ""}`}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-4 no-underline">
          <div className="select-none text-[28px] leading-none" aria-hidden>
            🌿
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-tight tracking-[0.5px] text-white">
              Meadow Medicine
            </h1>
            <p className="text-[13px] italic text-white/70">{subtitle}</p>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/capacity"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-all ${
              pathname.startsWith("/capacity")
                ? "bg-white/15 text-white"
                : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Capacity
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavClerk({
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
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-4 no-underline">
          <div className="select-none text-[28px] leading-none" aria-hidden>
            🌿
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-tight tracking-[0.5px] text-white">
              Meadow Medicine
            </h1>
            <p className="text-[13px] italic text-white/70">{subtitle}</p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-all ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
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

export default function Nav(props: { subtitle?: string; sticky?: boolean }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <NavPublic {...props} />;
  }
  return <NavClerk {...props} />;
}
