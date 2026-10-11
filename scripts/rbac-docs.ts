import { writeFileSync } from "node:fs";
import {
  permissionKeys,
  defaultRolePermissions,
  accessRoleNames,
} from "../lib/server/permissions";
const head =
  "# BUILD 7C — RBAC matrix\n\nDefault grants are migrated for built-in roles only. Custom grants remain database-authoritative. Business titles never grant permissions.\n\nOwner: all permissions, with last-Owner protection and Agent safety gates.\nAdmin: all except organization.archive and roles.manage; cannot assign/demote Owner.\nConsultant: all business views and ordinary create/edit plus System organization/business-role edits; Agent ask/diagnose/recommend/prepare.\nManager and Editor: ordinary business create/edit, check-ins/reviews and Agent preparation; no organization-structure edits, cycle management, KR target changes, archives or approvals. Manager currently uses organization-wide operational scope; assigned-resource grants are deferred.\nViewer: module views and the read-only access matrix; no Agent ask/write/prepare/approve/execute, audit or member administration.\n\n| Permission | " +
  accessRoleNames.join(" | ") +
  " |\n|---|" +
  accessRoleNames.map(() => "---").join("|") +
  "|\n";
writeFileSync(
  "docs/RBAC-MATRIX.md",
  head +
    permissionKeys
      .map(
        (p) =>
          "| " +
          p +
          " | " +
          accessRoleNames
            .map((r) => (defaultRolePermissions[r].includes(p) ? "Yes" : "—"))
            .join(" | ") +
          " |",
      )
      .join("\n") +
    "\n\nAgent preparation and execution additionally require all mapped target-domain permissions. Approval also requires the corresponding module.approve permission. Real server execution is disabled in 7C as required by scope section 110.\n",
);
