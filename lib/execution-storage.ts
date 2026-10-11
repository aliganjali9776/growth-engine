import {
  emptyExecution,
  type ExecutionState,
  type ExecutionStorage,
} from "./agent/execution/types";
import { executable } from "./agent/execution/registry";
import { canonical } from "./agent/actions";
export const EXECUTION_KEY = "growth-engine.agent.execution.v1";
export function validateExecution(s: ExecutionState) {
  if (
    !s ||
    s.version !== 1 ||
    ![s.records, s.rollbacks, s.audit].every(
      (x) =>
        Array.isArray(x) &&
        x.length <= 20000 &&
        new Set(x.map((v) => v.id)).size === x.length,
    )
  )
    throw Error("داده اجرای اقدامات نامعتبر است.");
  for (const r of s.records) {
    const cap = executable(r.templateId);
    if (
      !cap ||
      r.capabilityId !== cap.capabilityId ||
      r.domain !== cap.domain ||
      r.command.sourceActionId !== r.actionId ||
      r.command.commandId !== r.commandId ||
      r.command.capabilityId !== r.capabilityId ||
      r.command.domain !== r.domain ||
      r.command.operation !== "create" ||
      !r.binding ||
      !r.approvalId ||
      !Number.isInteger(r.approvedRevision) ||
      !Array.isArray(r.entityRefs) ||
      ![
        "Pending",
        "Executing",
        "Succeeded",
        "Failed",
        "PartiallyRecovered",
        "RolledBack",
      ].includes(r.status) ||
      !Number.isFinite(Date.parse(r.startedAt))
    )
      throw Error("رکورد اجرا معتبر نیست.");
    if (
      !s.rollbacks.some(
        (b) => b.id === r.rollbackRecordId && b.executionId === r.id,
      )
    )
      throw Error("سابقه بازیابی موجود نیست.");
    if (
      ["Succeeded", "RolledBack"].includes(r.status) &&
      (!r.afterSnapshot || !r.entityRefs.length || !r.completedAt)
    )
      throw Error("نتیجه تأییدشده اجرا ناقص است.");
  }
  for (const b of s.rollbacks)
    if (
      !s.records.some((r) => r.id === b.executionId) ||
      !["NotSupported", "CompensatingAction", "RestoreSnapshot"].includes(
        b.rollbackType,
      ) ||
      !["Available", "NotSupported", "RolledBack", "Failed"].includes(b.status)
    )
      throw Error("قرارداد بازیابی نامعتبر است.");
  for (const a of s.audit)
    if (
      !s.records.some((r) => r.id === a.executionId) ||
      !Number.isFinite(Date.parse(a.at))
    )
      throw Error("سابقه اجرا نامعتبر است.");
  if (JSON.stringify(s).length > 8_000_000)
    throw Error("ظرفیت تاریخچه اجرا کافی نیست.");
}
export function readExecution(storage: Pick<Storage, "getItem">) {
  let raw: string | null = null;
  try {
    raw = storage.getItem(EXECUTION_KEY);
    if (!raw) return { state: emptyExecution(), raw };
    if (raw.length > 8_000_000) throw Error();
    const state = JSON.parse(raw) as ExecutionState;
    validateExecution(state);
    return { state, raw };
  } catch {
    return {
      state: emptyExecution(),
      raw,
      error:
        "داده تاریخچه اجرا قابل خواندن نیست؛ اجرا متوقف است و نسخه قبلی حفظ شد.",
    };
  }
}
export function saveExecution(
  storage: ExecutionStorage,
  s: ExecutionState,
  expected: string | null,
) {
  validateExecution(s);
  const previous = readExecution(storage);
  if (!previous.error) {
    if (
      previous.state.audit.some(
        (event, index) => canonical(s.audit[index]) !== canonical(event),
      )
    )
      throw Error("سابقه حسابرسی قابل تغییر یا حذف نیست.");
    for (const old of previous.state.records) {
      const next = s.records.find((r) => r.id === old.id);
      if (!next) throw Error("تاریخچه اجرا قابل حذف نیست.");
      if (["Succeeded", "RolledBack"].includes(old.status)) {
        const { status: oldStatus, ...oldFields } = old,
          { status: nextStatus, ...nextFields } = next;
        if (
          canonical(oldFields) !== canonical(nextFields) ||
          !(
            nextStatus === oldStatus ||
            (oldStatus === "Succeeded" && nextStatus === "RolledBack")
          )
        )
          throw Error("نتیجه اجرای ثبت‌شده تغییرپذیر نیست.");
      }
    }
  }
  if (
    readExecution(storage).error ||
    storage.getItem(EXECUTION_KEY) !== expected
  )
    throw Error("تاریخچه اجرا تغییر کرده است؛ صفحه را تازه کنید.");
  const raw = JSON.stringify(s);
  storage.setItem(EXECUTION_KEY, raw);
  return raw;
}
