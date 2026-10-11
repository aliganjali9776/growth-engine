"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/system/ui";
import { useScale } from "./provider";
import { Select, Numeric, fa } from "./shared";
import * as F from "@/lib/scale/funnel/model";
import * as L from "@/lib/scale/funnel/logic";
import * as M from "@/lib/scale/funnel/mutations";
import { FunnelNav } from "./funnel-editors";
import { RevenueEngine } from "./funnel-revenue";
import { ChannelFunnelContribution } from "./network-shared";
import {ReadinessEntry} from './readiness-shared';
const healthLabels: Record<string, string> = {
  healthy: "سالم",
  watch: "نیازمند پایش",
  risk: "در خطر",
  unknown: "نامشخص",
  low: "پایین",
  medium: "متوسط",
  high: "بالا",
  critical: "بحرانی",
};
export function FunnelWorkspace() {
  const { store, sources, commit } = useScale(),
    d = F.funnelData(store),
    [selected, setSelected] = useState(
      d.funnels.find((f) => f.active)?.id ?? "",
    ),
    [days, setDays] = useState<number | null>(d.staleDays),
    [error, setError] = useState("");
  const f = d.funnels.find((f) => f.id === selected),
    periods = F.completedPeriods(d, selected),
    p = periods.at(-1),
    prior = periods.at(-2),
    rs = p
      ? L.stageRows(
          d,
          p,
          prior,
          sources.roles.map((r) => r.id),
        )
      : [],
    rev = p?.snapshot?.revenue ?? null,
    signals = L.calculateFunnelConstraintSignal(
      rs,
      rev?.revenueStageId ?? "",
      rev?.averageDealValue ?? null,
    ),
    candidate = signals.find((s) => s.score !== null && s.score > 0),
    fresh = L.funnelFreshness(p, d.staleDays),
    completeness = L.funnelCompleteness(
      f ? d.stages.filter((s) => s.funnelId === f.id && s.active) : [],
      rs,
      d.revenueModels.find((r) => r.funnelId === selected) ?? null,
      sources.roles.map((r) => r.id),
    );
  const h = L.healthSummary(
    rs,
    p,
    d.staleDays,
    sources.roles.map((r) => r.id),
  );
  const attention = L.funnelNeedsAttention(
    d,
    selected,
    !store.primaryConstraintId ||
      d.evidence.some((e) => e.constraintId === store.primaryConstraintId),
    !!store.experimentData?.experiments.some(
      (e) =>
        ["ready", "running", "paused"].includes(e.status) &&
        !d.links.some((l) => l.kind === "experiment" && l.entityId === e.id),
    ),
    sources.roles.map((r) => r.id),
  );
  return (
    <>
      <FunnelNav />
      {f&&<ReadinessEntry type="funnel" id={f.id}/>}
      <Panel
        title="قیف رشد و موتور درآمد"
        caption="تحلیل داخلی حجم، تبدیل و شکاف؛ افت در قیف به‌تنهایی رابطه علت و معلولی را اثبات نمی‌کند."
      >
        <Select
          label="قیف گزارش"
          value={selected}
          onChange={setSelected}
          empty="انتخاب قیف"
          items={Object.fromEntries(d.funnels.map((f) => [f.id, f.name]))}
        />
        {!f && (
          <p>
            قیفی ساخته نشده است.{" "}
            <Link href="/scale/funnel/builder">
              ساخت قیف با الگو یا ساختار سفارشی
            </Link>
          </p>
        )}
        {f && (
          <>
            <p>
              آخرین دوره تکمیل‌شده:{" "}
              {p
                ? `${p.label} · ${p.periodStart} تا ${p.periodEnd}`
                : "هنوز داده‌ای نیست"}{" "}
              · تازگی: {fresh.stale ? "نیازمند به‌روزرسانی" : "به‌روز"}
            </p>
            <p>
              سلامت قیف: {fa(h.score)} / ۱۰۰ · پوشش اجزای سلامت:{" "}
              {fa(h.coverage)}٪
            </p>
            <details>
              <summary>منطق سلامت و گلوگاه</summary>
              <p>
                سلامت: عملکرد تبدیل ۵۰٪، ثبات روند ۲۰٪، پوشش هدف ۱۰٪، تازگی ۱۰٪
                و مالکیت ۱۰٪. وزن اجزای موجود بازتوزیع می‌شود؛ بدون عملکرد
                تبدیل، سلامت نامشخص است. این امتیاز سلامت کل رشد نیست.
              </p>
              <p>
                گلوگاه: شکاف نسبی هدف ۳۵٪، ریزش نسبی حجم ۳۰٪، درآمد قابل‌بازیابی
                با تبدیل‌های پایین‌دست ۲۰٪، افت روند ۱۵٪. داده ناموجود حذف و وزن
                باقی‌مانده بازتوزیع می‌شود. امتیاز ابزار اولویت بررسی است، نه
                پیش‌بینی درآمد. کمترین نرخ تبدیل لزوماً گلوگاه نیست.
              </p>
            </details>
            <p>
              تکمیل داده:{" "}
              {Object.entries(completeness)
                .map(
                  ([k, v]) =>
                    `${({ definitions: "تعریف مراحل", owners: "مالکیت", period: "حجم دوره", targets: "هدف‌ها", revenue: "مدل درآمد" } as Record<string, string>)[k]}: ${v ? "کامل" : "ناقص"}`,
                )
                .join(" · ")}
            </p>
            <Numeric
              label="آستانه قدیمی‌شدن داده (روز)"
              value={days}
              max={365}
              onChange={setDays}
            />
            <Button
              secondary
              onClick={() => {
                try {
                  commit({
                    ...store,
                    funnelData: { ...d, staleDays: days ?? 0 },
                  });
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              ذخیره آستانه تازگی
            </Button>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </Panel>
      {f && (
        <>
          <Panel
            title="بزرگ‌ترین گلوگاه قیف"
            caption="این سیگنال مستقل از گلوگاه اصلی رشد است؛ هیچ گلوگاهی خودکار جایگزین نمی‌شود."
          >
            {candidate ? (
              <>
                <h3>
                  {candidate.row.stage.name} · شدت{" "}
                  {healthLabels[candidate.category]}
                </h3>
                <p>
                  شکاف {fa(candidate.row.gap)} واحد درصد · ریزش{" "}
                  {fa(candidate.row.dropoff.volume)} · تغییر تبدیل{" "}
                  {fa(candidate.row.trend)} واحد درصد · اثر درآمدی قابل‌بررسی{" "}
                  {fa(candidate.impact)} {rev?.currency}
                </p>
              </>
            ) : (
              <p>شواهد کافی برای پیشنهاد گلوگاه نداریم.</p>
            )}
          </Panel>
          <Panel
            title="گزارش مراحل"
            caption="حجم و تبدیل از آخرین دوره تکمیل‌شده؛ هدف‌ها مربوط به همان دوره‌اند. تغییر ساختار فعلی تاریخچه را بازنویسی نمی‌کند."
          >
            <div className="funnel-report">
              {rs.map((r, i) => (
                <article key={r.stage.id}>
                  <h3>
                    {fa(i + 1)}. {r.stage.name}
                  </h3>
                  <dl>
                    <div>
                      <dt>حجم</dt>
                      <dd>
                        {fa(r.volume)} {r.stage.metricUnit}
                      </dd>
                    </div>
                    <div>
                      <dt>تبدیل از مرحله قبل</dt>
                      <dd>{fa(r.conversion)}٪</dd>
                    </div>
                    <div>
                      <dt>هدف تبدیل</dt>
                      <dd>{fa(r.stage.targetConversion)}٪</dd>
                    </div>
                    <div>
                      <dt>شکاف هدف</dt>
                      <dd>{fa(r.gap)} واحد درصد</dd>
                    </div>
                    <div>
                      <dt>ریزش</dt>
                      <dd>
                        {fa(r.dropoff.volume)} · {fa(r.dropoff.percent)}٪
                      </dd>
                    </div>
                    <div>
                      <dt>تغییر حجم / تبدیل</dt>
                      <dd>
                        {fa(r.volumeDelta)} / {fa(r.trend)} واحد درصد
                      </dd>
                    </div>
                    <div>
                      <dt>مالک</dt>
                      <dd>
                        {sources.roles.find((o) => o.id === r.stage.ownerRoleId)
                          ?.title ?? "مالک این مرحله مشخص نیست."}
                      </dd>
                    </div>
                    <div>
                      <dt>سلامت</dt>
                      <dd>
                        {healthLabels[r.health.status]} · {r.health.reason}
                      </dd>
                    </div>
                  </dl>
                  {r.conversion !== null && r.conversion > 100 && (
                    <p className="scale-notice">
                      حجم مرحله از ورودی بیشتر است؛ جمعیت یا دوره‌ها را بررسی
                      کنید. این نرخ برای سناریوی قیف متوالی استفاده نمی‌شود.
                    </p>
                  )}
                  <StageRelations stage={r.stage} />
                  <ChannelFunnelContribution stageId={r.stage.id} />
                  {i > 0 && p && <EvidenceControl period={p} stage={r.stage} />}
                </article>
              ))}
            </div>
            {!p && <Link href="/scale/funnel/history">ثبت نخستین دوره</Link>}
          </Panel>
          <Panel title="نیازمند توجه">
            {attention.length ? (
              attention.map((t) => <p key={t}>{t}</p>)
            ) : (
              <p>هشدار فعالی در قواعد فعلی دیده نشد.</p>
            )}
          </Panel>
          <RevenueEngine key={selected} funnelId={selected} />
        </>
      )}
    </>
  );
}
function EvidenceControl({
  period,
  stage,
}: {
  period: F.FunnelPeriod;
  stage: F.FunnelStage;
}) {
  const { store, commit } = useScale(),
    [cid, setCid] = useState(""),
    [message, setMessage] = useState("");
  return (
    <div>
      <Select
        label={`شواهد ${stage.name} برای گلوگاه`}
        value={cid}
        onChange={setCid}
        empty="ایجاد کاندید جدید"
        items={Object.fromEntries(
          store.constraints
            .filter((c) => c.status !== "archived")
            .map((c) => [c.id, c.title]),
        )}
      />
      <Button
        secondary
        onClick={() => {
          try {
            commit(M.addFunnelEvidence(store, period.id, stage.id, cid));
            setMessage("شواهد ثبت شد؛ گلوگاه اصلی تغییر نکرد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        ثبت شواهد گذار {stage.name}
      </Button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
function StageRelations({ stage }: { stage: F.FunnelStage }) {
  const { store } = useScale(),
    d = F.funnelData(store),
    links = d.links.filter((l) => l.stageId === stage.id);
  const categories =
    stage.type === "repeat" || stage.type === "renewal"
      ? ["retention", "experience"]
      : ["order", "proposal", "customer"].includes(stage.type)
        ? ["offer", "pricing", "sales"]
        : ["acquisition", "channel", "referral"];
  return (
    <details>
      <summary>اهرم‌ها و کارهای مرتبط</summary>
      <p>
        پیشنهاد چارچوبی اهرم‌ها:{" "}
        {store.levers
          .filter((l) => l.active && categories.includes(l.category))
          .map((l) => l.name)
          .join("، ") || "اهرم سفارشی را بررسی کنید."}
      </p>
      {links.map((l) => {
        const list =
            l.kind === "constraint"
              ? store.constraints
              : l.kind === "idea"
                ? store.ideas
                : (store.experimentData?.experiments ?? []),
          item = list.find((x) => x.id === l.entityId);
        return (
          <p key={l.id}>
            <Link
              href={`/scale/${l.kind === "constraint" ? "constraints" : l.kind === "idea" ? "ideas" : "experiments"}/${l.entityId}`}
            >
              {item?.title ?? "منبع قبلی"}
            </Link>
          </p>
        );
      })}
      {!links.length && <p>هنوز گلوگاه، ایده یا آزمایش مرتبطی ثبت نشده است.</p>}
    </details>
  );
}
export function FunnelEntityContext({
  kind,
  entityId,
}: {
  kind: F.FunnelLink["kind"];
  entityId: string;
}) {
  const { store, commit } = useScale(),
    d = F.funnelData(store),
    link = d.links.find((l) => l.kind === kind && l.entityId === entityId),
    [value, setValue] = useState(link?.stageId ?? ""),
    [message, setMessage] = useState("");
  const exp = store.experimentData?.experiments.find((e) => e.id === entityId),
    locked =
      kind === "experiment" &&
      !!(exp?.startedAt || exp?.status === "cancelled");
  const ps = link ? F.completedPeriods(d, link.funnelId) : [],
    p = ps.at(-1),
    row = p
      ? L.stageRows(d, p, ps.at(-2)).find((r) => r.stage.id === link?.stageId)
      : undefined;
  return (
    <Panel
      title="زمینه قیف رشد"
      caption="تغییر قیف به‌طور خودکار به این آزمایش یا ایده نسبت داده نمی‌شود."
    >
      <Select
        label="مرحله هدف قیف"
        value={value}
        onChange={setValue}
        empty="بدون پیوند"
        items={Object.fromEntries(
          d.stages
            .filter((s) => s.active || s.id === link?.stageId)
            .map((s) => [
              s.id,
              `${d.funnels.find((f) => f.id === s.funnelId)?.name} · ${s.name}${s.active ? "" : " (غیرفعال)"}`,
            ]),
        )}
      />
      <Button
        secondary
        disabled={locked}
        onClick={() => {
          try {
            commit(M.linkFunnel(store, kind, entityId, value));
            setMessage("پیوند قیف ذخیره شد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        ذخیره پیوند قیف
      </Button>
      {locked && <p>پیوند آزمایش پس از شروع ثابت است.</p>}
      {message && <p role="status">{message}</p>}
      {row ? (
        <p>
          {row.stage.name} · دوره {p?.label || p?.periodEnd} · تبدیل{" "}
          {fa(row.conversion)}٪ · هدف {fa(row.stage.targetConversion)}٪ · روند{" "}
          {fa(row.trend)} واحد درصد
        </p>
      ) : (
        <p>داده تکمیل‌شده برای مرحله مرتبط موجود نیست.</p>
      )}
      {kind === "constraint" &&
        d.evidence
          .filter((e) => e.constraintId === entityId)
          .map((e) => (
            <p key={e.id}>
              شواهد ثابت دوره{" "}
              {d.periods.find((p) => p.id === e.periodId)?.label || e.periodId}:{" "}
              {e.previousStageName} ← {e.stageName} · واقعی {fa(e.actual)}٪ ·
              هدف {fa(e.target)}٪ · شکاف {fa(e.gap)} واحد درصد
            </p>
          ))}
      <Link href="/scale/funnel">باز کردن قیف و درآمد</Link>
    </Panel>
  );
}
export function FunnelSummary() {
  const { store, sources } = useScale(),
    d = F.funnelData(store),
    f = d.funnels.find((f) => f.active),
    ps = f ? F.completedPeriods(d, f.id) : [],
    p = ps.at(-1),
    rs = p
      ? L.stageRows(
          d,
          p,
          ps.at(-2),
          sources.roles.map((r) => r.id),
        )
      : [],
    rev = p?.snapshot?.revenue,
    signals = L.calculateFunnelConstraintSignal(
      rs,
      rev?.revenueStageId ?? "",
      rev?.averageDealValue ?? null,
    ),
    c = signals.find((s) => s.score !== null && s.score > 0),
    estimated = rev
      ? L.calculateEstimatedRevenue(
          rs.find((r) => r.stage.id === rev.revenueStageId)?.volume ?? null,
          rev.averageDealValue,
        )
      : null;
  return (
    <Panel title="شواهد قیف رشد">
      <p>
        سلامت قیف:{" "}
        {fa(
          L.healthSummary(
            rs,
            p,
            d.staleDays,
            sources.roles.map((r) => r.id),
          ).score,
        )}{" "}
        / ۱۰۰
      </p>
      <p>
        {f?.name ?? "قیف هنوز تعریف نشده است."} · آخرین دوره{" "}
        {p?.label || p?.periodEnd || "نامشخص"} ·{" "}
        {L.funnelFreshness(p, d.staleDays).stale
          ? "داده قدیمی / ناموجود"
          : "داده به‌روز"}
      </p>
      <p>
        گلوگاه قیف: {c?.row.stage.name ?? "نامشخص"} · شکاف درآمد:{" "}
        {fa(L.calculateRevenueGap(estimated, rev?.targetRevenue ?? null))}{" "}
        {rev?.currency}
      </p>
      <p>
        بزرگ‌ترین شکاف تبدیل:{" "}
        {fa(
          rs.filter((r) => r.gap !== null).length
            ? Math.min(...rs.filter((r) => r.gap !== null).map((r) => r.gap!))
            : null,
        )}{" "}
        واحد درصد · آزمایش‌های متصل:{" "}
        {fa(
          d.links.filter((l) => l.kind === "experiment" && l.funnelId === f?.id)
            .length,
        )}
      </p>
      {rs
        .filter((r) => r.gap !== null && r.gap < 0)
        .map((r) => (
          <p key={r.stage.id}>
            {r.stage.name}: تبدیل {fa(r.conversion)}٪ در برابر هدف{" "}
            {fa(r.stage.targetConversion)}٪
          </p>
        ))}
      <Link href="/scale/funnel">تحلیل قیف، سلامت و سناریوهای درآمد</Link>
    </Panel>
  );
}
