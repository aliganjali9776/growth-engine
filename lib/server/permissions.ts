// Client-safe catalog; effective database grants remain authoritative.
export const permissionKeys = [
  "organization.view",
  "organization.update",
  "organization.archive",
  "members.view",
  "members.invite",
  "members.change_role",
  "members.suspend",
  "members.remove",
  "roles.view",
  "roles.manage",
  "audit.view",
  "system.view",
  "system.edit",
  "system.create",
  "system.archive",
  "system.approve",
  "system.organization.edit",
  "system.roles.edit",
  "system.process.edit",
  "system.sop.edit",
  "system.sop.approve",
  "system.kpi.edit",
  "system.improvement.edit",
  "strategy.view",
  "strategy.edit",
  "strategy.create",
  "strategy.archive",
  "strategy.approve",
  "strategy.cycle.manage",
  "strategy.objective.edit",
  "strategy.kr.edit",
  "strategy.kr.target_change",
  "strategy.initiative.edit",
  "strategy.review.edit",
  "strategy.adapt.edit",
  "scale.view",
  "scale.edit",
  "scale.create",
  "scale.archive",
  "scale.approve",
  "scale.constraint.edit",
  "scale.experiment.edit",
  "scale.funnel.edit",
  "scale.channel.edit",
  "scale.loop.edit",
  "scale.readiness.edit",
  "scale.decision.approve",
  "agent.view",
  "agent.ask",
  "agent.diagnose",
  "agent.recommend",
  "agent.prepare",
  "agent.approve",
  "agent.execute",
  "agent.audit.view",
] as const;
export type Permission = (typeof permissionKeys)[number];
export const accessRoleNames = [
  "Owner",
  "Admin",
  "Consultant",
  "Manager",
  "Editor",
  "Viewer",
] as const;
export type AccessRoleName = (typeof accessRoleNames)[number];
const view: Permission[] = [
  "organization.view",
  "roles.view",
  "system.view",
  "strategy.view",
  "scale.view",
  "agent.view",
];
const ordinary = permissionKeys.filter(
  (p) =>
    /^(system|strategy|scale)\./.test(p) &&
    !p.endsWith(".view") &&
    !p.endsWith(".approve") &&
    !p.endsWith(".archive") &&
    ![
      "strategy.cycle.manage",
      "strategy.kr.target_change",
      "system.organization.edit",
      "system.roles.edit",
    ].includes(p),
);
const advisor: Permission[] = [
  "agent.ask",
  "agent.diagnose",
  "agent.recommend",
  "agent.prepare",
];
export const defaultRolePermissions: Readonly<
  Record<string, readonly Permission[]>
> = Object.freeze({
  Owner: Object.freeze([...permissionKeys]),
  Admin: Object.freeze(
    permissionKeys.filter(
      (p) => !["organization.archive", "roles.manage"].includes(p),
    ),
  ),
  Consultant: Object.freeze<Permission[]>([
    ...view,
    ...ordinary,
    "system.organization.edit",
    "system.roles.edit",
    ...advisor,
  ]),
  Manager: Object.freeze([...view, ...ordinary, ...advisor]),
  Editor: Object.freeze([...view, ...ordinary, ...advisor]),
  Viewer: Object.freeze([...view]),
});
export function permissionForPage(path: string): Permission {
  if (path === "/settings/data-migration") return "organization.update";
  if (/^\/system(?:\/|$)/.test(path)) return "system.view";
  if (/^\/strategy(?:\/|$)/.test(path)) return "strategy.view";
  if (/^\/scale(?:\/|$)/.test(path)) return "scale.view";
  if (/^\/(advisor|agent)(?:\/|$)/.test(path))
    return path.includes("/history") ? "agent.audit.view" : "agent.view";
  if (path === "/settings/members") return "members.view";
  if (["/settings/access", "/settings/roles"].includes(path))
    return "roles.view";
  return "organization.view";
}
