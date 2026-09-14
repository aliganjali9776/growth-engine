import type { StandardRecord, ProcessSOP } from "./model";
import type { ProcessMap } from "../maps/model";
import type { SystemData } from "../types";
import {
  approvalCurrent,
  fingerprint,
  type AnalysisRecord,
} from "../analysis/redesign";
import { operational } from "../maps/logic";
import { changeStage } from "../actions";
export interface StandardSource {
  asis: ProcessMap;
  analysis: AnalysisRecord;
  system: SystemData;
}
export const filled = (s: string | undefined) => !!s?.trim();
const list = (a: string[] | undefined) => !!a?.some(filled);
const ratio = (n: number, d: number) => (d ? n / d : 0);
export function standardSignature(r: StandardRecord) {
  const s = r.sop;
  if (!s) return "";
  const {
    approvedAt,
    approvedByRoleId,
    approvalSignature,
    createdAt,
    updatedAt,
    status,
    ...content
  } = s;
  return JSON.stringify({
    sop: content,
    checklists: r.checklists.map(({ createdAt, updatedAt, ...c }) => c),
    rules: r.rules,
    assets: r.assets,
  });
}
export function sourceChanged(
  sop: ProcessSOP | undefined,
  source: StandardSource,
) {
  return (
    !sop ||
    !source.analysis.toBe ||
    sop.basedOnToBeVersion !== (source.analysis.toBe.version ?? 1) ||
    sop.sourceFingerprint !== fingerprint(source.analysis.toBe, source.system)
  );
}
export function sourceApproved(source: StandardSource) {
  return approvalCurrent(source.analysis, source.asis, source.system);
}
export function effectiveSOPStatus(r: StandardRecord, source: StandardSource) {
  if (!r.sop) return "draft";
  if (sourceChanged(r.sop, source) || !sourceApproved(source))
    return "needs-review";
  if (
    r.sop.status === "approved" &&
    r.sop.approvedAt &&
    r.sop.approvalSignature === standardSignature(r) &&
    source.system.roles.some((x) => x.id === r.sop!.approvedByRoleId)
  )
    return "approved";
  return r.sop.status === "approved" ? "needs-review" : r.sop.status;
}
export function standardization(r: StandardRecord, source: StandardSource) {
  const s = r.sop,
    map = source.analysis.toBe,
    sys = source.system,
    ops = map?.steps.filter(operational) ?? [],
    decisions = map?.steps.filter((x) => x.type === "decision") ?? [],
    role = (id: string | undefined) => sys.roles.some((r) => r.id === id),
    step = (id: string) => !id || !!map?.steps.some((s) => s.id === id);
  const core = [
    filled(s?.title),
    filled(s?.purpose),
    filled(s?.scope),
    role(s?.processOwnerRoleId),
    filled(s?.trigger),
    list(s?.inputs),
    list(s?.outputs),
    list(s?.prerequisites),
    list(s?.qualityCriteria),
  ];
  const procedures = ops.filter((o) =>
    s?.procedureSteps.some(
      (p) =>
        p.stepId === o.id &&
        filled(p.instruction) &&
        role(p.responsibleRoleId) &&
        filled(p.expectedOutput) &&
        filled(p.qualityCriteria),
    ),
  );
  const validChecklists = r.checklists.filter(
    (c) =>
      c.status === "ready" &&
      filled(c.name) &&
      filled(c.trigger) &&
      role(c.ownerRoleId) &&
      c.items.length > 0 &&
      c.items.every((i) => filled(i.title) && step(i.relatedStepId)),
  );
  const validRules = r.rules.filter(
    (x) =>
      x.status === "ready" &&
      filled(x.title) &&
      filled(x.condition) &&
      filled(x.action) &&
      role(x.ownerRoleId) &&
      (!x.escalationRoleId || role(x.escalationRoleId)) &&
      step(x.relatedStepId),
  );
  const validAssets = r.assets.filter(
    (a) =>
      a.status === "ready" &&
      filled(a.name) &&
      filled(a.reference) &&
      filled(a.version) &&
      step(a.relatedStepId),
  );
  const components = [
    {
      label: "بخش‌های اصلی SOP",
      weight: 35,
      value: ratio(core.filter(Boolean).length, core.length),
    },
    {
      label: "دستور مراحل",
      weight: 20,
      value: ratio(procedures.length, ops.length),
    },
    {
      label: "پوشش چک‌لیست",
      weight: 15,
      value: ratio(
        ops.filter((o) =>
          validChecklists.some((c) =>
            c.items.some((i) => i.relatedStepId === o.id),
          ),
        ).length,
        ops.length,
      ),
    },
    {
      label: "قواعد تصمیم",
      weight: 10,
      value: decisions.length
        ? ratio(
            decisions.filter((d) =>
              validRules.some((r) => r.relatedStepId === d.id),
            ).length,
            decisions.length,
          )
        : 1,
    },
    {
      label: "تعریف پایان صحیح",
      weight: 10,
      value: list(s?.definitionOfDone) ? 1 : 0,
    },
    {
      label: "دارایی‌های آماده",
      weight: 10,
      value: validAssets.length ? 1 : 0,
    },
  ];
  const score = s
      ? Math.round(components.reduce((n, c) => n + c.weight * c.value, 0))
      : 0,
    warnings: string[] = [];
  if (!sourceApproved(source)) warnings.push("TO-BE تأیید معتبر ندارد.");
  if (sourceChanged(s, source))
    warnings.push(
      "TO-BE تغییر کرده است؛ استاندارد اجرایی نیازمند بازبینی است.",
    );
  if (!s || !filled(s.purpose)) warnings.push("هدف SOP ثبت نشده است.");
  if (!role(s?.processOwnerRoleId)) warnings.push("مالک معتبر SOP مشخص نیست.");
  if (!filled(s?.trigger)) warnings.push("نقطه شروع ثبت نشده است.");
  if (!list(s?.inputs) || !list(s?.outputs))
    warnings.push("ورودی‌ها و خروجی‌ها کامل نیستند.");
  if (!ops.length || procedures.length !== ops.length)
    warnings.push("دستور، مسئول، خروجی یا معیار کیفیت برخی مراحل کامل نیست.");
  if (!list(s?.definitionOfDone)) warnings.push("تعریف پایان صحیح وجود ندارد.");
  if (decisions.some((d) => !validRules.some((r) => r.relatedStepId === d.id)))
    warnings.push("برخی تصمیم‌های TO-BE قاعده آماده ندارند.");
  if (r.checklists.some((c) => !validChecklists.includes(c)))
    warnings.push("چک‌لیست ناتمام یا دارای مرجع نامعتبر وجود دارد.");
  if (r.rules.some((c) => !validRules.includes(c)))
    warnings.push("قاعده ناتمام یا دارای مرجع نامعتبر وجود دارد.");
  if (r.assets.some((c) => !validAssets.includes(c)))
    warnings.push("دارایی ناتمام یا دارای مرجع نامعتبر وجود دارد.");
  if (s?.procedureSteps.some((p) => !step(p.stepId)))
    warnings.push("دستور مربوط به مرحله حذف‌شده وجود دارد.");
  if (score < 90) warnings.push("کامل‌بودن استاندارد کمتر از ۹۰٪ است.");
  return {
    score,
    components,
    warnings,
    label:
      score >= 90
        ? "آماده استانداردسازی"
        : score >= 70
          ? "آماده بررسی"
          : score >= 40
            ? "در حال تکمیل"
            : "ناقص",
    approvable: warnings.length === 0,
    ready:
      warnings.length === 0 && effectiveSOPStatus(r, source) === "approved",
    validChecklists,
    validRules,
    validAssets,
  };
}
export function standardizedCurrent(r: StandardRecord, source: StandardSource) {
  return (
    !!r.standardizedAt &&
    r.standardizedSignature === standardSignature(r) &&
    standardization(r, source).ready
  );
}
export function approveSOP(
  r: StandardRecord,
  source: StandardSource,
  roleId: string,
): StandardRecord {
  if (
    !r.sop ||
    !standardization(r, source).approvable ||
    !source.system.roles.some((x) => x.id === roleId)
  )
    throw new Error(
      "ابتدا موارد ناقص استاندارد و نقش تأییدکننده را تکمیل کنید.",
    );
  return {
    ...r,
    sop: {
      ...r.sop,
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvedByRoleId: roleId,
      approvalSignature: standardSignature(r),
    },
  };
}
export function confirmStandardization(
  r: StandardRecord,
  source: StandardSource,
) {
  const p = source.system.processes.find((p) => p.id === r.processId);
  if (
    !p ||
    ![
      "redesigned",
      "standardized",
      "implemented",
      "measured",
      "improving",
    ].includes(p.systemizationStage) ||
    !standardization(r, source).ready
  )
    throw new Error(
      "SOP تأییدشده و آمادگی استانداردسازی و مرحله بازطراحی لازم است.",
    );
  const record = {
    ...r,
    standardizedAt: new Date().toISOString(),
    standardizedSignature: standardSignature(r),
    implementedAt: undefined,
    implementedSignature: undefined,
  };
  return {
    record,
    system:
      p.systemizationStage === "redesigned"
        ? changeStage(source.system, p.id, "standardized")
        : source.system,
  };
}
export function implementation(r: StandardRecord, source: StandardSource) {
  const p = r.plan,
    sys = source.system,
    role = (id: string) => sys.roles.some((r) => r.id === id),
    std = standardization(r, source),
    trained = p.roles.filter((r) => r.trained && role(r.roleId)).length,
    acks = p.roles.filter((r) => r.acknowledged && role(r.roleId)).length;
  const trainingComplete =
      !p.trainingRequired ||
      (p.trainingStatus === "completed" &&
        p.roles.length > 0 &&
        trained === p.roles.length),
    pilotComplete =
      !p.pilotRequired ||
      (p.pilotStatus === "completed" &&
        role(p.pilotOwnerRoleId) &&
        filled(p.pilotStartDate) &&
        filled(p.pilotEndDate) &&
        p.pilotEndDate >= p.pilotStartDate &&
        filled(p.pilotOutcome) &&
        p.pilotFeedbackReviewed);
  const blockers: string[] = [];
  if (!standardizedCurrent(r, source))
    blockers.push("استانداردسازی معتبر و SOP نهایی لازم است.");
  if (!role(p.implementationOwnerRoleId))
    blockers.push("مالک پیاده‌سازی مشخص نیست.");
  if (!p.ownerConfirmed) blockers.push("مالک مسئولیت اجرا را تأیید نکرده است.");
  if (!p.teamBriefed) blockers.push("تیم توجیه نشده است.");
  if (!p.toolsReady) blockers.push("ابزارهای اجرا آماده نیستند.");
  if (p.templatesRequired && (!p.templatesReady || !std.validAssets.length))
    blockers.push("دارایی‌ها و قالب‌های موردنیاز آماده نیستند.");
  if (!trainingComplete)
    blockers.push("آموزش الزامی همه نقش‌ها تکمیل نشده است.");
  if (!pilotComplete)
    blockers.push("پایلوت الزامی و بررسی بازخورد آن تکمیل نشده است.");
  if (p.roles.some((r) => !role(r.roleId)))
    blockers.push("نقش حذف‌شده در برنامه وجود دارد.");
  const operationalReady =
    role(p.implementationOwnerRoleId) &&
    p.teamBriefed &&
    p.toolsReady &&
    (!p.templatesRequired || p.templatesReady);
  const components = [
    {
      label: "تأیید مالک",
      weight: 15,
      value: p.ownerConfirmed && role(p.implementationOwnerRoleId) ? 1 : 0,
    },
    {
      label: "آموزش",
      weight: 20,
      value: p.trainingRequired
        ? p.trainingStatus === "completed"
          ? ratio(trained, p.roles.length)
          : 0
        : 1,
    },
    { label: "پایلوت", weight: 20, value: pilotComplete ? 1 : 0 },
    {
      label: "Go-Live",
      weight: 20,
      value: p.goLiveStatus === "live" && blockers.length === 0 ? 1 : 0,
    },
    {
      label: "تأیید مطالعه نقش‌ها",
      weight: 15,
      value: ratio(acks, p.roles.length),
    },
    { label: "آمادگی عملیاتی", weight: 10, value: operationalReady ? 1 : 0 },
  ];
  const score = Math.round(
      components.reduce((n, c) => n + c.weight * c.value, 0),
    ),
    risks = [...blockers];
  if (acks < p.roles.length)
    risks.push(`${p.roles.length - acks} نقش مطالعه SOP را تأیید نکرده‌اند.`);
  if (p.goLiveStatus !== "live") risks.push("فرآیند هنوز در وضعیت Live نیست.");
  if (score < 70) risks.push("شاخص پذیرش کمتر از ۷۰٪ است.");
  if (
    sys.roles.find((r) => r.id === p.implementationOwnerRoleId)?.isFounderRole
  )
    risks.push("بنیان‌گذار هنوز مالک اجرایی این فرآیند است.");
  return {
    score,
    components,
    blockers,
    risks,
    trained,
    acks,
    trainingComplete,
    pilotComplete,
    goLiveReady: blockers.length === 0,
    ready: blockers.length === 0 && p.goLiveStatus === "live" && score >= 70,
    status:
      score === 0
        ? "شروع نشده"
        : p.goLiveStatus === "live" && blockers.length === 0 && score >= 85
          ? "پذیرفته‌شده"
          : score >= 40
            ? "در حال شکل‌گیری"
            : "پایین",
    interpretation:
      p.goLiveStatus !== "live"
        ? "استاندارد مستند است؛ استفاده واقعی هنوز Live ثبت نشده است."
        : score >= 85 && blockers.length === 0
          ? "بر اساس تأییدهای دستی، آمادگی پذیرش بالاست؛ استفاده پایدار باید در عمل بررسی شود."
          : "اجرا ثبت شده، اما بخشی از آموزش، تأییدها یا آمادگی هنوز نیازمند توجه است.",
  };
}
export function implementationSignature(r: StandardRecord) {
  const { updatedAt, ...plan } = r.plan;
  return JSON.stringify({ standard: standardSignature(r), plan });
}
export function implementedCurrent(r: StandardRecord, source: StandardSource) {
  return (
    !!r.implementedAt &&
    r.implementedSignature === implementationSignature(r) &&
    implementation(r, source).ready
  );
}
export function confirmGoLive(
  r: StandardRecord,
  source: StandardSource,
): StandardRecord {
  if (!implementation(r, source).goLiveReady)
    throw new Error("موانع حیاتی Go-Live را برطرف کنید.");
  return {
    ...r,
    plan: {
      ...r.plan,
      goLiveStatus: "live",
      goLiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}
export function confirmImplementation(
  r: StandardRecord,
  source: StandardSource,
) {
  const p = source.system.processes.find((p) => p.id === r.processId);
  if (
    !p ||
    !["standardized", "implemented", "measured", "improving"].includes(
      p.systemizationStage,
    ) ||
    !implementation(r, source).ready
  )
    throw new Error("استانداردسازی معتبر، Live و پذیرش حداقل ۷۰٪ لازم است.");
  return {
    record: {
      ...r,
      implementedAt: new Date().toISOString(),
      implementedSignature: implementationSignature(r),
    },
    system:
      p.systemizationStage === "standardized"
        ? changeStage(source.system, p.id, "implemented")
        : source.system,
  };
}
