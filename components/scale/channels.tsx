"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel, PageTitle } from "@/components/system/ui";
import { useScale } from "./provider";
import { Select, fa } from "./shared";
import * as N from "@/lib/scale/network/model";
import * as L from "@/lib/scale/network/logic";
import { funnelData } from "@/lib/scale/funnel/model";
import { experimentData, results } from "@/lib/scale/experiments/model";
import {
  ChannelEditor,
  ChannelPeriodEditor,
  ChannelDecisionEditor,
} from "./channel-editors";
import { NetworkRelations } from "./network-shared";
import { ReadinessEntry } from "./readiness-shared";
const efficiency = (v: number | null) =>
  v === null
    ? "نامشخص"
    : v.toLocaleString("fa-IR", { maximumSignificantDigits: 3 });
export const networkLabels: Record<string, string> = {
  insufficient: "داده ناکافی",
  strong: "قوی",
  promising: "امیدبخش",
  watch: "نیازمند پایش",
  weak: "ضعیف",
  unknown: "نامشخص",
  fragile: "شکننده",
  developing: "در حال توسعه",
  balanced: "متوازن",
  unproven: "اثبات‌نشده",
  emerging: "نوظهور",
  repeatable: "تکرارپذیر",
};
export function Channels({ id }: { id?: string }) {
  const { store, sources } = useScale(),
    d = N.networkData(store),
    c = d.channels.find((c) => c.id === id),
    periodOptions = [
      ...new Set(
        d.channelPeriods
          .filter((p) => p.status === "completed")
          .map((p) => p.periodStart + "|" + p.periodEnd),
      ),
    ]
      .sort()
      .reverse();
  const [edit, setEdit] = useState<N.GrowthChannel | null>(null),
    [period, setPeriod] = useState<N.ChannelPeriodMeasurement | null>(null),
    [date, setDate] = useState(periodOptions[0] ?? ""),
    [filters, setFilters] = useState({
      category: "",
      status: "",
      maturity: "",
      ownerRoleId: "",
    });
  if (id && !c)
    return (
      <Panel title="کانال پیدا نشد">
        <Link href="/scale/channels">بازگشت به کانال‌ها</Link>
      </Panel>
    );
  const portfolio = L.channelPortfolioSummary(store, date),
    ps = c ? N.channelPeriods(d, c.id) : [],
    p = ps.at(-1),
    performance = L.channelPerformance(p),
    quality = L.channelQuality(p, ps.at(-2)),
    maturity = c ? L.channelMaturityEvidence(store, c.id) : null,
    process = sources.capacity.find((p) => p.id === c?.systemProcessId),
    readiness = c
      ? L.channelScaleReadiness(
          store,
          c.id,
          process && process.health !== null ? !process.risk : null,
        )
      : null;
  return (
    <>
      <PageTitle
        title={c ? c.name : "سبد کانال‌های رشد"}
        description="تقاضای واجد شرایط، شواهد تکرار و تصمیم؛ درآمد یک‌باره تضمین توسعه نیست."
        onAdd={() => setEdit(c ?? N.newChannel())}
        addLabel={c ? "ویرایش کانال" : "کانال جدید"}
      />
      {c ? (
        <>
          <ReadinessEntry type="channel" id={c.id} />
          <p>
            {N.channelCategories[c.category]} · {N.channelStatuses[c.status]} ·{" "}
            {N.maturities[c.maturity]} ·{" "}
            {sources.roles.find((r) => r.id === c.ownerRoleId)?.title ??
              "بدون مالک"}
          </p>
          <Panel title="کیفیت و آمادگی توسعه">
            <details>
              <summary>کامل‌بودن داده کانال</summary>
              {Object.entries(
                L.channelCompleteness(
                  store,
                  c,
                  sources.roles.map((r) => r.id),
                ),
              ).map(([k, v]) => (
                <p key={k}>
                  {
                    (
                      {
                        owner: "مالک",
                        period: "داده دوره",
                        funnel: "پیوند قیف",
                        evidence: "شواهد",
                        experiments: "تاریخچه آزمایش",
                        economics: "هزینه و درآمد کانال پولی",
                      } as Record<string, string>
                    )[k]
                  }
                  : {v === null ? "الزام عمومی ندارد" : v ? "موجود" : "ناقص"}
                </p>
              ))}
            </details>
            <h3>{networkLabels[quality.state]}</h3>
            <p>{quality.reason}</p>
            <p>
              شواهد بلوغ: {fa(maturity?.positivePeriods)} دوره مثبت ·{" "}
              {fa(maturity?.experiments)} آزمایش تکمیل‌شده. {maturity?.reason}
            </p>
            <p>
              آمادگی: {fa(readiness?.score)} / ۱۰۰ · پوشش شواهد{" "}
              {fa(readiness?.coverage)}٪؛ تضمین عملکرد نیست.
            </p>
            {Object.entries(readiness!.parts).map(([k, v]) => (
              <p key={k}>
                {
                  (
                    {
                      evidence: "شواهد ۲۵٪",
                      repeatability: "تکرارپذیری ۲۵٪",
                      economics: "اقتصاد ۲۰٪",
                      funnel: "مشارکت قیف ۱۵٪",
                      capacity: "ظرفیت ۱۵٪",
                    } as Record<string, string>
                  )[k]
                }
                : {v === null ? "نامشخص" : v ? "شواهد موجود" : "نیازمند بررسی"}
              </p>
            ))}
            {L.channelNeedsAttention(
              store,
              c,
              sources.roles.map((r) => r.id),
            ).map((t) => (
              <p className="scale-notice" key={t}>
                {t}
              </p>
            ))}
          </Panel>
          <Panel
            title="عملکرد آخرین دوره"
            caption="درآمد منتسب‌شده دستی است؛ انتساب کامل یا سود حسابداری نیست."
          >
            <p>
              {p
                ? `${p.periodStart} تا ${p.periodEnd} · ${p.attribution === "primary" ? "منبع اصلی" : "کمک‌کننده"}`
                : "دوره تکمیل‌شده نداریم."}
            </p>
            <div className="funnel-cards">
              {Object.entries(N.metricNames).map(([k, label]) => (
                <article key={k}>
                  <strong>{label}</strong>
                  <p>{fa(p?.[k as keyof N.ChannelValues])}</p>
                </article>
              ))}
            </div>
            <p>
              نرخ واجد شرایط {fa(performance.qualification)}٪ · تبدیل لید به
              مشتری {fa(performance.conversion)}٪ · تبدیل واجد شرایط به مشتری{" "}
              {fa(performance.qualifiedConversion)}٪
            </p>
            <p>
              هزینه هر لید {fa(performance.cpl)} · هزینه هر لید واجد شرایط{" "}
              {fa(performance.cpql)} · هزینه جذب ثبت‌شده هر مشتری{" "}
              {fa(performance.spendPerCustomer)} {p?.currency}
            </p>
            <p>
              درآمد / هزینه {fa(performance.revenuePerSpend)} · مشتری / واحد
              هزینه {efficiency(performance.customersPerSpend)} · واجد شرایط /
              واحد هزینه {efficiency(performance.qualifiedPerSpend)}
            </p>
            <p>
              بدون هزینه مثبت، نسبت کارایی محاسبه نمی‌شود؛ هزینه جذب ثبت‌شده،
              CAC کامل نیست.
            </p>
          </Panel>
          <Panel title="زمینه قیف، استراتژی و سیستم">
            <p>
              ورود قیف:{" "}
              {funnelData(store).stages.find((s) => s.id === c.funnelStageId)
                ?.name ?? "بدون پیوند"}{" "}
              · مشارکت دستی آخرین دوره {fa(p?.contributedVolume)}
            </p>
            <p>
              هدف مرتبط:{" "}
              {sources.objectives.find((o) => o.id === c.strategyObjectiveId)
                ?.title ?? "نامشخص"}{" "}
              · نتیجه کلیدی:{" "}
              {sources.keyResults.find((k) => k.id === c.strategyKRId)?.title ??
                "نامشخص"}
            </p>
            <p>
              ارتباط، به معنی تأیید هم‌راستایی نیست؛ وضعیت دوره استراتژی را
              بررسی کنید.
            </p>
            {process ? (
              <p>
                {process.title} · سلامت {fa(process.health)} · استقلال{" "}
                {fa(process.independence)} · {process.reasons.join("، ")}
              </p>
            ) : (
              <p>شواهد فرآیند ظرفیت انتخاب نشده یا موجود نیست.</p>
            )}
            <p className="scale-notice">
              افزایش ورودی این کانال ممکن است ظرفیت فرآیند فروش را تحت فشار قرار
              دهد.
            </p>
          </Panel>
          <NetworkRelations channelId={c.id} />
          <ChannelDecisionEditor key={c.updatedAt} channel={c} />
          <Panel title="سابقه تصمیم‌ها">
            {d.decisions
              .filter((x) => x.channelId === c.id)
              .map((x) => (
                <article key={x.id}>
                  <strong>
                    {N.channelDecisions[x.decision]} ·{" "}
                    {new Date(x.createdAt).toLocaleDateString("fa-IR", {
                      timeZone: "Asia/Tehran",
                    })}
                  </strong>
                  <p>
                    {N.channelStatuses[x.previousStatus]} ←{" "}
                    {N.channelStatuses[x.status]} ·{" "}
                    {N.maturities[x.previousMaturity]} ←{" "}
                    {N.maturities[x.maturity]}
                  </p>
                  <p>{x.reason}</p>
                  <p>{x.sourceReview}</p>
                </article>
              ))}
          </Panel>
          <Panel
            title="دوره‌ها و روند کانال"
            action={
              <Button onClick={() => setPeriod(N.newChannelPeriod(c.id))}>
                دوره جدید کانال
              </Button>
            }
            caption="دوره‌ها باید از نظر طول، جمعیت و روش انتساب قابل‌مقایسه باشند؛ اعداد خام نرمال‌سازی زمانی نشده‌اند."
          >
            {d.channelPeriods
              .filter((p) => p.channelId === c.id)
              .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
              .map((p) => {
                const index = ps.findIndex((x) => x.id === p.id),
                  trend = L.channelTrend(
                    p,
                    index > 0 ? ps[index - 1] : undefined,
                  );
                return (
                  <article className="funnel-period" key={p.id}>
                    <h3>
                      {p.periodStart} — {p.periodEnd} ·{" "}
                      {p.status === "completed" ? "تکمیل‌شده" : "پیش‌نویس"}
                    </h3>
                    <p>
                      {p.snapshot?.name ?? c.name} ·{" "}
                      {p.attribution === "primary" ? "منبع اصلی" : "کمک‌کننده"}{" "}
                      · {p.currency}
                    </p>
                    <p>
                      تغییر: لید {fa(trend.leads)} · واجد شرایط{" "}
                      {fa(trend.qualifiedLeads)} · مشتری {fa(trend.customers)} ·
                      درآمد {fa(trend.revenue)} · هزینه {fa(trend.spend)} ·
                      تبدیل {fa(trend.conversion)} واحد درصد
                    </p>
                    <Button secondary onClick={() => setPeriod(p)}>
                      مشاهده / ویرایش دوره کانال
                    </Button>
                  </article>
                );
              })}
          </Panel>
        </>
      ) : (
        <>
          <div className="funnel-fields">
            <Select
              label="دوره سبد کانال"
              value={date}
              onChange={setDate}
              empty="دوره‌ای ثبت نشده"
              items={Object.fromEntries(
                periodOptions.map((p) => [p, p.replace("|", " تا ")]),
              )}
            />
            {Object.entries({
              category: N.channelCategories,
              status: N.channelStatuses,
              maturity: N.maturities,
              ownerRoleId: Object.fromEntries(
                sources.roles.map((r) => [r.id, r.title]),
              ),
            }).map(([k, items]) => (
              <Select
                key={k}
                label={
                  (
                    {
                      category: "فیلتر دسته کانال",
                      status: "فیلتر وضعیت کانال",
                      maturity: "فیلتر بلوغ کانال",
                      ownerRoleId: "فیلتر مالک کانال",
                    } as Record<string, string>
                  )[k]
                }
                value={filters[k as keyof typeof filters]}
                items={items}
                empty="همه"
                onChange={(v) => setFilters({ ...filters, [k]: v })}
              />
            ))}
          </div>
          <Panel
            title="تمرکز و تاب‌آوری"
            caption="فقط منابع اصلیِ همین تاریخ‌ها؛ کمک‌کننده‌ها جمع نمی‌شوند. سهم از داده‌های ثبت‌شده است، نه کل بازار."
          >
            <p>
              سهم کانال اول {fa(portfolio.concentration.top)}٪ · دو کانال اول{" "}
              {fa(portfolio.concentration.top2)}٪ · تاب‌آوری{" "}
              {networkLabels[portfolio.resilience.state]}
            </p>
            <p>{portfolio.resilience.reason}</p>
            {portfolio.concentration.partial && (
              <p>
                پوشش داده ناقص است؛ سهم‌های موجود نماینده کل کانال‌ها نیستند.
              </p>
            )}
            {(portfolio.concentration.top ?? 0) >= 70 && (
              <p className="scale-notice">
                بخش بزرگی از تقاضای واجد شرایط از یک کانال تأمین می‌شود. این
                ریسک تمرکز است، نه ضعف قطعی عملکرد.
              </p>
            )}
          </Panel>
          <div className="funnel-cards">
            {d.channels
              .filter((c) =>
                Object.entries(filters).every(
                  ([k, v]) => !v || c[k as keyof N.GrowthChannel] === v,
                ),
              )
              .map((c) => {
                const p = portfolio.periods.find(
                  (p) => p.channelId === c.id && p.attribution === "primary",
                );
                return (
                  <article key={c.id}>
                    <h3>
                      <Link href={`/scale/channels/${c.id}`}>{c.name}</Link>
                    </h3>
                    <p>
                      {N.channelStatuses[c.status]} · {N.maturities[c.maturity]}
                    </p>
                    <p>
                      واجد شرایط {fa(p?.qualifiedLeads)} · مشتری{" "}
                      {fa(p?.customers)}
                    </p>
                    <p>
                      درآمد منتسب {fa(p?.revenue)} · هزینه {fa(p?.spend)}{" "}
                      {p?.currency}
                    </p>
                    <p>تبدیل لید {fa(L.channelPerformance(p).conversion)}٪</p>
                    <p>
                      تغییر تقاضای واجد شرایط:{" "}
                      {fa(
                        L.channelTrend(
                          p,
                          N.channelPeriods(d, c.id)
                            .filter((x) => x.periodEnd < (p?.periodStart ?? ""))
                            .at(-1),
                        ).qualifiedLeads,
                      )}
                    </p>
                    <p>
                      {sources.roles.find((r) => r.id === c.ownerRoleId)
                        ?.title ?? "بدون مالک"}
                    </p>
                  </article>
                );
              })}
          </div>
        </>
      )}
      {edit && <ChannelEditor initial={edit} close={() => setEdit(null)} />}{" "}
      {period && (
        <ChannelPeriodEditor initial={period} close={() => setPeriod(null)} />
      )}
    </>
  );
}
