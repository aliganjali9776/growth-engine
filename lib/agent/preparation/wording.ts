import type { PreparationState, PreparedAction } from "./types";
import type { PreparationContext } from "./context";
import { editDraft } from "./engine";
import { canonical } from "../actions";
// Untrusted model output can improve wording only. It cannot choose identities, numbers, dates, permissions or state.
export function applyDraftWording(
  s: PreparationState,
  c: PreparationContext,
  id: string,
  output: unknown,
) {
  const a = s.actions.find((a) => a.id === id);
  if (!a) throw Error("پیش‌نویس پیدا نشد.");
  if (!output || typeof output !== "object" || Array.isArray(output))
    throw Error("متن مدل معتبر نیست.");
  const fields = output as Record<string, unknown>,
    allowed = [
      "title",
      "description",
      "hypothesis.change",
      "hypothesis.rationale",
    ];
  if (
    !Object.keys(fields).length ||
    Object.keys(fields).some(
      (k) => !allowed.includes(k) || !a.fields.some((f) => f.path === k),
    )
  )
    throw Error("مدل فقط مجاز به بهبود متن محدود است.");
  for (const v of Object.values(fields))
    if (
      typeof v !== "string" ||
      !v.trim() ||
      v.length > 600 ||
      /[0-9۰-۹٠-٩]|https?:|ignore|نادیده|قطعاً|تضمین|حتماً/i.test(v)
    )
      throw Error("متن مدل شامل ادعای عددی، دستور یا قطعیت پشتیبانی‌نشده است.");
  const before = canonical({
    risk: a.risk,
    capability: a.capabilityId,
    refs: a.affectedEntities,
    status: a.status,
  });
  editDraft(s, c, id, fields);
  const revision = s.revisions.at(-1)!;
  revision.source = "Agent";
  for (const f of a.fields.filter((f) => Object.hasOwn(fields, f.path)))
    f.source = "AgentSuggested";
  if (a.risk !== JSON.parse(before).risk)
    throw Error("تغییر اختیار مجاز نیست.");
  return a;
}
export function compareDrafts(a: PreparedAction, b: PreparedAction) {
  return {
    sameCapability: a.capabilityId === b.capabilityId,
    fields: [
      ...new Set([
        ...a.fields.map((f) => f.path),
        ...b.fields.map((f) => f.path),
      ]),
    ]
      .map((path) => ({
        path,
        left: path
          .split(".")
          .reduce<unknown>(
            (v, k) =>
              v && typeof v === "object"
                ? (v as Record<string, unknown>)[k]
                : undefined,
            a.payload,
          ),
        right: path
          .split(".")
          .reduce<unknown>(
            (v, k) =>
              v && typeof v === "object"
                ? (v as Record<string, unknown>)[k]
                : undefined,
            b.payload,
          ),
      }))
      .filter((x) => canonical(x.left) !== canonical(x.right)),
  };
}
