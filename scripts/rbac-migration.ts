import { writeFileSync, readFileSync } from "node:fs";
import {
  permissionKeys,
  defaultRolePermissions,
} from "../lib/server/permissions";
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const catalog = permissionKeys
  .map((p) => `(${quote(p)}, ${quote(p)})`)
  .join(",\n");
const grants = Object.entries(defaultRolePermissions)
  .flatMap(([role, keys]) => keys.map((p) => `(${quote(role)}, ${quote(p)})`))
  .join(",\n");
const sql = `-- Upgrade only built-in roles; preserve custom role grants.\nINSERT INTO permissions (key, description) VALUES\n${catalog}\nON CONFLICT (key) DO NOTHING;\n--> statement-breakpoint\nDELETE FROM role_permissions rp USING access_roles r WHERE rp.role_id = r.id AND rp.organization_id = r.organization_id AND r.system_role = true AND r.name IN ('Owner','Admin','Consultant','Manager','Editor','Viewer');\n--> statement-breakpoint\nINSERT INTO role_permissions (organization_id, role_id, permission_key) SELECT r.organization_id, r.id, g.permission FROM access_roles r JOIN (VALUES\n${grants}\n) AS g(role, permission) ON r.name = g.role WHERE r.system_role = true ON CONFLICT DO NOTHING;\n`;
writeFileSync("drizzle/0005_rbac_default_grants.sql", sql);
const path = "drizzle/meta/_journal.json";
const journal = JSON.parse(readFileSync(path, "utf8"));
if (!journal.entries.some((e: any) => e.tag === "0005_rbac_default_grants"))
  journal.entries.push({
    idx: 5,
    version: "7",
    when: 1791290000000,
    tag: "0005_rbac_default_grants",
    breakpoints: true,
  });
writeFileSync(path, JSON.stringify(journal, null, 2) + "\n");
