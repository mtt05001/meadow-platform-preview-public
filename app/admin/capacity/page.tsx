import { redirect } from "next/navigation";

/** Canonical public URL is `/capacity` (no Clerk required for now). */
export default function AdminCapacityRedirect() {
  redirect("/capacity");
}
