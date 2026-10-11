import "server-only";
import type { Database } from "./db/types";
import type { OrganizationContext } from "./context";
import type { PersistenceProvider } from "../persistence/provider";
import { StrategyService } from "./services/domains";
export class DatabasePersistenceProvider implements PersistenceProvider {
  readonly mode = "database" as const;
  readonly organizationId: string;
  constructor(
    private db: Database,
    private context: OrganizationContext,
  ) {
    this.organizationId = context.organizationId;
  }
  async listObjectives() {
    return (await new StrategyService(this.db).list(this.context)).map((r) => ({
      id: r.id,
      title: r.title,
      code: r.code,
      version: r.version,
    }));
  }
}
