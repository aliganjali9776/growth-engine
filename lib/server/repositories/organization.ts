import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/types";
import {
  organizations,
  memberships,
  users,
  organizationSettings,
} from "../db/schema";
import { requireScope } from "../context";
export class OrganizationRepository {
  constructor(private readonly db: Database) {}
  async listForUser(userId: string) {
    requireScope(userId);
    return this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        accessTier: organizations.accessTier,
        status: organizations.status,
        membershipId: memberships.id,
      })
      .from(organizations)
      .innerJoin(
        memberships,
        and(
          eq(memberships.organizationId, organizations.id),
          eq(memberships.userId, userId),
          eq(memberships.status, "Active"),
        ),
      )
      .innerJoin(users, and(eq(users.id, userId), eq(users.status, "Active")))
      .where(inArray(organizations.status, ["Active", "Trial"]));
  }
  async settings(organizationId: string) {
    requireScope(organizationId);
    const [row] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId));
    return row ?? null;
  }
}
