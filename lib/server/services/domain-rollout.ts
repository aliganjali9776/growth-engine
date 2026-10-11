import "server-only";
import { moduleForStore, type BusinessModule } from "../../persistence/business-export";

// Expand only after each domain's regression/parity gate passes. Local mode
// never imports this module; failures in server mode remain controlled errors.
export const activeServerDomains: ReadonlySet<BusinessModule> = new Set(["assessment", "system", "strategy", "scale", "agent"]);
export const usesCanonicalRecords = (key: string) => activeServerDomains.has(moduleForStore(key));
