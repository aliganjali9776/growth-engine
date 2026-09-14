import {
  assetTypes,
  sopStatuses,
  pilotStatuses,
  trainingStatuses,
  goLiveStatuses,
  type StandardsStore,
  type StandardRecord,
} from "./model";
export const STANDARDS_KEY = "growth-engine.process-standards.v1";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string";
const texts = (v: unknown) => Array.isArray(v) && v.every(str);
const stamp = (v: unknown) =>
  v === undefined || (str(v) && Number.isFinite(Date.parse(v as string)));
const day = (v: unknown) =>
  v === "" ||
  (str(v) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v as string) &&
    Number.isFinite(Date.parse(v as string)) &&
    new Date(v as string).toISOString().slice(0, 10) === v);
const fields = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => str(v[k]));
const unique = (a: unknown[], key = "id") =>
  a.every(object) &&
  a.every((x) => str(x[key]) && !!x[key]) &&
  new Set(a.map((x) => (x as Record<string, unknown>)[key])).size === a.length;
export function parseStandards(raw: string): StandardsStore {
  return validateStandards(JSON.parse(raw));
}
export function validateStandards(value: unknown): StandardsStore {
  const fail = () => {
    throw new Error(
      "داده استاندارد یا پیاده‌سازی معتبر نیست؛ داده قبلی حفظ شده است.",
    );
  };
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.records) ||
    !unique(value.records, "processId")
  )
    return fail();
  for (const r of value.records) {
    if (
      !object(r) ||
      !Array.isArray(r.checklists) ||
      !Array.isArray(r.rules) ||
      !Array.isArray(r.assets) ||
      ![r.checklists, r.rules, r.assets].every((x) => unique(x))
    )
      return fail();
    if (
      ![r.standardizedAt, r.implementedAt].every(stamp) ||
      ["standardizedSignature", "implementedSignature"].some(
        (k) => r[k] !== undefined && !str(r[k]),
      )
    )
      return fail();
    const s = r.sop;
    if (s !== undefined) {
      if (
        !object(s) ||
        s.processId !== r.processId ||
        !fields(s, [
          "id",
          "title",
          "version",
          "sourceFingerprint",
          "purpose",
          "scope",
          "processOwnerRoleId",
          "trigger",
          "createdAt",
          "updatedAt",
        ]) ||
        !s.id ||
        !/^\d+\.\d+$/.test(s.version as string) ||
        !Number.isInteger(s.basedOnToBeVersion) ||
        (s.basedOnToBeVersion as number) < 1 ||
        !Object.hasOwn(sopStatuses, s.status as string) ||
        ![
          "inputs",
          "outputs",
          "prerequisites",
          "exceptions",
          "escalationRules",
          "definitionOfDone",
          "qualityCriteria",
        ].every((k) => texts(s[k])) ||
        !Array.isArray(s.procedureSteps) ||
        !unique(s.procedureSteps, "stepId") ||
        ![s.createdAt, s.updatedAt, s.approvedAt].every(stamp) ||
        ["approvedByRoleId", "approvalSignature"].some(
          (k) => s[k] !== undefined && !str(s[k]),
        )
      )
        return fail();
      for (const p of s.procedureSteps)
        if (
          !object(p) ||
          !fields(p, [
            "stepId",
            "instruction",
            "responsibleRoleId",
            "expectedOutput",
            "qualityCriteria",
            "exceptionNote",
          ])
        )
          return fail();
    }
    for (const c of r.checklists) {
      if (
        !object(c) ||
        c.processId !== r.processId ||
        !fields(c, [
          "id",
          "name",
          "description",
          "trigger",
          "ownerRoleId",
          "createdAt",
          "updatedAt",
        ]) ||
        !["draft", "ready"].includes(c.status as string) ||
        !Array.isArray(c.items) ||
        !unique(c.items) ||
        ![c.createdAt, c.updatedAt].every(stamp)
      )
        return fail();
      for (const [i, item] of c.items.entries())
        if (
          !object(item) ||
          !fields(item, ["id", "title", "relatedStepId", "note"]) ||
          typeof item.required !== "boolean" ||
          item.order !== i
        )
          return fail();
    }
    for (const x of r.rules)
      if (
        !object(x) ||
        x.processId !== r.processId ||
        !fields(x, [
          "id",
          "title",
          "relatedStepId",
          "condition",
          "action",
          "ownerRoleId",
          "escalationRoleId",
          "notes",
        ]) ||
        ![1, 2, 3].includes(x.priority as number) ||
        !["draft", "ready"].includes(x.status as string)
      )
        return fail();
    for (const a of r.assets)
      if (
        !object(a) ||
        a.processId !== r.processId ||
        !fields(a, [
          "id",
          "name",
          "description",
          "relatedStepId",
          "reference",
          "version",
        ]) ||
        !Object.hasOwn(assetTypes, a.type as string) ||
        !["draft", "ready"].includes(a.status as string)
      )
        return fail();
    const p = r.plan;
    if (
      !object(p) ||
      p.processId !== r.processId ||
      !fields(p, [
        "implementationOwnerRoleId",
        "pilotOwnerRoleId",
        "pilotNotes",
        "pilotIssues",
        "pilotOutcome",
        "notes",
        "updatedAt",
      ]) ||
      !["targetGoLiveDate", "pilotStartDate", "pilotEndDate"].every((k) =>
        day(p[k]),
      ) ||
      ![
        "pilotRequired",
        "pilotFeedbackReviewed",
        "trainingRequired",
        "ownerConfirmed",
        "teamBriefed",
        "toolsReady",
        "templatesRequired",
        "templatesReady",
      ].every((k) => typeof p[k] === "boolean") ||
      !Object.hasOwn(pilotStatuses, p.pilotStatus as string) ||
      !Object.hasOwn(trainingStatuses, p.trainingStatus as string) ||
      !Object.hasOwn(goLiveStatuses, p.goLiveStatus as string) ||
      !Array.isArray(p.roles) ||
      !unique(p.roles, "roleId") ||
      ![p.updatedAt, p.goLiveAt].every(stamp)
    )
      return fail();
    for (const x of p.roles)
      if (
        !object(x) ||
        typeof x.trained !== "boolean" ||
        typeof x.acknowledged !== "boolean"
      )
        return fail();
  }
  return structuredClone(value) as unknown as StandardsStore;
}
export function replaceStandard(store: StandardsStore, record: StandardRecord) {
  return validateStandards({
    ...store,
    records: [
      ...store.records.filter((r) => r.processId !== record.processId),
      record,
    ],
  });
}
