import { parseStrategy } from "../strategy/model";
import { exportLocalWorkspace, type LocalBusinessOSExport } from "./export";
export interface ObjectiveSummary {
  id: string;
  title: string;
  code: string;
  version: number;
}
export interface PersistenceProvider {
  readonly mode: "local" | "database";
  readonly organizationId: string;
  listObjectives(): Promise<ObjectiveSummary[]>;
}
export class LocalPersistenceProvider implements PersistenceProvider {
  readonly mode = "local" as const;
  readonly organizationId = "local-workspace";
  constructor(private storage: Pick<Storage, "getItem">) {}
  async listObjectives() {
    const raw = this.storage.getItem("growth-engine.strategy.v1");
    return raw
      ? parseStrategy(raw).objectives.map((o) => ({
          id: o.id,
          title: o.title,
          code: o.code,
          version: 1,
        }))
      : [];
  }
  export(): LocalBusinessOSExport {
    return exportLocalWorkspace(this.storage, this.organizationId);
  }
}
// Providers are constructed for one scope. Switching organization replaces the
// provider; no shared entity cache or singleton selected organization exists.
export function persistenceMode(
  value: string | undefined,
): "local" | "database" {
  if (!value || value === "local") return "local";
  if (value === "database") return "database";
  throw Error("InvalidPersistenceMode");
}
