"use client";
import { useState } from "react";
import { Drawer, Button, Field } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Numeric, Owner } from "./shared";
import * as M from "@/lib/scale/readiness/model";
import * as U from "@/lib/scale/readiness/mutations";
import { experimentData } from "@/lib/scale/experiments/model";
import { networkData } from "@/lib/scale/network/model";
import { funnelData, periodStages } from "@/lib/scale/funnel/model";
import type { ScaleStore } from "@/lib/scale/model";
export function sourceOptions(
  s: ScaleStore,
  type: M.ScaleCandidate["sourceType"],
) {
  const n = networkData(s);
  const rows =
    type === "channel"
      ? n.channels.map((c) => [c.id, c.name])
      : type === "loop"
        ? n.loops.map((l) => [l.id, l.name])
        : type === "funnel"
          ? funnelData(s).funnels.map((f) => [f.id, f.name])
          : type === "experiment"
            ? experimentData(s)
                .experiments.filter(
                  (e) =>
                    e.status === "completed" &&
                    ["win", "partial"].includes(e.resultStatus ?? ""),
                )
                .map((e) => [e.id, e.title])
            : type === "idea"
              ? s.ideas
                  .filter((i) => i.status === "validated")
                  .map((i) => [i.id, i.title])
              : [];
  return Object.fromEntries(rows);
}
function Save({
  action,
  label = "ذخیره",
}: {
  action: () => void;
  label?: string;
}) {
  const [error, setError] = useState("");
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <Button
        onClick={() => {
          try {
            action();
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {label}
      </Button>
    </>
  );
}
export function CandidateEditor({
  initial,
  close,
}: {
  initial: M.ScaleCandidate;
  close: (savedId?: string) => void;
}) {
  const { store, sources, commit } = useScale(),
    [x, set] = useState(initial);
  const field = <K extends keyof M.ScaleCandidate>(
    k: K,
    v: M.ScaleCandidate[K],
  ) => set({ ...x, [k]: v });
  const existing = M.readinessData(store).candidates.some((c) => c.id === x.id);
  return (
    <Drawer
      open
      onClose={() => close()}
      title="کاندید مقیاس‌دهی"
      description="منبع فرصت و فرآیندهای مرتبط را مشخص کنید؛ آماده بودن تحلیلی با تصمیم مدیریت متفاوت است."
    >
      <Text
        label="نام کاندید"
        value={x.name}
        onChange={(v) => field("name", v)}
      />
      {!existing && (
        <>
          <Select
            label="نوع منبع کاندید"
            value={x.sourceType}
            items={M.sourceTypes}
            onChange={(v) =>
              set({
                ...x,
                sourceType: v as M.ScaleCandidate["sourceType"],
                sourceId: "",
              })
            }
          />
          {x.sourceType !== "management" && (
            <Select
              label="منبع کاندید"
              value={x.sourceId}
              items={sourceOptions(store, x.sourceType)}
              empty="انتخاب منبع"
              onChange={(v) =>
                set({
                  ...x,
                  sourceId: v,
                  name: x.name || sourceOptions(store, x.sourceType)[v] || "",
                })
              }
            />
          )}
        </>
      )}
      <Text
        label="شرح فرصت"
        value={x.description}
        onChange={(v) => field("description", v)}
        area
      />
      <Owner value={x.ownerRoleId} onChange={(v) => field("ownerRoleId", v)} />
      <Select
        label="مرحله بررسی کاندید"
        value={x.status}
        items={Object.fromEntries(
          Object.entries(M.candidateStatuses).filter(([k]) =>
            ["candidate", "assessing", "ready", "archived", x.status].includes(
              k,
            ),
          ),
        )}
        onChange={(v) => field("status", v as M.ScaleCandidate["status"])}
      />
      {x.sourceType === "management" && (
        <>
          <Text
            label="شواهد اظهارشده مدیریت"
            value={x.manualEvidence}
            onChange={(v) => field("manualEvidence", v)}
            area
          />
          <Numeric
            label="تعداد دوره‌های مستقل مثبت (اظهار مدیریت)"
            value={x.manualPositivePeriods}
            onChange={(v) => field("manualPositivePeriods", v)}
          />
        </>
      )}
      <fieldset>
        <legend>فرآیندهای مرتبط سیستم</legend>
        {sources.processes.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={x.processIds.includes(p.id)}
              onChange={(e) =>
                field(
                  "processIds",
                  e.target.checked
                    ? [...x.processIds, p.id]
                    : x.processIds.filter((id) => id !== p.id),
                )
              }
            />
            {p.name}
          </label>
        ))}
      </fieldset>
      <Select
        label="هدف مرتبط کاندید"
        value={x.objectiveId}
        items={Object.fromEntries(
          sources.objectives.map((o) => [o.id, o.title]),
        )}
        empty="بدون پیوند"
        onChange={(v) => set({ ...x, objectiveId: v, krId: "" })}
      />
      <Select
        label="نتیجه کلیدی کاندید"
        value={x.krId}
        items={Object.fromEntries(
          sources.keyResults
            .filter((k) => !x.objectiveId || k.objectiveId === x.objectiveId)
            .map((k) => [k.id, k.title]),
        )}
        empty="بدون پیوند"
        onChange={(v) => field("krId", v)}
      />
      <Save
        label="ذخیره کاندید"
        action={() => {
          commit(U.saveCandidate(store, x, sources));
          close(x.id);
        }}
      />
    </Drawer>
  );
}
export function AreaEditor({
  initial,
  close,
}: {
  initial: M.CapacityArea;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    [x, set] = useState(initial);
  const field = <K extends keyof M.CapacityArea>(k: K, v: M.CapacityArea[K]) =>
    set({ ...x, [k]: v });
  return (
    <Drawer
      open
      onClose={close}
      title="ظرفیت قابل اتکا"
      description="ظرفیت و بار باید برای واحد و دوره یکسان باشند. خالی یعنی نامشخص."
    >
      <Text
        label="نام حوزه ظرفیت"
        value={x.name}
        onChange={(v) => field("name", v)}
      />
      <Select
        label="نوع حوزه ظرفیت"
        value={x.area}
        items={M.areaTypes}
        onChange={(v) => field("area", v as M.CapacityArea["area"])}
      />
      <div className="scale-grid">
        <Numeric
          label="ظرفیت فعلی"
          value={x.currentCapacity}
          onChange={(v) => field("currentCapacity", v)}
        />
        <Numeric
          label="بار فعلی"
          value={x.currentLoad}
          onChange={(v) => field("currentLoad", v)}
        />
        <Numeric
          label="نیاز صریح سناریو (اختیاری)"
          value={x.targetLoad}
          onChange={(v) => field("targetLoad", v)}
        />
      </div>
      <Text
        label="واحد ظرفیت"
        value={x.unit}
        onChange={(v) => field("unit", v)}
      />
      <Text
        label="دوره ظرفیت"
        value={x.period}
        onChange={(v) => field("period", v)}
      />
      <p>
        بدون نیاز صریح یا اتصال قیف، بار فعلی در ضریب سناریو ضرب می‌شود. این فرض
        خطی، پیش‌بینی نیست. واحدهایی مانند نفر، پروژه، ساعت و جلسه با هم جمع
        نمی‌شوند.
      </p>
      <Owner value={x.ownerRoleId} onChange={(v) => field("ownerRoleId", v)} />
      <Select
        label="فرآیند مرتبط ظرفیت"
        value={x.processId}
        items={Object.fromEntries(sources.processes.map((p) => [p.id, p.name]))}
        empty="بدون پیوند"
        onChange={(v) => field("processId", v)}
      />
      <Select
        label="مرحله قیف برای نیاز ظرفیت"
        value={x.funnelStageId}
        items={Object.fromEntries(
          funnelData(store)
            .stages.filter((s) => s.active)
            .map((s) => [s.id, `${s.name} · ${s.metricUnit}`]),
        )}
        empty="بدون اتصال خودکار"
        onChange={(v) => field("funnelStageId", v)}
      />
      <Text
        label="منبع ظرفیت"
        value={x.source}
        onChange={(v) => field("source", v)}
      />
      <Text
        label="محدودیت و یادداشت ظرفیت"
        value={x.notes}
        onChange={(v) => field("notes", v)}
        area
      />
      <Text
        label="اقدام پیشنهادی ظرفیت"
        value={x.action}
        onChange={(v) => field("action", v)}
      />
      <label>
        <input
          type="checkbox"
          checked={x.criticalRoleGap}
          onChange={(e) => field("criticalRoleGap", e.target.checked)}
        />
        شکاف نقش بحرانی وجود دارد
      </label>
      <Save
        label="ذخیره ظرفیت"
        action={() => {
          commit(U.saveArea(store, x));
          close();
        }}
      />
    </Drawer>
  );
}
export function ScenarioEditor({
  initial,
  close,
}: {
  initial: M.ScaleScenario;
  close: () => void;
}) {
  const { store, commit } = useScale(),
    [x, set] = useState(initial),
    d = funnelData(store),
    period = d.periods.find((p) => p.id === x.funnelPeriodId);
  return (
    <Drawer
      open
      onClose={close}
      title="سناریوی مقیاس‌دهی"
      description="محاسبه نیاز بر مبنای فرض‌ها؛ بدون پیش‌بینی خودکار."
    >
      <Text
        label="نام سناریو"
        value={x.name}
        onChange={(v) => set({ ...x, name: v })}
      />
      <div className="scale-actions">
        {[1, 1.5, 2, 3].map((f) => (
          <Button key={f} secondary onClick={() => set({ ...x, factor: f })}>
            {f}×
          </Button>
        ))}
      </div>
      <Numeric
        label="ضریب رشد هدف"
        value={x.factor}
        onChange={(v) => set({ ...x, factor: v ?? 0 })}
      />
      <Select
        label="قیف مبنای سناریو"
        value={x.funnelId}
        items={Object.fromEntries(d.funnels.map((f) => [f.id, f.name]))}
        empty="بدون قیف؛ برآورد خطی بار"
        onChange={(v) =>
          set({
            ...x,
            funnelId: v,
            funnelPeriodId: "",
            outputStageId: "",
            periodConfirmed: false,
          })
        }
      />
      {x.funnelId && (
        <>
          <Select
            label="دوره مبنای قیف"
            value={x.funnelPeriodId}
            items={Object.fromEntries(
              d.periods
                .filter(
                  (p) => p.funnelId === x.funnelId && p.status === "completed",
                )
                .map((p) => [
                  p.id,
                  `${p.label} · ${p.periodStart} — ${p.periodEnd}`,
                ]),
            )}
            empty="دوره تکمیل‌شده"
            onChange={(v) =>
              set({
                ...x,
                funnelPeriodId: v,
                outputStageId: "",
                periodConfirmed: false,
              })
            }
          />
          <Select
            label="خروجی هدف سناریو"
            value={x.outputStageId}
            items={Object.fromEntries(
              (period ? periodStages(d, period) : []).map((s) => [
                s.id,
                `${s.name} · ${s.metricUnit}`,
              ]),
            )}
            empty="مشتری / قرارداد / خروجی موردنظر"
            onChange={(v) => set({ ...x, outputStageId: v })}
          />
          <label>
            <input
              type="checkbox"
              checked={x.useTargetRates}
              onChange={(e) => set({ ...x, useTargetRates: e.target.checked })}
            />
            استفاده از نرخ‌های هدف به جای نرخ‌های مشاهده‌شده
          </label>
          <label>
            <input
              type="checkbox"
              checked={x.periodConfirmed}
              onChange={(e) => set({ ...x, periodConfirmed: e.target.checked })}
            />
            تطابق دوره و تعریف واحد ظرفیت با دوره قیف را بررسی کردم
          </label>
        </>
      )}
      <Text
        label="فرض‌های سناریو"
        value={x.notes}
        onChange={(v) => set({ ...x, notes: v })}
        area
      />
      <Save
        label="ذخیره سناریو"
        action={() => {
          commit(U.saveScenario(store, x));
          close();
        }}
      />
    </Drawer>
  );
}
export function PreparationEditor({
  initial,
  close,
}: {
  initial: M.ScalePreparationItem;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    [x, set] = useState(initial);
  return (
    <Drawer
      open
      onClose={close}
      title="اقدام آماده‌سازی"
      description="تکمیل اقدام به‌تنهایی آمادگی کسب‌وکار را تأیید نمی‌کند."
    >
      <Text
        label="عنوان اقدام آماده‌سازی"
        value={x.title}
        onChange={(v) => set({ ...x, title: v })}
      />
      <Select
        label="دسته آماده‌سازی"
        value={x.category}
        items={M.preparationCategories}
        onChange={(v) =>
          set({ ...x, category: v as M.ScalePreparationItem["category"] })
        }
      />
      <Owner
        value={x.ownerRoleId}
        onChange={(v) => set({ ...x, ownerRoleId: v })}
      />
      <Field label="موعد آماده‌سازی">
        <input
          type="date"
          value={x.dueDate}
          onInput={(e) => {
            const dueDate = e.currentTarget.value;
            set((previous) => ({ ...previous, dueDate }));
          }}
          onChange={(e) => set({ ...x, dueDate: e.target.value })}
        />
      </Field>
      <Select
        label="وضعیت آماده‌سازی"
        value={x.status}
        items={M.preparationStatuses}
        onChange={(v) =>
          set({ ...x, status: v as M.ScalePreparationItem["status"] })
        }
      />
      <Select
        label="فرآیند اقدام آماده‌سازی"
        value={x.relatedSystemProcessId}
        items={Object.fromEntries(sources.processes.map((p) => [p.id, p.name]))}
        empty="بدون پیوند"
        onChange={(v) => set({ ...x, relatedSystemProcessId: v })}
      />
      <Text
        label="یادداشت آماده‌سازی"
        value={x.notes}
        onChange={(v) => set({ ...x, notes: v })}
        area
      />
      <Save
        label="ذخیره آماده‌سازی"
        action={() => {
          commit(U.savePreparation(store, x));
          close();
        }}
      />
    </Drawer>
  );
}
export function InvestmentEditor({
  candidateId,
  close,
}: {
  candidateId: string;
  close: () => void;
}) {
  const { store, commit } = useScale(),
    [x, set] = useState<M.ScaleInvestment>({
      id: M.id(),
      candidateId,
      kind: "budget",
      amount: null,
      unit: "تومان",
      description: "",
    });
  return (
    <Drawer
      open
      onClose={close}
      title="نیاز سرمایه‌گذاری"
      description="برآورد اولیه؛ اقلام با واحد متفاوت جمع نمی‌شوند."
    >
      <Select
        label="نوع سرمایه‌گذاری"
        value={x.kind}
        items={M.investmentTypes}
        onChange={(v) => set({ ...x, kind: v as M.ScaleInvestment["kind"] })}
      />
      <Numeric
        label="مقدار تقریبی سرمایه‌گذاری"
        value={x.amount}
        onChange={(v) => set({ ...x, amount: v })}
      />
      <Text
        label="واحد سرمایه‌گذاری"
        value={x.unit}
        onChange={(v) => set({ ...x, unit: v })}
      />
      <Text
        label="شرح نیاز سرمایه‌گذاری"
        value={x.description}
        onChange={(v) => set({ ...x, description: v })}
        area
      />
      <Save
        label="ثبت سرمایه‌گذاری"
        action={() => {
          commit(U.saveInvestment(store, x));
          close();
        }}
      />
    </Drawer>
  );
}
