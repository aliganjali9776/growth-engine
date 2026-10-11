"use client";
import { useState } from "react";
import { Button, Drawer, Field } from "@/components/system/ui";
import { Text, Select, Owner, Numeric } from "./shared";
import { useScale } from "./provider";
import { levels } from "@/lib/scale/model";
import * as E from "@/lib/scale/experiments/model";
import {
  saveExperiment,
  addGrowthMetric,
} from "@/lib/scale/experiments/mutations";
import { experimentReadiness } from "@/lib/scale/experiments/logic";
export function ExperimentEditor({
  initial,
  close,
}: {
  initial: E.GrowthExperiment;
  close: () => void;
}) {
  const { store, commit } = useScale(),
    [e, setE] = useState(initial),
    [error, setError] = useState("");
  const data = E.experimentData(store),
    update = (key: keyof E.GrowthExperiment, value: unknown) =>
      setE({ ...e, [key]: value });
  return (
    <Drawer
      open
      onClose={close}
      title="طراحی آزمایش"
      description="پس از شروع، معیارها و طراحی ثابت می‌مانند؛ تغییر بعدی نسخه جداگانه است."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            commit(saveExperiment(store, e));
            close();
          } catch (x) {
            setError(x instanceof Error ? x.message : "ذخیره نشد");
          }
        }}
      >
        <Text
          required
          label="عنوان آزمایش"
          value={e.title}
          onChange={(v) => update("title", v)}
        />
        <Text
          area
          label="شرح آزمایش"
          value={e.description}
          onChange={(v) => update("description", v)}
        />
        <Select
          label="نوع آزمایش"
          value={e.type}
          items={E.experimentTypes}
          onChange={(v) => update("type", v)}
        />
        <Select
          label="گلوگاه آزمایش"
          value={e.constraintId}
          empty="انتخاب گلوگاه"
          items={Object.fromEntries(
            store.constraints.map((c) => [c.id, c.title]),
          )}
          onChange={(v) => update("constraintId", v)}
        />
        <Select
          label="اهرم آزمایش"
          value={e.leverId}
          empty="بدون اهرم"
          items={Object.fromEntries(store.levers.map((l) => [l.id, l.name]))}
          onChange={(v) => update("leverId", v)}
        />
        <Owner
          value={e.ownerRoleId}
          onChange={(v) => update("ownerRoleId", v)}
        />
        <h3>فرضیه</h3>
        {(
          [
            ["change", "اگر این تغییر را انجام دهیم"],
            ["audience", "برای این مخاطب / زمینه"],
            ["movement", "انتظار این حرکت در نتیجه را داریم"],
            ["rationale", "زیرا"],
          ] as const
        ).map(([k, label]) => (
          <Text
            key={k}
            area
            label={label}
            value={e.hypothesis[k]}
            onChange={(v) => update("hypothesis", { ...e.hypothesis, [k]: v })}
          />
        ))}
        <h3>طراحی</h3>
        {(
          [
            ["change", "دقیقاً چه تغییری اجرا می‌شود؟"],
            ["audience", "دامنه اجرا / مخاطب"],
            ["channel", "کانال"],
            ["sample", "حجم نمونه / اجرا (در صورت کاربرد)"],
            ["comparison", "گروه یا دوره مقایسه (اختیاری)"],
            ["notes", "یادداشت طراحی"],
          ] as const
        ).map(([k, label]) => (
          <Text
            key={k}
            area
            label={label}
            value={e.experimentDesign[k]}
            onChange={(v) =>
              update("experimentDesign", { ...e.experimentDesign, [k]: v })
            }
          />
        ))}
        <h3>شاخص و معیار پیش از اجرا</h3>
        <Select
          label="شاخص اصلی آزمایش"
          value={e.primaryMetricId}
          empty="انتخاب شاخص"
          items={Object.fromEntries(
            data.metrics.map((m) => [
              m.id,
              `${m.name} · ${m.unit} · ${E.directions[m.direction]}`,
            ]),
          )}
          onChange={(v) =>
            setE({
              ...e,
              primaryMetricId: v,
              secondaryMetricIds: e.secondaryMetricIds.filter((id) => id !== v),
              baselineValue: null,
              targetValue: null,
              minimumSuccessThreshold: null,
            })
          }
        />
        <p>
          تعویض شاخص، مقادیر خط مبنا و هدف فرم را پاک می‌کند تا واحد قبلی اشتباه
          استفاده نشود.
        </p>
        <Numeric
          label="خط مبنا"
          value={e.baselineValue}
          onChange={(v) => update("baselineValue", v)}
        />
        <Text
          label="دوره خط مبنا / واحد زمانی مشاهده"
          value={e.baselinePeriod}
          onChange={(v) => update("baselinePeriod", v)}
        />
        <Text
          label="منبع یا توضیح خط مبنا"
          value={e.baselineSource}
          onChange={(v) => update("baselineSource", v)}
        />
        <Numeric
          label="هدف موفقیت / سطح مطلوب حفظ"
          value={e.targetValue}
          onChange={(v) => update("targetValue", v)}
        />
        <Numeric
          label="حداقل موفقیت (اختیاری)"
          value={e.minimumSuccessThreshold}
          onChange={(v) => update("minimumSuccessThreshold", v)}
        />
        <Numeric
          label="آستانه تغییر / تلورانس مطلق در واحد شاخص"
          value={e.tolerance}
          onChange={(v) => update("tolerance", v ?? 0)}
        />
        <Text
          area
          label="معیار موفقیت و مقایسه دوره‌های هم‌اندازه"
          value={e.successCriteria}
          onChange={(v) => update("successCriteria", v)}
        />
        <p>
          دودویی: ۱ یعنی پذیرش و ۰ یعنی عدم پذیرش؛ خط مبنای عددی الزامی نیست.
          برای حفظ سطح، فاصله از هدف با تلورانس مقایسه می‌شود. هیچ آزمون
          معنی‌داری آماری انجام نمی‌شود.
        </p>
        <details>
          <summary>شاخص‌های ثانویه / محافظ (اختیاری)</summary>
          {data.metrics
            .filter((m) => m.id !== e.primaryMetricId)
            .map((m) => (
              <label key={m.id} className="scale-check">
                <input
                  type="checkbox"
                  checked={e.secondaryMetricIds.includes(m.id)}
                  onChange={(ev) =>
                    update(
                      "secondaryMetricIds",
                      ev.target.checked
                        ? [...e.secondaryMetricIds, m.id]
                        : e.secondaryMetricIds.filter((id) => id !== m.id),
                    )
                  }
                />
                {m.name}
              </label>
            ))}
        </details>
        <div className="scale-grid">
          <Field label="شروع برنامه‌ریزی‌شده">
            <input
              type="date"
              value={e.startDate}
              onInput={(ev) => update("startDate", ev.currentTarget.value)}
            />
          </Field>
          <Field label="پایان برنامه‌ریزی‌شده">
            <input
              type="date"
              value={e.endDate}
              onInput={(ev) => update("endDate", ev.currentTarget.value)}
            />
          </Field>
        </div>
        <Select
          label="اطمینان پیش از آزمایش"
          value={e.confidenceBefore ?? ""}
          empty="نامشخص"
          items={levels}
          onChange={(v) => update("confidenceBefore", v || null)}
        />
        <p>
          نیازمند تکمیل:{" "}
          {experimentReadiness(store, e).missing.join("، ") ||
            "طراحی آماده بررسی است"}
        </p>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره طراحی</Button>
      </form>
    </Drawer>
  );
}
export function MetricEditor({ close }: { close: () => void }) {
  const { store, sources, commit } = useScale(),
    [m, setM] = useState<E.GrowthMetric>({
      id: crypto.randomUUID(),
      name: "",
      category: "custom",
      unit: "تعداد",
      direction: "increase",
      sourceType: "manual",
      sourceId: "",
      custom: true,
      description: "",
    }),
    [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={close}
      title="تعریف شاخص رشد"
      description="ارجاع به منبع فقط خواندنی است؛ اندازه‌گیری آزمایش جدا ثبت می‌شود."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(addGrowthMetric(store, m));
            close();
          } catch (x) {
            setError(String(x));
          }
        }}
      >
        <Select
          label="منبع شاخص"
          value={m.sourceType}
          items={E.sourceTypes}
          onChange={(v) =>
            setM({
              ...m,
              sourceType: v as E.GrowthMetric["sourceType"],
              sourceId: "",
            })
          }
        />
        {m.sourceType === "strategy" && (
          <Select
            label="ارجاع نتیجه کلیدی"
            value={m.sourceId}
            empty="انتخاب"
            items={Object.fromEntries(
              sources.keyResults
                .filter((k) => k.type !== "milestone")
                .map((k) => [
                  k.id,
                  `${k.title} · ${sources.cycleLabels[k.cycleId]}`,
                ]),
            )}
            onChange={(v) => {
              const k = sources.keyResults.find((k) => k.id === v);
              setM({
                ...m,
                sourceId: v,
                ...(k
                  ? {
                      name: k.title,
                      unit: k.unit || "تعداد",
                      direction: k.type as E.GrowthMetric["direction"],
                    }
                  : {}),
              });
            }}
          />
        )}
        {m.sourceType === "system" && (
          <Select
            label="ارجاع شاخص سیستم"
            value={m.sourceId}
            empty="انتخاب"
            items={Object.fromEntries(
              sources.systemKPIs.map((k) => [k.id, k.name]),
            )}
            onChange={(v) => {
              const k = sources.systemKPIs.find((k) => k.id === v);
              setM({
                ...m,
                sourceId: v,
                ...(k
                  ? {
                      name: k.name,
                      unit: k.unit || "تعداد",
                      direction: k.direction,
                    }
                  : {}),
              });
            }}
          />
        )}
        <Text
          required
          label="نام شاخص"
          value={m.name}
          onChange={(v) => setM({ ...m, name: v })}
        />
        <Text
          required
          label="واحد شاخص"
          value={m.unit}
          onChange={(v) => setM({ ...m, unit: v })}
        />
        <Select
          label="جهت مطلوب"
          value={m.direction}
          items={E.directions}
          onChange={(v) =>
            setM({ ...m, direction: v as E.GrowthMetric["direction"] })
          }
        />
        <Select
          label="دسته شاخص"
          value={m.category}
          items={E.metricCategories}
          onChange={(v) =>
            setM({ ...m, category: v as E.GrowthMetric["category"] })
          }
        />
        <Text
          area
          label="تعریف و منبع اندازه‌گیری"
          value={m.description}
          onChange={(v) => setM({ ...m, description: v })}
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره شاخص رشد</Button>
      </form>
    </Drawer>
  );
}
