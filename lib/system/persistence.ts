import type { SystemData } from "./types";
import { calculatePriority } from "./scoring";
import { stages, founderLevels, valueChains, documentation } from "./config";
export const SYSTEM_STORAGE_KEY = "growth-engine.system.v1";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" && v.length <= 5000;
const required = (v: unknown) => text(v) && (v as string).trim().length > 0;
const optional = (v: unknown) => v === undefined || text(v);
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function validateSystem(value: unknown): SystemData {
  assert(
    object(value) && value.version === 1,
    "نسخه داده‌های سیستم معتبر نیست.",
  );
  for (const key of ["departments", "roles", "people", "processes"]) {
    const rows = value[key];
    assert(
      Array.isArray(rows) && rows.length <= 5000,
      "ساختار داده‌ها معتبر نیست.",
    );
    const ids = new Set();
    for (const row of rows) {
      assert(
        object(row) && required(row.id) && !ids.has(row.id),
        "شناسه تکراری یا نامعتبر است.",
      );
      ids.add(row.id);
    }
  }
  const d = value as unknown as SystemData;
  for (const dep of d.departments)
    assert(
      required(dep.name) &&
        text(dep.description) &&
        ["active", "archived"].includes(dep.status) &&
        optional(dep.parentDepartmentId) &&
        optional(dep.managerRoleId),
      "اطلاعات واحد معتبر نیست.",
    );
  for (const r of d.roles)
    assert(
      required(r.title) &&
        required(r.departmentId) &&
        text(r.purpose) &&
        Array.isArray(r.responsibilities) &&
        r.responsibilities.every(text) &&
        optional(r.personId) &&
        optional(r.reportsToRoleId) &&
        typeof r.isKeyRole === "boolean" &&
        typeof r.isFounderRole === "boolean",
      "اطلاعات نقش معتبر نیست.",
    );
  for (const p of d.people)
    assert(
      required(p.name) &&
        text(p.jobTitle) &&
        optional(p.email) &&
        optional(p.avatar) &&
        ["active", "archived"].includes(p.status),
      "اطلاعات فرد معتبر نیست.",
    );
  const codes = new Set();
  for (const p of d.processes) {
    assert(
      required(p.code) &&
        !codes.has(p.code) &&
        required(p.name) &&
        text(p.description) &&
        required(p.departmentId) &&
        text(p.ownerRoleId) &&
        valueChains.includes(p.valueChain) &&
        Object.prototype.hasOwnProperty.call(stages, p.systemizationStage) &&
        Object.prototype.hasOwnProperty.call(
          founderLevels,
          p.founderDependency,
        ) &&
        Object.prototype.hasOwnProperty.call(
          documentation,
          p.documentationStatus,
        ) &&
        ["active", "archived"].includes(p.status) &&
        ["not-started", "partial", "adopted"].includes(p.adoptionStatus) &&
        text(p.notes) &&
        typeof p.createdAt === "string" &&
        Number.isFinite(Date.parse(p.createdAt)) &&
        typeof p.updatedAt === "string" &&
        Number.isFinite(Date.parse(p.updatedAt)) &&
        (p.healthScore === undefined ||
          (Number.isFinite(p.healthScore) &&
            p.healthScore >= 0 &&
            p.healthScore <= 100)),
      "اطلاعات فرآیند یا کد آن معتبر نیست.",
    );
    codes.add(p.code);
    calculatePriority(p);
  }
  const depIds = new Set(d.departments.map((x) => x.id)),
    roleIds = new Set(d.roles.map((x) => x.id)),
    personIds = new Set(d.people.map((x) => x.id));
  for (const dep of d.departments)
    assert(
      (!dep.parentDepartmentId || depIds.has(dep.parentDepartmentId)) &&
        (!dep.managerRoleId || roleIds.has(dep.managerRoleId)),
      "واحد مادر یا نقش مدیر وجود ندارد.",
    );
  for (const r of d.roles)
    assert(
      depIds.has(r.departmentId) &&
        (!r.personId || personIds.has(r.personId)) &&
        (!r.reportsToRoleId || roleIds.has(r.reportsToRoleId)),
      "واحد، فرد یا مدیر نقش وجود ندارد.",
    );
  for (const p of d.processes)
    assert(
      depIds.has(p.departmentId) &&
        (!p.ownerRoleId || roleIds.has(p.ownerRoleId)),
      "واحد یا نقش مالک فرآیند وجود ندارد.",
    );
  function acyclic(
    rows: { id: string }[],
    parent: (id: string) => string | undefined,
  ) {
    for (const row of rows) {
      const visited = new Set<string>();
      let id: string | undefined = row.id;
      while (id) {
        assert(!visited.has(id), "ساختار گزارش‌دهی نمی‌تواند چرخه داشته باشد.");
        visited.add(id);
        id = parent(id);
      }
    }
  }
  acyclic(d.roles, (id) => d.roles.find((r) => r.id === id)?.reportsToRoleId);
  acyclic(
    d.departments,
    (id) => d.departments.find((x) => x.id === id)?.parentDepartmentId,
  );
  // Derived priority is always recomputed, never trusted from browser storage.
  return {
    ...d,
    processes: d.processes.map((p) => ({ ...p, ...calculatePriority(p) })),
  };
}
export function parseSystem(raw: string): SystemData {
  return validateSystem(JSON.parse(raw));
}
