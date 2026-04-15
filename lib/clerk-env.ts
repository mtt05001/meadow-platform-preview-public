/** Clerk is active (layout + middleware + session APIs). */
export function isClerkEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}
