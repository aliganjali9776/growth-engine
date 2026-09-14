import type { StandardRecord } from "./model";
import type { StandardSource } from "./logic";
import { standardizedCurrent, implementedCurrent } from "./logic";
import type { SystemizationStage } from "../types";
export function guardStage(
  stage: SystemizationStage,
  record: StandardRecord | undefined,
  source: StandardSource | undefined,
) {
  if (stage === "measured" || stage === "improving")
    throw new Error(
      "برای اندازه‌گیری یا بهبود، از صفحه مربوط پس از تکمیل پیش‌نیازها تأیید کنید.",
    );
  if (
    stage === "standardized" &&
    (!record || !source || !standardizedCurrent(record, source))
  )
    throw new Error(
      "برای استانداردسازی از صفحه استاندارد اجرایی، پس از تأیید SOP و رفع موانع اقدام کنید.",
    );
  if (
    stage === "implemented" &&
    (!record || !source || !implementedCurrent(record, source))
  )
    throw new Error(
      "برای پیاده‌سازی از صفحه اجرا، پس از Go-Live و تأیید آمادگی اقدام کنید.",
    );
}
export function referencedRoles(r: StandardRecord) {
  return [
    r.sop?.processOwnerRoleId,
    r.sop?.approvedByRoleId,
    ...(r.sop?.procedureSteps.map((p) => p.responsibleRoleId) ?? []),
    ...r.checklists.map((c) => c.ownerRoleId),
    ...r.rules.flatMap((x) => [x.ownerRoleId, x.escalationRoleId]),
    r.plan.implementationOwnerRoleId,
    r.plan.pilotOwnerRoleId,
    ...r.plan.roles.map((x) => x.roleId),
  ];
}
