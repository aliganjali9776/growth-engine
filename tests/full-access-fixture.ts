// Existing regression scenarios model already-enabled customers. Keep that
// fixture explicit; BUILD 8A tests call the real bootstrap without this wrapper.
import { eq } from "drizzle-orm";
import { organizations } from "../lib/server/db/schema";
import { createOrganizationWithOwner as create } from "../lib/server/services/organization";
export async function createOrganizationWithOwner(
  ...args: Parameters<typeof create>
) {
  const made = await create(...args);
  await args[0]
    .update(organizations)
    .set({ accessTier: "full_access" })
    .where(eq(organizations.id, made.organization.id));
  return {
    ...made,
    organization: { ...made.organization, accessTier: "full_access" as const },
  };
}
