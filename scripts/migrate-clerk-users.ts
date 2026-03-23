/**
 * Migrate Clerk users from dev instance to prod instance.
 *
 * Usage:
 *   npx tsx scripts/migrate-clerk-users.ts
 *
 * Required env vars (set in .env.local or export before running):
 *   CLERK_DEV_SECRET_KEY   - Secret key from your dev Clerk instance
 *   CLERK_PROD_SECRET_KEY  - Secret key from your new prod Clerk instance
 *
 * What this does:
 *   1. Fetches all users from dev
 *   2. Creates them in prod with the same email, name, and publicMetadata
 *   3. Passwords cannot be migrated (hashed) — users will need to use
 *      "Forgot password" on first login, or you can set passwords manually
 *      in the Clerk Dashboard after migration.
 *
 * Safe to run multiple times — skips users whose email already exists in prod.
 */

const DEV_KEY = process.env.CLERK_DEV_SECRET_KEY;
const PROD_KEY = process.env.CLERK_PROD_SECRET_KEY;

if (!DEV_KEY || !PROD_KEY) {
  console.error(
    "Missing env vars. Set CLERK_DEV_SECRET_KEY and CLERK_PROD_SECRET_KEY",
  );
  process.exit(1);
}

const CLERK_API = "https://api.clerk.com/v1";

interface ClerkUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: { email_address: string; id: string }[];
  primary_email_address_id: string;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  unsafe_metadata: Record<string, unknown>;
}

async function clerkFetch<T>(
  path: string,
  secretKey: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      `Clerk API error ${res.status}: ${JSON.stringify(body.errors ?? body)}`,
    );
  }

  return body as T;
}

async function getDevUsers(): Promise<ClerkUser[]> {
  // Clerk paginates with limit/offset
  const users: ClerkUser[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await clerkFetch<ClerkUser[]>(
      `/users?limit=${limit}&offset=${offset}&order_by=-created_at`,
      DEV_KEY!,
    );
    users.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return users;
}

async function getProdEmails(): Promise<Set<string>> {
  const users = await clerkFetch<ClerkUser[]>(
    `/users?limit=500&offset=0`,
    PROD_KEY!,
  );
  const emails = new Set<string>();
  for (const u of users) {
    for (const e of u.email_addresses) {
      emails.add(e.email_address.toLowerCase());
    }
  }
  return emails;
}

async function createProdUser(devUser: ClerkUser): Promise<void> {
  const primaryEmail = devUser.email_addresses.find(
    (e) => e.id === devUser.primary_email_address_id,
  );

  if (!primaryEmail) {
    console.warn(`  Skipping ${devUser.id} — no primary email found`);
    return;
  }

  await clerkFetch(
    "/users",
    PROD_KEY!,
    {
      method: "POST",
      body: JSON.stringify({
        email_address: [primaryEmail.email_address],
        first_name: devUser.first_name,
        last_name: devUser.last_name,
        public_metadata: devUser.public_metadata,
        private_metadata: devUser.private_metadata,
        unsafe_metadata: devUser.unsafe_metadata,
        // Skip password — users will reset on first login
        skip_password_requirement: true,
      }),
    },
  );
}

async function main() {
  console.log("Fetching users from dev instance...");
  const devUsers = await getDevUsers();
  console.log(`Found ${devUsers.length} user(s) in dev.\n`);

  console.log("Checking existing prod users...");
  const existingEmails = await getProdEmails();
  console.log(`Found ${existingEmails.size} existing user(s) in prod.\n`);

  let created = 0;
  let skipped = 0;

  for (const user of devUsers) {
    const email = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    )?.email_address;

    const label = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.id;

    if (!email) {
      console.log(`  SKIP ${label} — no primary email`);
      skipped++;
      continue;
    }

    if (existingEmails.has(email.toLowerCase())) {
      console.log(`  SKIP ${label} (${email}) — already exists in prod`);
      skipped++;
      continue;
    }

    try {
      await createProdUser(user);
      console.log(`  OK   ${label} (${email})`);
      created++;
    } catch (e) {
      console.error(`  FAIL ${label} (${email}):`, (e as Error).message);
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  console.log(
    "\nNext steps:",
    "\n  1. Users will need to use 'Forgot password' on first login",
    "\n     (or set passwords in Clerk Dashboard)",
    "\n  2. Set roles via the Admin page (/admin) or Clerk Dashboard",
    "\n     (users default to 'client' — no access until role is set)",
    "\n  3. Swap CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "\n     in your Vercel env vars to the prod keys",
    "\n  4. Configure your custom domain in Clerk prod settings",
  );
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
