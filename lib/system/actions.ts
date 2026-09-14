import type {
  Department,
  Role,
  Person,
  Process,
  SystemData,
  SystemizationStage,
} from "./types";
import { validateSystem } from "./persistence";
import { calculatePriority } from "./scoring";
export type SystemCollection = "departments" | "roles" | "people" | "processes";
export type SystemEntity = Department | Role | Person | Process;
export function saveEntity(
  data: SystemData,
  collection: SystemCollection,
  entity: SystemEntity,
): SystemData {
  const next = structuredClone(data);
  const rows = next[collection] as SystemEntity[];
  const index = rows.findIndex((x) => x.id === entity.id);
  const saved =
    collection === "processes"
      ? {
          ...entity,
          ...calculatePriority(entity as Process),
          updatedAt: new Date().toISOString(),
        }
      : entity;
  if (index < 0) rows.push(saved);
  else rows[index] = saved;
  return validateSystem(next);
}
export function deleteEntity(
  data: SystemData,
  collection: SystemCollection,
  id: string,
): SystemData {
  const next = structuredClone(data);
  if (
    collection === "roles" &&
    (data.processes.some((p) => p.ownerRoleId === id) ||
      data.roles.some((r) => r.reportsToRoleId === id) ||
      data.departments.some((d) => d.managerRoleId === id))
  )
    throw new Error(
      "این نقش در فرآیندها یا ساختار سازمانی استفاده می‌شود؛ ابتدا ارتباط‌های آن را تغییر دهید.",
    );
  if (collection === "people" && data.roles.some((r) => r.personId === id))
    throw new Error(
      "ابتدا فرد را از نقش‌های مربوط جدا کنید یا وضعیت او را بایگانی کنید.",
    );
  if (
    collection === "departments" &&
    (data.roles.some((r) => r.departmentId === id) ||
      data.processes.some((p) => p.departmentId === id) ||
      data.departments.some((d) => d.parentDepartmentId === id))
  )
    throw new Error("این واحد دارای ارتباط فعال است؛ از بایگانی استفاده کنید.");
  (next[collection] as SystemEntity[]) = next[collection].filter(
    (x) => x.id !== id,
  );
  return validateSystem(next);
}
export function changeStage(
  data: SystemData,
  id: string,
  stage: SystemizationStage,
) {
  const p = data.processes.find((x) => x.id === id);
  if (!p) throw new Error("فرآیند پیدا نشد.");
  return saveEntity(data, "processes", { ...p, systemizationStage: stage });
}
export function nextProcessCode(data: SystemData) {
  let n = 1;
  while (
    data.processes.some((p) => p.code === `P${String(n).padStart(3, "0")}`)
  )
    n++;
  return `P${String(n).padStart(3, "0")}`;
}
