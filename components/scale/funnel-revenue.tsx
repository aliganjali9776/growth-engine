"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/system/ui";
import { useScale } from "./provider";
import { Select, Numeric, Text, fa } from "./shared";
import * as F from "@/lib/scale/funnel/model";
import * as L from "@/lib/scale/funnel/logic";
import { saveRevenue } from "@/lib/scale/funnel/mutations";
export function RevenueEngine({ funnelId }: { funnelId: string }) {
  const { store, sources, commit } = useScale(),
    d = F.funnelData(store),
    stages = d.stages
      .filter((s) => s.funnelId === funnelId && s.active)
      .sort((a, b) => a.order - b.order);
  const [r, setR] = useState(
      d.revenueModels.find((r) => r.funnelId === funnelId) ??
        F.blankRevenue(funnelId),
    ),
    [error, setError] = useState(""),
    [mode, setMode] = useState("current");
  const periods = F.completedPeriods(d, funnelId),
    p = periods.at(-1),
    rows = p ? L.stageRows(d, p, periods.at(-2)) : [];
  const target = L.strategyRevenueTarget(r, sources.keyResults),
    rates = Object.fromEntries(
      stages.map((s) => [
        s.id,
        mode === "target"
          ? s.targetConversion
          : L.currentRates(stages, rows)[s.id],
      ]),
    );
  const volumes = L.backsolveRequiredVolumes(
      stages,
      r.revenueStageId,
      target,
      r.averageDealValue,
      rates,
    ),
    output =
      rows.find((row) => row.stage.id === r.revenueStageId)?.volume ?? null,
    estimate = L.calculateEstimatedRevenue(output, r.averageDealValue),
    gap = L.calculateRevenueGap(estimate, target),
    need = volumes[r.revenueStageId] ?? null,
    capacity =
      need !== null &&
      output !== null &&
      (output === 0 ? need > 0 : need / output >= 1.5);
  return (
    <>
      <Panel
        title="مدل درآمد"
        caption="مرحله درآمد را انتخاب کنید؛ مرحله آخر الزاماً محل فروش نیست."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              commit(saveRevenue(store, r));
              setError("مدل درآمد ذخیره شد.");
            } catch (x) {
              setError((x as Error).message);
            }
          }}
        >
          <div className="funnel-fields">
            <Select
              label="مرحله درآمد"
              value={r.revenueStageId}
              empty="انتخاب مرحله"
              items={Object.fromEntries(stages.map((s) => [s.id, s.name]))}
              onChange={(revenueStageId) => setR({ ...r, revenueStageId })}
            />
            <Numeric
              label="میانگین سفارش / قرارداد"
              value={r.averageDealValue}
              onChange={(averageDealValue) => setR({ ...r, averageDealValue })}
            />
            <Text
              label="واحد پول"
              value={r.currency}
              onChange={(currency) => setR({ ...r, currency })}
            />
            <Select
              label="هدف درآمد از استراتژی (فقط خواندنی)"
              value={r.strategyKRId}
              empty="هدف دستی"
              items={Object.fromEntries(
                sources.keyResults
                  .filter((k) => k.type === "increase" || k.type === "decrease")
                  .map((k) => [k.id, `${k.title} · ${k.unit}`]),
              )}
              onChange={(strategyKRId) => setR({ ...r, strategyKRId })}
            />
            {!r.strategyKRId && (
              <Numeric
                label="هدف درآمد"
                value={r.targetRevenue}
                onChange={(targetRevenue) => setR({ ...r, targetRevenue })}
              />
            )}
            <Numeric
              label="درآمد واقعی همین دوره (اختیاری)"
              value={r.currentRevenue}
              onChange={(currentRevenue) => setR({ ...r, currentRevenue })}
            />
            <Numeric
              label="نرخ خرید مجدد (%)"
              value={r.repeatRate}
              max={100}
              onChange={(repeatRate) => setR({ ...r, repeatRate })}
            />
            <Numeric
              label="درآمد توسعه (جداگانه)"
              value={r.expansionRevenue}
              onChange={(expansionRevenue) => setR({ ...r, expansionRevenue })}
            />
          </div>
          {r.strategyKRId && (
            <p>
              هدف خوانده‌شده: {fa(target)} · تطبیق واحد پول و دوره را بررسی
              کنید.{" "}
              <Link
                href={(() => {
                  const kr = sources.keyResults.find(
                    (k) => k.id === r.strategyKRId,
                  );
                  return kr
                    ? `/strategy/cycles/${kr.cycleId}/objectives/${kr.objectiveId}#kr-${kr.id}`
                    : "/strategy/key-results";
                })()}
              >
                مشاهده نتیجه کلیدی
              </Link>
              {target === null &&
                " هدف قابل استفاده نیست؛ منبع باید موجود و واحد آن دقیقاً با واحد پول مدل یکسان باشد. تبدیل ارز یا ضریب واحد خودکار انجام نمی‌شود."}
            </p>
          )}
          <p>
            درآمد واقعی، تکرار و توسعه مربوط به دوره بعدی ثبت‌شده‌اند و هنگام
            تکمیل دوره ثابت می‌شوند. برآورد پایه فقط حجم مرحله درآمد × میانگین
            قرارداد است؛ تکرار و توسعه به‌طور خودکار جمع نمی‌شوند.
          </p>
          <Button type="submit">ذخیره مدل درآمد</Button>
          {error && <p role="status">{error}</p>}
        </form>
      </Panel>
      <Panel
        title="حجم موردنیاز و شکاف درآمد"
        caption="محاسبه بر پایه فرض‌های بالا و آخرین دوره؛ سناریو است، نه پیش‌بینی."
      >
        <p>
          برآورد مبتنی بر قیف: {fa(estimate)} {r.currency} · هدف: {fa(target)} ·
          فاصله هدف: {fa(gap)}
        </p>
        <p>
          خروجی فعلی: {fa(output)} · خروجی موردنیاز: {fa(need)} · اختلاف:{" "}
          {fa(need !== null && output !== null ? need - output : null)}
        </p>
        <Select
          label="مبنای محاسبه معکوس"
          value={mode}
          onChange={setMode}
          items={{ current: "تبدیل فعلی", target: "تبدیل هدف" }}
        />
        <div className="funnel-cards">
          {stages
            .filter((s) => s.id in volumes)
            .map((s) => (
              <article key={s.id}>
                <strong>{s.name}</strong>
                <p>حجم موردنیاز: {fa(volumes[s.id])}</p>
                <p>تبدیل ورودی: {fa(rates[s.id])}٪</p>
              </article>
            ))}
        </div>
        <p>
          نرخ صفر، ناموجود یا بیش از صد، محاسبه بالادست را نامشخص می‌کند. حجم‌ها
          در هر مرحله رو به بالا گرد می‌شوند. هدف ناموجود با صفر جایگزین
          نمی‌شود.
        </p>
        {mode === "target" &&
          stages.some((s) => {
            const actual = rows.find(
              (row) => row.stage.id === s.id,
            )?.conversion;
            return (
              actual != null &&
              s.targetConversion !== null &&
              s.targetConversion > actual * 1.5
            );
          }) && (
            <p className="scale-notice">
              این سناریو نسبت به عملکرد فعلی تغییر قابل‌توجهی نیاز دارد.
            </p>
          )}
        <p>
          راه‌های قابل بررسی: حجم ورودی بیشتر، تبدیل بهتر، ارزش قرارداد بیشتر یا
          ترکیبی از آن‌ها. تکرار و توسعه ممکن است مؤثر باشند؛ این اهرم‌ها مستقل
          از هم نیستند.
        </p>
        {capacity && (
          <div className="scale-notice">
            <strong>
              رشد موردنیاز ممکن است فشار قابل‌توجهی بر ظرفیت تحویل ایجاد کند.
            </strong>
            {sources.capacity.length ? (
              sources.capacity.map((c) => (
                <p key={c.id}>
                  <Link href={`/system/processes/${c.id}`}>{c.title}</Link> ·
                  سلامت {fa(c.health)} · استقلال {fa(c.independence)} ·{" "}
                  {c.reasons.join("، ")}
                </p>
              ))
            ) : (
              <p>شواهد ظرفیت سیستم موجود نیست.</p>
            )}
          </div>
        )}
      </Panel>
      <Scenario
        key={funnelId + String(p?.id)}
        stages={stages}
        revenue={r}
        rows={rows}
      />
    </>
  );
}
function Scenario({
  stages,
  revenue: r,
  rows,
}: {
  stages: F.FunnelStage[];
  revenue: F.GrowthRevenueModel;
  rows: L.StageRow[];
}) {
  const [top, setTop] = useState(rows[0]?.volume ?? null),
    [deal, setDeal] = useState(r.averageDealValue),
    [repeat, setRepeat] = useState<number | null>(0),
    [rates, setRates] = useState<Record<string, number | null>>(
      Object.fromEntries(
        stages.map((s) => [
          s.id,
          rows.find((row) => row.stage.id === s.id)?.conversion ?? null,
        ]),
      ),
    );
  let value: { output: number | null; revenue: number | null } = {
      output: null,
      revenue: null,
    },
    error = "";
  try {
    value = L.calculateScenario(
      stages,
      r.revenueStageId,
      top,
      rates,
      deal,
      repeat,
    );
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <Panel
      title="سناریوی موقت"
      caption="فرض‌ها در این پنل ذخیره نمی‌شوند و عملکرد واقعی را تغییر نمی‌دهند."
    >
      <div className="funnel-fields">
        <Numeric label="حجم ورودی سناریو" value={top} onChange={setTop} />
        <Numeric
          label="میانگین قرارداد سناریو"
          value={deal}
          onChange={setDeal}
        />
        <Numeric
          label="تکرار افزوده سناریو (%)"
          value={repeat}
          max={100}
          onChange={setRepeat}
        />
        {stages
          .slice(1, stages.findIndex((s) => s.id === r.revenueStageId) + 1)
          .map((s) => (
            <Numeric
              key={s.id}
              label={`تبدیل سناریو به ${s.name} (%)`}
              value={rates[s.id] ?? null}
              max={100}
              onChange={(v) => setRates({ ...rates, [s.id]: v })}
            />
          ))}
      </div>
      <p>
        اگر این ورودی‌ها رخ دهند، خروجی حدود {fa(value.output)} و درآمد حدود{" "}
        {fa(value.revenue)} {r.currency} خواهد بود.
      </p>
      <p>
        تکرار افزوده یعنی یک خرید اضافه با همان میانگین ارزش برای این درصد از
        خریداران؛ اگر در حجم مرحله درآمد حساب شده، آن را صفر بگذارید تا
        دوباره‌شماری نشود.
      </p>
      {error && <p role="alert">{error}</p>}
    </Panel>
  );
}
