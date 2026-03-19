"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const navLinks = [
  { href: "/intakes", label: "Intakes" },
  { href: "/clients", label: "Clients" },
  { href: "/mission-control", label: "Mission Control" },
];

export default function Nav({
  subtitle = "Health Intake Review Platform",
  sticky = false,
  children,
}: {
  subtitle?: string;
  sticky?: boolean;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();

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

        <div className="flex items-center gap-4">
          {navLinks.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium no-underline transition-all ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:text-white hover:bg-white/10"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {children}
          <UserButton />
        </div>
      </div>
    </nav>
  );
}
