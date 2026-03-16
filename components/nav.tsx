"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function Nav({
  subtitle = "Health Intake Review Platform",
  sticky = false,
  children,
}: {
  subtitle?: string;
  sticky?: boolean;
  children?: React.ReactNode;
}) {
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

        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="text-white/80 hover:text-white text-sm no-underline transition-colors"
          >
            Clients
          </Link>
          {children}
          <UserButton />
        </div>
      </div>
    </nav>
  );
}
