"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel, Field } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Numeric, fa } from "./shared";
import * as M from "@/lib/scale/model";
import {
  constraintCandidates,
  diagnosisSummary,
  scaleDiagnosisCompleteness,
} from "@/lib/scale/logic";
import { saveConstraint } from "@/lib/scale/persistence";
import { FunnelSummary } from "./funnel";
export function Diagnosis() {
  const { store, sources, commit } = useScale(),
    [draft, setDraft] = useState(store),
    [error, setError] = useState("");
  const p = draft.profile,
    kr = sources.keyResults.find((k) => k.id === p.linkedStrategyKRId);
  const profile = (key: keyof M.ScaleProfile, value: unknown) =>
    setDraft({ ...draft, profile: { ...p, [key]: value } });
  const completeness = scaleDiagnosisCompleteness(draft, !!kr);
  function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const next = { ...draft, profile: { ...p, updatedAt: M.now() } };
      commit(next);
      setDraft(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد");
    }
  }
  return (
    <>
      <FunnelSummary />
      <h2>تشخیص رشد</h2>
      <p>
        قضاوت مدیریت را کنار شواهد ثبت کنید. هیچ نرخ مطلوب صنعت یا علت ریشه‌ای
        خودکار تعیین نمی‌شود.
      </p>
      <form onSubmit={save}>
        <Panel
          title="جهت رشد"
          caption="استراتژی مالک نتیجه است؛ در اینجا هدف موجود را پیوند دهید."
        >
          <div className="scale-grid">
            <Select
              label="مدل کسب‌وکار"
              value={p.businessModel}
              items={M.businessModels}
              empty="نامشخص"
              onChange={(v) => profile("businessModel", v)}
            />
            <Select
              label="مرحله رشد · توصیف مدیریت"
              value={p.stage}
              items={M.stages}
              empty="نامشخص"
              onChange={(v) => profile("stage", v)}
            />
          </div>
          {sources.assessmentModel && (
            <p>
              مدل ثبت‌شده در ارزیابی: {sources.assessmentModel} ·{" "}
              <Link href="/assessment">مشاهده منبع</Link>
            </p>
          )}
          <p className="scale-notice">
            {p.businessModel === "saas"
              ? "در مدل اشتراکی، فعال‌سازی و حفظ اشتراک را با دوره یکسان بررسی کنید."
              : p.businessModel === "marketplace"
                ? "در بازارگاه، سمت عرضه و تقاضا را در شواهد جدا کنید."
                : ["retail", "ecommerce"].includes(p.businessModel)
                  ? "در فروش کالا، سفارش، سبد خرید و خرید مجدد را از مشتری یکتا تفکیک کنید."
                  : ["manufacturing", "distribution"].includes(p.businessModel)
                    ? "در تولید و توزیع، سفارش، ظرفیت تحویل و کانال را با واحد یکسان بررسی کنید."
                    : "در خدمات و فروش سازمانی، لید واجد شرایط، فرصت، قرارداد و ظرفیت تحویل را جداگانه بررسی کنید."}
          </p>
          <Select
            label="نتیجه کلیدی هدف رشد · فقط خواندنی"
            value={p.linkedStrategyKRId}
            empty="هدف مستقل؛ هنوز پیوندی انتخاب نشده"
            items={Object.fromEntries(
              sources.keyResults.map((k) => [
                k.id,
                `${k.title} · ${sources.cycleLabels[k.cycleId] ?? "دوره نامشخص"}`,
              ]),
            )}
            onChange={(v) =>
              setDraft({
                ...draft,
                profile: {
                  ...p,
                  linkedStrategyKRId: v,
                  ...(v
                    ? {
                        growthGoal: "",
                        currentRevenue: null,
                        targetRevenue: null,
                      }
                    : {}),
                },
              })
            }
          />
          {p.linkedStrategyKRId ? (
            <p>
              {kr ? (
                <>
                  <Link
                    href={`/strategy/cycles/${kr.cycleId}/objectives/${kr.objectiveId}#kr-${kr.id}`}
                  >
                    {kr.title}
                  </Link>{" "}
                  · فعلی {fa(kr.currentValue)} ← هدف {fa(kr.targetValue)}{" "}
                  {kr.unit}{" "}
                  {kr.type === "increase" &&
                  kr.targetValue !== null &&
                  kr.currentValue !== null
                    ? `· فاصله تا هدف ${fa(kr.targetValue - kr.currentValue)}`
                    : ""}
                </>
              ) : (
                "منبع هدف در دسترس نیست؛ هدف کپی نمی‌شود."
              )}
            </p>
          ) : (
            <>
              <Text
                label="هدف رشد مستقل"
                value={p.growthGoal}
                onChange={(v) => profile("growthGoal", v)}
              />
              <div className="scale-grid">
                <Numeric
                  label="درآمد فعلی (اختیاری)"
                  value={p.currentRevenue}
                  onChange={(v) => profile("currentRevenue", v)}
                />
                <Numeric
                  label="درآمد هدف (اختیاری)"
                  value={p.targetRevenue}
                  onChange={(v) => profile("targetRevenue", v)}
                />
              </div>
            </>
          )}
          <div className="scale-grid">
            <Text
              label="افق رشد"
              value={p.growthHorizon}
              onChange={(v) => profile("growthHorizon", v)}
            />
            <Text
              label="شاخص اصلی رشد"
              value={p.primaryGrowthMetric}
              onChange={(v) => profile("primaryGrowthMetric", v)}
            />
          </div>
          <Text
            area
            label="یادداشت جهت رشد"
            value={p.notes}
            onChange={(v) => profile("notes", v)}
          />
        </Panel>
        <Panel
          title="شواهد مدیریت"
          caption="خالی یعنی نامشخص؛ صفر فقط هنگامی وارد شود که واقعاً اندازه‌گیری شده است."
        >
          <div className="scale-grid">
            <Text
              label="دوره اندازه‌گیری"
              value={draft.metricPeriod}
              onChange={(v) => setDraft({ ...draft, metricPeriod: v })}
            />
            <Text
              label="واحد درآمد / مبلغ"
              value={draft.metricUnit}
              onChange={(v) => setDraft({ ...draft, metricUnit: v })}
            />
            {(
              Object.keys(M.metricLabels) as (keyof typeof M.metricLabels)[]
            ).map((k) => (
              <Numeric
                key={k}
                label={M.metricLabels[k]}
                value={draft.metrics[k]}
                max={
                  ["conversion", "retention", "founder"].includes(k)
                    ? 100
                    : undefined
                }
                onChange={(v) =>
                  setDraft({ ...draft, metrics: { ...draft.metrics, [k]: v } })
                }
              />
            ))}
          </div>
          <Text
            area
            label="ترکیب کانال‌ها و مبنای سهم آن‌ها"
            value={draft.channelMix}
            onChange={(v) => setDraft({ ...draft, channelMix: v })}
          />
          <p>
            امتیاز Scale در ارزیابی: {fa(sources.assessmentScale)} ·{" "}
            <Link href="/assessment">ارزیابی 3S</Link>
          </p>
          <p>
            دوره فعال استراتژی: {sources.activeCycle?.name ?? "وجود ندارد"} ·{" "}
            <Link href="/strategy">مشاهده استراتژی</Link>
          </p>
        </Panel>
        <Panel
          title="ده بُعد تشخیص"
          caption="برچسب‌ها قضاوت مستند مدیریت‌اند؛ قاعده صنعت یا تشخیص هوش مصنوعی نیستند."
        >
          {draft.diagnostics.map((d, index) => {
            const update = (patch: Partial<M.GrowthDimensionDiagnostic>) => {
              const next = { ...d, ...patch, updatedAt: M.now() };
              next.dataCompleteness =
                (next.evidence.trim() ? 50 : 0) +
                (next.managementObservation.trim() || next.metricValue !== null
                  ? 50
                  : 0);
              setDraft({
                ...draft,
                diagnostics: draft.diagnostics.map((x, j) =>
                  j === index ? next : x,
                ),
              });
            };
            return (
              <details className="scale-dimension" key={d.dimension}>
                <summary>
                  {M.dimensions[d.dimension]}{" "}
                  <span>{M.diagnosticStatuses[d.status]}</span>
                </summary>
                <div className="scale-grid">
                  <Select
                    label={`وضعیت ${M.dimensions[d.dimension]}`}
                    value={d.status}
                    items={M.diagnosticStatuses}
                    onChange={(v) =>
                      update({
                        status: v as M.GrowthDimensionDiagnostic["status"],
                      })
                    }
                  />
                  <Select
                    label="مبنای مقایسه"
                    value={d.benchmarkType}
                    items={M.benchmarks}
                    onChange={(v) =>
                      update({
                        benchmarkType:
                          v as M.GrowthDimensionDiagnostic["benchmarkType"],
                      })
                    }
                  />
                </div>
                <Text
                  area
                  label={`شواهد ${M.dimensions[d.dimension]}`}
                  value={d.evidence}
                  onChange={(v) => update({ evidence: v })}
                />
                <Text
                  area
                  label="مشاهده مدیریت / توضیح هدف یا روند"
                  value={d.managementObservation}
                  onChange={(v) => update({ managementObservation: v })}
                />
                <Numeric
                  label="مقدار شاخص (واحد را در شواهد بنویسید)"
                  value={d.metricValue}
                  onChange={(v) => update({ metricValue: v })}
                />
                <small>
                  کامل بودن شواهد این بُعد: {fa(d.dataCompleteness)}٪
                </small>
              </details>
            );
          })}
        </Panel>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره تشخیص</Button>
      </form>
      <Panel title="جمع‌بندی و کاندیدها">
        <p>{diagnosisSummary(store)}</p>
        <p>
          کامل بودن تنظیمات تشخیص: {fa(completeness.percent)}٪؛ این عدد عملکرد
          رشد نیست.
        </p>
        <ul>
          {completeness.items.map((x) => (
            <li key={x.label}>
              {x.label}: {x.value ? "ثبت شده" : "نامشخص / ثبت نشده"}
            </li>
          ))}
        </ul>
        {constraintCandidates(store).map((d) => (
          <div className="scale-row" key={d.dimension}>
            <span>
              {M.dimensions[d.dimension]} ·{" "}
              {d.evidence || d.managementObservation}
            </span>
            <Button
              secondary
              onClick={() => {
                try {
                  const c = {
                    ...M.newConstraint(),
                    title: `بررسی محدودیت ${M.dimensions[d.dimension]}`,
                    dimension: d.dimension,
                    evidence: [
                      {
                        type: "observation" as const,
                        text: d.evidence || d.managementObservation,
                      },
                    ],
                  };
                  commit(saveConstraint(store, c));
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              ثبت کاندید {M.dimensions[d.dimension]}
            </Button>
          </div>
        ))}
        <Link href="/scale/constraints">انتخاب و بررسی گلوگاه اصلی ←</Link>
      </Panel>
    </>
  );
}
