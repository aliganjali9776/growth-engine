"use client";
import { useState } from "react";
import { Field, Button } from "@/components/system/ui";
import type { ProcessSOP } from "@/lib/system/standards/model";
import type { ProcessMap } from "@/lib/system/maps/model";
import { RoleField, LinesField } from "./shared";
export function SOPEditor({
  initial,
  map,
  onSave,
}: {
  initial: ProcessSOP;
  map: ProcessMap;
  onSave: (s: ProcessSOP) => void;
}) {
  const [s, setS] = useState(initial),
    [error, setError] = useState("");
  const change = (patch: Partial<ProcessSOP>) => setS({ ...s, ...patch });
  return (
    <form
      className="standard-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave({ ...s, updatedAt: new Date().toISOString() });
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "ذخیره ممکن نشد.");
        }
      }}
    >
      <details open>
        <summary>۱ · هدف، دامنه و نقطه شروع</summary>
        <div className="standard-fields">
          <Field label="عنوان SOP">
            <input
              value={s.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </Field>
          <div className="sys-form-grid">
            <Field label="نسخه SOP">
              <input
                required
                pattern="[0-9]+\.[0-9]+"
                value={s.version}
                onChange={(e) => change({ version: e.target.value })}
              />
            </Field>
            <Field label="وضعیت پیش‌نویس">
              <select
                value={s.status === "approved" ? "review" : s.status}
                onChange={(e) =>
                  change({ status: e.target.value as ProcessSOP["status"] })
                }
              >
                <option value="draft">پیش‌نویس</option>
                <option value="review">در حال بررسی</option>
                <option value="needs-review">نیازمند بازبینی</option>
              </select>
            </Field>
          </div>
          <Field label="هدف">
            <textarea
              value={s.purpose}
              onChange={(e) => change({ purpose: e.target.value })}
            />
          </Field>
          <Field label="دامنه">
            <textarea
              value={s.scope}
              onChange={(e) => change({ scope: e.target.value })}
            />
          </Field>
          <RoleField
            label="مالک SOP"
            value={s.processOwnerRoleId}
            onChange={(processOwnerRoleId) => change({ processOwnerRoleId })}
          />
          <Field label="نقطه شروع">
            <input
              value={s.trigger}
              onChange={(e) => change({ trigger: e.target.value })}
            />
          </Field>
        </div>
      </details>
      <details>
        <summary>۲ · ورودی‌ها، خروجی‌ها و پیش‌نیازها</summary>
        <div className="standard-fields">
          {(["inputs", "outputs", "prerequisites"] as const).map((key, i) => (
            <LinesField
              key={key}
              label={["ورودی‌ها", "خروجی‌ها", "پیش‌نیازها"][i]}
              values={s[key]}
              onChange={(value) => change({ [key]: value })}
            />
          ))}
        </div>
      </details>
      <details>
        <summary>
          ۳ · دستور اجرای مرحله‌ها (
          {s.procedureSteps.length.toLocaleString("fa-IR")})
        </summary>
        <p className="map-caption">
          مرحله‌ها به شناسه TO-BE متصل‌اند؛ دستور اجرا و معیار پذیرش را تکمیل
          کنید.
        </p>
        {s.procedureSteps.map((p, i) => (
          <details className="procedure-editor" key={p.stepId}>
            <summary>
              {map.steps.find((x) => x.id === p.stepId)?.title ??
                "مرحله حذف‌شده"}
            </summary>
            <div className="standard-fields">
              {(
                [
                  "instruction",
                  "expectedOutput",
                  "qualityCriteria",
                  "exceptionNote",
                ] as const
              ).map((key, j) => (
                <Field
                  key={key}
                  label={
                    [
                      "دستور اجرا",
                      "خروجی مورد انتظار",
                      "معیار کیفیت مرحله",
                      "استثنای مرحله",
                    ][j]
                  }
                >
                  <textarea
                    value={p[key]}
                    onChange={(e) =>
                      change({
                        procedureSteps: s.procedureSteps.map((x, n) =>
                          n === i ? { ...x, [key]: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <RoleField
                label="مسئول اجرای مرحله"
                value={p.responsibleRoleId}
                onChange={(v) =>
                  change({
                    procedureSteps: s.procedureSteps.map((x, n) =>
                      n === i ? { ...x, responsibleRoleId: v } : x,
                    ),
                  })
                }
              />
            </div>
          </details>
        ))}
      </details>
      <details>
        <summary>۴ · استثناها و ارجاع</summary>
        <div className="standard-fields">
          <LinesField
            label="استثناها"
            values={s.exceptions}
            onChange={(exceptions) => change({ exceptions })}
          />
          <LinesField
            label="قواعد ارجاع عمومی"
            values={s.escalationRules}
            onChange={(escalationRules) => change({ escalationRules })}
          />
        </div>
      </details>
      <details>
        <summary>۵ · تعریف پایان صحیح و کیفیت</summary>
        <div className="standard-fields">
          <LinesField
            label="تعریف پایان صحیح"
            values={s.definitionOfDone}
            onChange={(definitionOfDone) => change({ definitionOfDone })}
          />
          <LinesField
            label="معیارهای کیفیت"
            values={s.qualityCriteria}
            onChange={(qualityCriteria) => change({ qualityCriteria })}
          />
        </div>
      </details>
      <p className="map-caption">
        تغییر عمده را با افزایش نسخه (مثلاً 1.1 یا 2.0) مشخص کنید. تغییر محتوای
        تأییدشده نیاز به تأیید دوباره دارد.
      </p>
      {error && (
        <p role="alert" className="sys-alert">
          {error}
        </p>
      )}
      <Button type="submit">ذخیره SOP</Button>
    </form>
  );
}
