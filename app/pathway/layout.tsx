import type { ReactNode } from "react";
import { PathwayShell } from "@/components/pathway/pathway-shell";

export const dynamic = "force-dynamic";

export default function PathwayLayout({ children }: { children: ReactNode }) {
  return <PathwayShell>{children}</PathwayShell>;
}
