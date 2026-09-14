import type {
  SystemData,
  Process,
  FounderDependency,
  OrganizationNode,
} from "./types";
import { stageKeys } from "./config";
export const activeProcesses = (d: SystemData) =>
  d.processes.filter((p) => p.status === "active");
export const isSampleProcess = (p: Process) =>
  /^p(?:[1-9]|1[0-5])$/.test(p.id) &&
  p.createdAt === "2026-09-12T00:00:00.000Z";
export function ownerOf(d: SystemData, p: Process) {
  const role = d.roles.find((r) => r.id === p.ownerRoleId);
  return { role, person: d.people.find((u) => u.id === role?.personId) };
}
export const missingOwners = (d: SystemData) =>
  activeProcesses(d).filter((p) => !ownerOf(d, p).role);
export function ownershipCounts(d: SystemData) {
  return d.roles
    .map((role) => ({
      role,
      total: activeProcesses(d).filter((p) => p.ownerRoleId === role.id).length,
      critical: activeProcesses(d).filter(
        (p) => p.ownerRoleId === role.id && p.priorityLevel === "critical",
      ).length,
    }))
    .sort((a, b) => b.total - a.total);
}
export function departmentRiskCounts(d: SystemData) {
  return d.departments
    .map((department) => ({
      department,
      total: activeProcesses(d).filter((p) => p.departmentId === department.id)
        .length,
      critical: activeProcesses(d).filter(
        (p) =>
          p.departmentId === department.id && p.priorityLevel === "critical",
      ).length,
    }))
    .sort((a, b) => b.critical - a.critical || b.total - a.total);
}
export function effectiveFounder(d: SystemData, p: Process): FounderDependency {
  return ownerOf(d, p).role?.isFounderRole ? "critical" : p.founderDependency;
}
export function founderBottlenecks(d: SystemData) {
  return activeProcesses(d).filter(
    (p) =>
      p.priorityLevel === "critical" &&
      ["high", "critical"].includes(effectiveFounder(d, p)),
  );
}
export function systemMetrics(d: SystemData) {
  const ps = activeProcesses(d),
    total = ps.length;
  return {
    total,
    critical: ps.filter((p) => p.priorityLevel === "critical").length,
    founder: ps.filter((p) =>
      ["high", "critical"].includes(effectiveFounder(d, p)),
    ).length,
    ownerCoverage: total
      ? Math.round(
          (ps.filter(
            (p) =>
              !!ownerOf(d, p).person &&
              ownerOf(d, p).person?.status === "active",
          ).length /
            total) *
            100,
        )
      : 0,
    documented: ps.filter((p) => p.documentationStatus === "complete").length,
    priorities: [...ps]
      .sort(
        (a, b) =>
          b.priorityScore - a.priorityScore || a.code.localeCompare(b.code),
      )
      .slice(0, 3),
    stages: stageKeys.map((stage) => ({
      stage,
      count: ps.filter((p) => p.systemizationStage === stage).length,
    })),
  };
}
export function relationshipInsights(d: SystemData) {
  const ps = activeProcesses(d);
  return [
    ...d.roles.flatMap((r) => {
      const owned = ps.filter((p) => p.ownerRoleId === r.id),
        critical = owned.filter((p) => p.priorityLevel === "critical");
      return owned.length
        ? [
            {
              id: r.id,
              text: `${r.title} مالک ${owned.length.toLocaleString("fa-IR")} فرآیند است${critical.length ? `؛ ${critical.length.toLocaleString("fa-IR")} مورد با اولویت بحرانی` : ""}.`,
              note:
                owned.length >= 4
                  ? "تمرکز مالکیت بالاست؛ ظرفیت و حدود مسئولیت بررسی شود."
                  : "ظرفیت واقعی با حجم و پیچیدگی کار سنجیده شود.",
              owner: r.id,
            },
          ]
        : [];
    }),
    ...d.departments.flatMap((dep) => {
      const n = ps.filter(
        (p) => p.departmentId === dep.id && p.priorityLevel === "critical",
      ).length;
      return n
        ? [
            {
              id: dep.id,
              text: `واحد ${dep.name} دارای ${n.toLocaleString("fa-IR")} فرآیند بحرانی است.`,
              note: "برای شروع سیستم‌سازی، مالک و دامنه این فرآیندها را مرور کنید.",
              department: dep.id,
            },
          ]
        : [];
    }),
  ];
}
export interface InventoryFilters {
  search: string;
  priority: string;
  department: string;
  owner: string;
  stage: string;
  founder: string;
  sort: string;
  status: string;
  bottleneck: boolean;
}
export const emptyFilters: InventoryFilters = {
  search: "",
  priority: "",
  department: "",
  owner: "",
  stage: "",
  founder: "",
  sort: "priority",
  status: "active",
  bottleneck: false,
};
export function selectProcesses(d: SystemData, f: InventoryFilters) {
  const ranks = ["none", "low", "medium", "high", "critical"];
  const bottlenecks = f.bottleneck
    ? new Set(founderBottlenecks(d).map((p) => p.id))
    : null;
  return d.processes
    .filter(
      (p) =>
        (!f.status || p.status === f.status) &&
        (!f.search ||
          `${p.name} ${p.code} ${p.description}`
            .toLocaleLowerCase("fa")
            .includes(f.search.trim().toLocaleLowerCase("fa"))) &&
        (!f.priority || p.priorityLevel === f.priority) &&
        (!f.department || p.departmentId === f.department) &&
        (!f.owner ||
          (f.owner === "__missing"
            ? !ownerOf(d, p).role
            : p.ownerRoleId === f.owner)) &&
        (!f.stage || p.systemizationStage === f.stage) &&
        (!f.founder || effectiveFounder(d, p) === f.founder) &&
        (!bottlenecks || bottlenecks.has(p.id)),
    )
    .sort((a, b) => {
      switch (f.sort) {
        case "department":
          return (
            d.departments.find((x) => x.id === a.departmentId)?.name ?? ""
          ).localeCompare(
            d.departments.find((x) => x.id === b.departmentId)?.name ?? "",
            "fa",
          );
        case "owner":
          return (ownerOf(d, a).role?.title ?? "").localeCompare(
            ownerOf(d, b).role?.title ?? "",
            "fa",
          );
        case "stage":
          return (
            stageKeys.indexOf(a.systemizationStage) -
            stageKeys.indexOf(b.systemizationStage)
          );
        case "founder":
          return (
            ranks.indexOf(effectiveFounder(d, b)) -
            ranks.indexOf(effectiveFounder(d, a))
          );
        default:
          return (
            b.priorityScore - a.priorityScore || a.code.localeCompare(b.code)
          );
      }
    });
}
// Stable tree layout, independent of the chart library and future drag editing.
export function organizationNodes(d: SystemData): OrganizationNode[] {
  const result: OrganizationNode[] = [];
  let leaf = 0;
  const walk = (
    id: string,
    kind: "department" | "role",
    depth: number,
    parentId?: string,
  ): number => {
    const children =
      kind === "department"
        ? d.departments.filter(
            (x) => x.status === "active" && x.parentDepartmentId === id,
          )
        : d.roles.filter((x) => x.reportsToRoleId === id);
    const xs = children.map((c) =>
      walk(c.id, kind, depth + 1, `${kind}-${id}`),
    );
    const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : leaf++ * 255;
    result.push({
      id: `${kind}-${id}`,
      entityId: id,
      kind,
      parentId,
      x,
      y: depth * 165,
    });
    return x;
  };
  d.roles
    .filter((r) => !r.reportsToRoleId)
    .forEach((r) => walk(r.id, "role", 0));
  leaf += 1;
  d.departments
    .filter(
      (x) =>
        x.status === "active" &&
        (!x.parentDepartmentId ||
          d.departments.find((p) => p.id === x.parentDepartmentId)?.status ===
            "archived"),
    )
    .forEach((x) => walk(x.id, "department", 0));
  return result;
}
