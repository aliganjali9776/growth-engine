import { writeFile } from "node:fs/promises";
import { createSystemSeed } from "../../lib/system/seed";
import { seedStrategy } from "../../lib/strategy/seed";
import { exportLocalBusiness } from "../../lib/persistence/business-export";
const system = createSystemSeed();
const stores: Record<string, string> = {
  "growth-engine.system.v1": JSON.stringify(system),
  "growth-engine.strategy.v1": JSON.stringify(seedStrategy(system.roles)),
};
const value = exportLocalBusiness(
  { getItem: (key) => stores[key] ?? null },
  "synthetic-7d-browser-qa",
);
writeFile(
  ".build7d-synthetic-backup.json",
  JSON.stringify(value, null, 2),
).then(() =>
  console.log("Synthetic migration backup written; no user data included."),
);
