"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useScale } from "./provider";
import * as D from "@/lib/scale/dashboard/selectors";
import {
  dimensions,
  levels,
  severityLabels,
  constraintStatuses,
  ideaStatuses,
} from "@/lib/scale/model";
import { results, statuses } from "@/lib/scale/experiments/model";
import { tehranDay } from "@/lib/scale/experiments/logic";
import {
  maturities,
  channelDecisions,
  loopStatuses,
} from "@/lib/scale/network/model";
import {
  decisions,
  sourceTypes,
  readinessData,
} from "@/lib/scale/readiness/model";
import { funnelData } from "@/lib/scale/funnel/model";
import "./dashboard.css";

export const reportNames: Record<string, string> = {
  constraints: "گلوگاه‌های رشد",
  ideas: "مسیر ایده‌ها",
  experiments: "عملکرد آزمایش‌ها",
  learnings: "یادگیری آزمایش‌ها",
  funnel: "عملکرد قیف",
  revenue: "درآمد و سناریو",
  channels: "سبد کانال‌ها",
  concentration: "تمرکز کانال‌ها",
  loops: "حلقه‌های رشد",
  readiness: "آمادگی مقیاس‌دهی",
  capacity: "ظرفیت و شکاف",
  decisions: "تصمیم‌های مقیاس‌دهی",
};
const n = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "نامشخص"
    : new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(v);
const evidenceLabels: Record<string, string> = {
  insufficient: "شواهد ناکافی",
  early: "شواهد اولیه",
  emerging: "در حال شکل‌گیری",
  repeatable: "تکرارپذیر",
  strong: "شواهد قوی",
  unproven: "اثبات‌نشده",
  weak: "ضعیف",
};
const conf: Record<string, string> = {
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
};
const matrixLabels: Record<string, string> = {
  "high-high": "شواهد قوی / ظرفیت کافی",
  "high-low": "شواهد قوی / ظرفیت محدود",
  "low-high": "شواهد محدود / ظرفیت کافی",
  "low-low": "شواهد محدود / ظرفیت محدود",
  unknown: "جایگاه نامشخص",
};
function Section({
  id,
  title,
  eyebrow,
  children,
  href,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  href?: string;
}) {
  return (
    <section className="exec-section" id={id}>
      <header>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
        {href && <Link href={href}>بررسی جزئیات ←</Link>}
      </header>
      {children}
    </section>
  );
}
function Empty({ children }: { children?: ReactNode }) {
  return (
    <p className="exec-empty">
      {children ?? "برای قضاوت، شواهد ثبت‌شده کافی نیست."}
    </p>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return rows.length ? (
    <div className="exec-table">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} data-label={headers[j]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="exec-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function Trend({
  points,
  label,
}: {
  points: { label: string; value: number | null }[];
  label: string;
}) {
  const known = points.filter((p) => p.value !== null);
  return (
    <figure className="exec-trend">
      <figcaption>{label}</figcaption>
      {known.length >= 2 ? (
        <ol>
          {points.map((p, i) => (
            <li key={i}>
              <strong>{n(p.value)}</strong>
              <span>{p.label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>حداقل دو مشاهده قابل مقایسه برای روند لازم است.</Empty>
      )}
    </figure>
  );
}

export function ReportingCenter() {
  return (
    <div className="exec-dashboard">
      <header className="exec-title">
        <small>SCALE / REPORTING</small>
        <h2>مرکز گزارش‌های رشد</h2>
        <p>از پرسش مدیریتی شروع کنید؛ سپس شواهد و تصمیم را بررسی کنید.</p>
        <Link className="exec-button" href="/scale/reports/executive">
          گزارش جلسه مدیریت ←
        </Link>
      </header>
      <div className="exec-report-index">
        {Object.entries(reportNames).map(([key, title], i) => (
          <Link href={"/scale/reports/" + key} key={key}>
            <small>{n(i + 1)}</small>
            <h3>{title}</h3>
            <span>مشاهده گزارش ←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ScaleDashboard({
  report,
  executive = false,
}: {
  report?: string;
  executive?: boolean;
}) {
  const { store, sources } = useScale();
  const [funnelId, setFunnel] = useState(""),
    [periodId, setPeriod] = useState(""),
    [channelPeriod, setChannelPeriod] = useState(""),
    [scenario, setScenario] = useState("current"),
    [owner, setOwner] = useState(""),
    [result, setResult] = useState(""),
    [candidate, setCandidate] = useState(""),
    [gate, setGate] = useState(""),
    [constraint, setConstraint] = useState(""),
    [status, setStatus] = useState(""),
    [loopId, setLoop] = useState("");
  const today = tehranDay();
  const d = useMemo(
    () =>
      D.getScaleDashboard(store, sources, {
        today,
        funnelId,
        periodId,
        channelPeriod,
        scenario,
      }),
    [store, sources, today, funnelId, periodId, channelPeriod, scenario],
  );
  const available: Record<string, boolean> = {
    constraints: true,
    ideas: d.lab.ideas > 0,
    experiments: d.lab.portfolio.length > 0,
    learnings: d.lab.portfolio.length > 0,
    funnel: !!d.funnel.period,
    revenue: !!d.funnel.model,
    channels: d.channels.rows.length > 0,
    concentration: d.channels.rows.length > 0,
    loops: d.loops.length > 0,
    readiness: d.candidates.length > 0,
    decisions: d.candidates.length > 0,
    capacity: d.capacity.rows.length > 0 || d.capacity.risks.length > 0,
  };
  const early = d.health.coverage < 40;
  const show = (...keys: string[]) =>
      report ? keys.includes(report) : keys.some((k) => available[k]),
    link = (href: string, text: string) => (
      <Link key={href + text} href={href}>
        {text}
      </Link>
    );
  const reportCandidates = useMemo(
    () =>
      report === "decisions"
        ? D.getScaleCandidatePortfolio(store, sources, true)
        : d.candidates,
    [report, store, sources, d.candidates],
  );
  const candidates = reportCandidates.filter(
    (x) =>
      (!candidate || x.candidate.id === candidate) &&
      (!gate || x.assessment.gate === gate) &&
      (!owner || x.candidate.ownerRoleId === owner),
  );
  const experiments = d.lab.portfolio.filter(
    (x) =>
      (!owner || x.experiment.ownerRoleId === owner) &&
      (!result || x.experiment.resultStatus === result) &&
      (!constraint || x.experiment.constraintId === constraint) &&
      (!status || x.experiment.status === status),
  );
  const lab = report
    ? D.summarizeGrowthLab(
        {
          ...store,
          ideas: store.ideas.filter(
            (i) =>
              (!owner || i.ownerRoleId === owner) &&
              (!constraint || i.constraintId === constraint),
          ),
        },
        today,
        experiments,
      )
    : d.lab;
  const capacity =
    report === "capacity"
      ? D.getCapacityExecutiveSummary(store, sources, candidates)
      : d.capacity;
  const channels = d.channels.rows.filter(
      (x) => !owner || x.channel.ownerRoleId === owner,
    ),
    loop = d.loops.find((x) => x.loop.id === loopId) ?? d.loops[0];
  const select = (
    label: string,
    value: string,
    set: (v: string) => void,
    options: [string, string][],
    all = "همه",
  ) => (
    <label>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        {!options.some(([, label]) => label === all) && (
          <option value="">{all}</option>
        )}
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  const headline = (
    <>
      <header className="exec-title">
        <div>
          <small>GROWTH ENGINE / EXECUTIVE SCALE</small>
          <h2>
            {executive
              ? "گزارش جلسه مدیریت رشد"
              : report
                ? reportNames[report]
                : "رشد بعدی، با چه شواهدی؟"}
          </h2>
          <p>
            {executive
              ? "تصویر جاری برای گفت‌وگو و تصمیم مدیریت"
              : report
                ? "شواهد مرتبط، زمینه تصمیم و مسیر پیگیری"
                : "محدودیت رشد را ببینید؛ پیش از افزایش حجم، ظرفیت سازمان را بسنجید."}
          </p>
        </div>
        <Link
          href={executive ? "/scale/dashboard" : "/scale/reports/executive"}
        >
          {executive ? "بازگشت به داشبورد" : "گزارش مدیریتی ←"}
        </Link>
      </header>
      {!report && (
        <>
          <div className="exec-hero">
            <div>
              <small>تمرکز اصلی مدیریت</small>
              <h3>{d.focus?.title ?? "ساخت شواهد قابل اتکا"}</h3>
              <p>{d.summary}</p>
              <Link href={d.focus?.href ?? "/scale/diagnosis"}>
                بررسی و اقدام ←
              </Link>
            </div>
            <div className="exec-health">
              <span>سلامت موتور رشد</span>
              <strong>
                {n(d.health.score)}
                <small> / ۱۰۰</small>
              </strong>
              <p>{d.health.status}</p>
              <small>پوشش محاسبه {n(d.health.coverage)}٪</small>
            </div>
          </div>
          <div className="exec-headlines">
            <Metric
              label="گلوگاه اصلی"
              value={d.constraint.primary?.title ?? "تعیین نشده"}
            />
            <Metric
              label="حرکت رشد"
              value={D.movementLabels[d.momentum.state]}
            />
            <Metric
              label="شواهد رشد"
              value={evidenceLabels[d.evidence.state]}
            />
            <Metric
              label="کاندید آماده بررسی"
              value={n(
                d.candidates.filter((x) => x.assessment.gate === "ready")
                  .length,
              )}
            />
            <Metric
              label="ریسک اصلی ظرفیت"
              value={capacity.primary?.area ?? "نامشخص"}
            />
            <Metric
              label="فاصله تا هدف درآمد"
              value={n(d.revenue.gap)}
              detail={`${d.revenue.currency} · مبنا: ${d.revenue.basis}`}
            />
            <Metric label="اطمینان داده" value={conf[d.confidence.state]} />
          </div>
        </>
      )}
    </>
  );
  return (
    <div className={"exec-dashboard" + (executive ? " exec-presentation" : "")}>
      {headline}
      {!report && early && (
        <section className="exec-section">
          <h2>قدم بعدی: ساخت شواهد رشد</h2>
          <p>
            این تصویر هنوز برای قضاوت عملکرد کافی نیست. از یک گلوگاه روشن، یک
            آزمایش قابل سنجش و اولین دوره قیف شروع کنید.
          </p>
          <div className="exec-inline">
            <Link href="/scale/constraints">۱. تعیین گلوگاه</Link>
            <Link href="/scale/experiments">۲. طراحی آزمایش</Link>
            <Link href="/scale/funnel">۳. ثبت دوره قیف</Link>
          </div>
        </section>
      )}
      {!executive && (
        <div className="exec-controls">
          {show("funnel", "revenue") && (
            <>
              {select(
                "قیف مورد بررسی",
                funnelId,
                (v) => {
                  setFunnel(v);
                  setPeriod("");
                },
                funnelData(store).funnels.map((f) => [f.id, f.name]),
                "قیف فعال",
              )}
              {select(
                "دوره تکمیل‌شده قیف",
                periodId,
                setPeriod,
                d.funnel.periods.map((p) => [p.id, p.label]),
                "آخرین دوره",
              )}
              {select(
                "مبنای محاسبه سناریو",
                scenario,
                setScenario,
                [
                  ["current", "نرخ‌های مشاهده‌شده"],
                  ["target", "نرخ‌های هدف"],
                  ...readinessData(store)
                    .scenarios.filter((s) => !!s.funnelPeriodId)
                    .map((s) => [s.id, s.name] as [string, string]),
                ],
                "نرخ‌های مشاهده‌شده",
              )}
            </>
          )}
          {show("channels", "concentration") &&
            select(
              "دوره کانال‌ها",
              channelPeriod,
              setChannelPeriod,
              d.channels.dates.map((p) => [p, p.replace("|", " تا ")]),
              "آخرین دوره",
            )}
          {report && (
            <>
              {[
                "ideas",
                "experiments",
                "learnings",
                "channels",
                "readiness",
                "capacity",
                "decisions",
              ].includes(report) &&
                select(
                  "مالک",
                  owner,
                  setOwner,
                  sources.roles.map((r) => [r.id, r.title]),
                )}
              {["experiments", "learnings", "ideas"].includes(report) &&
                select(
                  "گلوگاه",
                  constraint,
                  setConstraint,
                  store.constraints.map((c) => [c.id, c.title]),
                )}
              {["experiments", "learnings"].includes(report) && (
                <>
                  {select(
                    "نتیجه آزمایش",
                    result,
                    setResult,
                    Object.entries(results),
                  )}
                  {select(
                    "وضعیت آزمایش",
                    status,
                    setStatus,
                    Object.entries(statuses),
                  )}
                </>
              )}
              {["readiness", "capacity", "decisions"].includes(report) && (
                <>
                  {select(
                    "کاندید",
                    candidate,
                    setCandidate,
                    reportCandidates.map((c) => [
                      c.candidate.id,
                      c.candidate.name,
                    ]),
                  )}
                  {select(
                    "دروازه تحلیلی",
                    gate,
                    setGate,
                    Object.entries(D.gateLabels),
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
      {!report && (
        <>
          <details className="exec-method">
            <summary>امتیاز سلامت چگونه محاسبه می‌شود؟</summary>
            <p>{d.health.note}</p>
            <Table
              headers={["مؤلفه", "امتیاز", "وزن", "سهم در امتیاز", "مبنا"]}
              rows={d.health.components.map((c) => [
                c.label,
                n(c.value),
                n(c.weight) + "٪",
                n(c.contribution),
                c.basis,
              ])}
            />
            <p>
              اعداد نامشخص از مخرج وزن حذف می‌شوند؛ پوشش کمتر از ۶۰٪ برای قضاوت
              کافی نیست.
            </p>
          </details>
          <Section
            id="attention"
            title="اکنون کجا مداخله کنیم؟"
            eyebrow="۰۱ / توجه مدیریت"
          >
            <ol className="exec-attention">
              {d.attention.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <span className={"exec-severity s" + a.severity}>
                    {a.severity === 3
                      ? "بحرانی"
                      : a.severity === 2
                        ? "بالا"
                        : "پایش"}
                  </span>
                  <div>
                    <Link href={a.href}>{a.title}</Link>
                    <p>{a.evidence}</p>
                  </div>
                  <small>{a.category}</small>
                </li>
              ))}
            </ol>
            <details>
              <summary>مبنای اولویت‌بندی</summary>
              <p>
                شدت، ریسک ظرفیت، اثر کسب‌وکار، ارتباط گلوگاه، درآمد، قدرت شواهد،
                مدت و هم‌راستایی؛ ترتیب قطعی و بدون امتیاز اعشاری ساختگی.
              </p>
            </details>
          </Section>
        </>
      )}
      {show("constraints") && (
        <Section
          id="constraint"
          title="چه چیزی رشد را محدود می‌کند؟"
          eyebrow="گلوگاه رشد"
          href="/scale/constraints"
        >
          {d.constraint.primary ? (
            <div className="exec-constraint">
              <h3>
                {link(
                  "/scale/constraints/" + d.constraint.primary.id,
                  d.constraint.primary.title,
                )}
              </h3>
              <p>
                {dimensions[d.constraint.primary.dimension]} · شدت{" "}
                {severityLabels[d.constraint.primary.severity]} · اطمینان{" "}
                {levels[d.constraint.primary.confidence]} ·{" "}
                {constraintStatuses[d.constraint.primary.status]}
              </p>
              <blockquote>
                {d.constraint.primary.evidence.map((e) => e.text).join("؛ ") ||
                  "شواهد هنوز ثبت نشده"}
              </blockquote>
              <p>
                حرکت گلوگاه:{" "}
                {d.constraint.links.some(
                  (l) => l.stageId === d.funnel.constraint?.row.stage.id,
                )
                  ? D.movementLabels[
                      D.movement(d.funnel.constraint?.row.trend ?? null)
                    ]
                  : "داده قابل مقایسه متصل نداریم"}
              </p>
              <div className="exec-inline">
                {d.constraint.experiments.map((e) =>
                  link("/scale/experiments/" + e.id, e.title),
                )}
                {d.constraint.ideas.map((i) =>
                  link("/scale/ideas/" + i.id, i.title),
                )}
                {d.constraint.links.length > 0 &&
                  link("/scale/funnel", "قیف مرتبط")}
                {d.constraint.primary.linkedSystemProcessId &&
                  link(
                    "/system/processes/" +
                      d.constraint.primary.linkedSystemProcessId,
                    "فرآیند مرتبط",
                  )}
                {d.constraint.primary.linkedStrategyObjectiveId &&
                  link(
                    sources.objectives.some(
                      (o) =>
                        o.id ===
                        d.constraint.primary?.linkedStrategyObjectiveId,
                    )
                      ? `/strategy/cycles/${sources.objectives.find((o) => o.id === d.constraint.primary?.linkedStrategyObjectiveId)!.cycleId}/objectives/${d.constraint.primary.linkedStrategyObjectiveId}`
                      : "/strategy",
                    "هدف مرتبط",
                  )}
              </div>
            </div>
          ) : (
            <Empty>یک گلوگاه فعال و شواهد آن را مشخص کنید.</Empty>
          )}
          <Table
            headers={["گلوگاه ثانویه", "شدت", "وضعیت"]}
            rows={d.constraint.secondary.map((c) => [
              link("/scale/constraints/" + c.id, c.title),
              severityLabels[c.severity],
              constraintStatuses[c.status],
            ])}
          />
        </Section>
      )}
      {show("ideas", "experiments", "learnings") && (
        <Section
          id="lab"
          title="از فرضیه تا یادگیری"
          eyebrow="آزمایشگاه رشد"
          href="/scale/experiments"
        >
          {report && (
            <p className="exec-caption">
              شمارش آزمایش‌ها، توزیع نتایج و جزئیات، همگی مطابق فیلترهای
              انتخاب‌شده‌اند.
            </p>
          )}
          <div className="exec-pipeline">
            {[
              ["ایده", lab.ideas],
              ["آماده آزمایش", lab.ready],
              ["جاری", lab.running],
              ["تکمیل‌شده", lab.completed],
              ["دارای تصمیم", lab.decided],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{n(value as number)}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="exec-caption">
            موجودی مراحل یادگیری؛ نرخ تبدیل فروش نیست. {n(lab.recentCompleted)}{" "}
            آزمایش در ۳۰ روز اخیر تکمیل شده؛ {n(lab.recentLearnings.length)}{" "}
            یادگیری و میانگین مدت {n(lab.averageDuration)} روز.
          </p>
          {report === "ideas" ? (
            <Table
              headers={["ایده", "وضعیت", "گلوگاه", "شواهد"]}
              rows={store.ideas
                .filter(
                  (i) =>
                    (!constraint || i.constraintId === constraint) &&
                    (!owner || i.ownerRoleId === owner),
                )
                .map((i) => [
                  link("/scale/ideas/" + i.id, i.title),
                  ideaStatuses[i.status],
                  store.constraints.find((c) => c.id === i.constraintId)
                    ?.title ?? "بدون پیوند",
                  i.evidence || "ثبت نشده",
                ])}
            />
          ) : report === "learnings" ? (
            <div className="exec-learnings">
              {experiments.flatMap((x) =>
                x.learnings.map((l) => (
                  <blockquote key={l.id}>
                    <p>{l.statement}</p>
                    <small>{l.evidence}</small>
                    <p>
                      {link(
                        "/scale/experiments/" + x.experiment.id,
                        x.experiment.title,
                      )}{" "}
                      ·{" "}
                      {x.experiment.resultStatus
                        ? results[x.experiment.resultStatus]
                        : "بدون نتیجه"}
                    </p>
                  </blockquote>
                )),
              )}
            </div>
          ) : (
            <>
              <div className="exec-distribution">
                {Object.entries(results).map(([k, title]) => (
                  <div key={k}>
                    <span>{title}</span>
                    <strong>{n(lab.distribution[k])}</strong>
                  </div>
                ))}
              </div>
              <p className="exec-caption">
                نتیجه منفی می‌تواند یادگیری معتبر ایجاد کند؛ تعداد بیشتر آزمایش،
                عملکرد بهتر را اثبات نمی‌کند.
              </p>
              <Table
                headers={["آزمایش", "وضعیت / نتیجه", "یادگیری", "نیازمند توجه"]}
                rows={(report ? experiments : experiments.slice(0, 6)).map(
                  (x) => [
                    link(
                      "/scale/experiments/" + x.experiment.id,
                      x.experiment.title,
                    ),
                    statuses[x.experiment.status] +
                      " · " +
                      (x.experiment.resultStatus
                        ? results[x.experiment.resultStatus]
                        : "نتیجه ندارد"),
                    n(x.learnings.length),
                    x.issues.join("؛ ") || "مورد ثبت‌شده ندارد",
                  ],
                )}
              />
            </>
          )}
        </Section>
      )}
      {show("funnel") && (
        <Section
          id="funnel"
          title="قیف کجا نشت می‌کند؟"
          eyebrow="قیف و تبدیل"
          href="/scale/funnel"
        >
          <p>
            {d.funnel.funnel?.name ?? "قیف تعریف نشده"} ·{" "}
            {d.funnel.period?.label ?? "بدون دوره تکمیل‌شده"} · سلامت قیف{" "}
            {n(d.funnel.health.score)} · پوشش {n(d.funnel.health.coverage)}٪
          </p>
          <Table
            headers={[
              "مرحله",
              "حجم",
              "تبدیل",
              "هدف تبدیل",
              "فاصله از هدف",
              "روند",
            ]}
            rows={d.funnel.rows.map((r) => [
              r.stage.name,
              n(r.volume) + " " + r.stage.metricUnit,
              n(r.conversion),
              n(r.stage.targetConversion),
              n(r.gap) + " واحد درصد",
              D.movementLabels[D.movement(r.trend)],
            ])}
          />
          <p className="exec-callout">
            بزرگ‌ترین سیگنال محدودیت:{" "}
            {d.funnel.constraint?.row.stage.name ?? "داده کافی نیست"}؛ پیشنهاد
            تحلیلی، مستقل از گلوگاه منتخب مدیریت.
          </p>
          <Trend
            label="تبدیل مرحله دارای سیگنال محدودیت · درصد"
            points={d.funnel.conversionTrend}
          />
        </Section>
      )}
      {show("revenue") && (
        <Section
          id="revenue"
          title="برای رسیدن به هدف، چه حجمی لازم است؟"
          eyebrow="درآمد و سناریو"
          href="/scale/funnel"
        >
          <div className="exec-stats">
            <Metric
              label="درآمد ثبت‌شده همان دوره"
              value={n(d.revenue.actual)}
              detail={d.revenue.currency}
            />
            <Metric
              label="برآورد قیف همان دوره"
              value={n(d.revenue.estimate)}
              detail={d.revenue.currency}
            />
            <Metric
              label="هدف همان دوره"
              value={n(d.revenue.target)}
              detail={d.revenue.currency}
            />
            <Metric
              label="میانگین قرارداد"
              value={n(d.revenue.deal)}
              detail={d.revenue.currency}
            />
          </div>
          <div className="exec-scenario">
            <small>محاسبه شرطی، نه پیش‌بینی</small>
            <h3>{d.revenue.scenarioLabel}</h3>
            <p>
              هدف سناریو {n(d.revenue.scenarioTarget)}{" "}
              {d.revenue.scenarioCurrency}
            </p>
            <ol>
              {d.revenue.required.map((r) => (
                <li key={r.id}>
                  <strong>{n(r.required)}</strong>
                  <span>
                    {r.name} · {r.unit}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="exec-bridge">
            <div>
              <h3>حجم</h3>
              <p>{n(d.funnel.rows[0]?.volume)} ورودی ثبت‌شده</p>
            </div>
            <div>
              <h3>تبدیل</h3>
              <p>
                {d.funnel.constraint?.row.stage.name ?? "نامشخص"} ·{" "}
                {n(d.funnel.constraint?.row.conversion)}٪
              </p>
            </div>
            <div>
              <h3>ارزش میانگین</h3>
              <p>
                {n(d.revenue.deal)} {d.revenue.currency}
              </p>
            </div>
            <div>
              <h3>تکرار / گسترش</h3>
              <p>
                {n(d.revenue.repeat)}٪ · درآمد گسترش {n(d.revenue.expansion)}
              </p>
            </div>
          </div>
          <p className="exec-caption">
            این‌ها اهرم‌های بررسی‌اند؛ سهم علّی هر اهرم در رشد محاسبه نشده است.
          </p>
        </Section>
      )}
      {show("channels", "concentration") && (
        <Section
          id="channels"
          title={
            report === "concentration"
              ? "تقاضا چقدر به یک کانال وابسته است؟"
              : "کدام کانال تقاضای واجد شرایط می‌سازد؟"
          }
          eyebrow="سبد کانال‌ها"
          href="/scale/channels"
        >
          <p>
            دوره مشترک: {d.channels.period.replace("|", " تا ") || "ثبت نشده"} ·{" "}
            {n(d.channels.active)} فعال · {n(d.channels.scaling)} در حال توسعه ·{" "}
            {n(d.channels.repeatable)} با بلوغ تکرارپذیر یا بالاتر
          </p>
          <div className="exec-mix">
            {channels.map((c) => (
              <div key={c.channel.id}>
                <Link href={"/scale/channels/" + c.channel.id}>
                  {c.channel.name}
                </Link>
                {c.period?.qualifiedLeads != null ? (
                  <meter
                    min={0}
                    max={Math.max(
                      1,
                      ...channels.map((x) => x.period?.qualifiedLeads ?? 0),
                    )}
                    value={c.period?.qualifiedLeads ?? 0}
                    aria-label={"تقاضای واجد شرایط " + c.channel.name}
                  />
                ) : (
                  <span className="exec-caption">داده هم‌دوره ندارد</span>
                )}
                <strong>{n(c.period?.qualifiedLeads)}</strong>
              </div>
            ))}
          </div>
          <p className="exec-callout">
            سهم ثبت‌شده کانال اول {n(d.channels.concentration.top)}٪ · دو کانال
            اول {n(d.channels.concentration.top2)}٪ ·{" "}
            {d.channels.concentration.partial
              ? "پوشش ناقص؛ قضاوت محتاطانه"
              : "داده هم‌دوره"}{" "}
            · {d.channels.resilience.reason}
          </p>
          {report !== "concentration" && (
            <Table
              headers={[
                "کانال",
                "بلوغ",
                "واجد شرایط",
                "مشتری",
                "تبدیل",
                "درآمد منتسب‌شده",
                "هزینه",
                "روند",
                "آمادگی / پوشش",
              ]}
              rows={channels.map((c) => [
                link("/scale/channels/" + c.channel.id, c.channel.name),
                maturities[c.channel.maturity],
                n(c.period?.qualifiedLeads),
                n(c.period?.customers),
                n(c.performance.conversion) + "٪",
                n(c.period?.revenue) + " " + (c.period?.currency ?? ""),
                n(c.period?.spend),
                D.movementLabels[D.movement(c.trend.qualifiedLeads)],
                n(c.readiness.score) + " / " + n(c.readiness.coverage) + "٪",
              ])}
            />
          )}
          <details>
            <summary>تصمیم‌های اخیر کانال‌ها</summary>
            {d.channels.decisions.map((x) => (
              <p key={x.id}>
                {link("/scale/channels/" + x.channelId, x.channelName)} ·{" "}
                {channelDecisions[x.decision]} · {x.reason}
              </p>
            ))}
          </details>
        </Section>
      )}
      {show("loops") && (
        <Section
          id="loops"
          title="آیا رشد، ورودی رشد بعدی را می‌سازد؟"
          eyebrow="حلقه‌های رشد"
          href="/scale/loops"
        >
          {!executive &&
            select(
              "حلقه مورد بررسی",
              loopId,
              setLoop,
              d.loops.map((x) => [x.loop.id, x.loop.name]),
              "اولین حلقه",
            )}
          <div className="exec-inline">
            {["active", "testing", "weak"].map((k) => (
              <span key={k}>
                {loopStatuses[k as keyof typeof loopStatuses]}:{" "}
                {n(d.loops.filter((x) => x.loop.status === k).length)}
              </span>
            ))}
            <span>
              تکرارپذیر:{" "}
              {n(
                d.loops.filter((x) =>
                  ["repeatable", "strong"].includes(x.strength.state),
                ).length,
              )}
            </span>
          </div>
          {loop ? (
            <>
              <h3>
                {link("/scale/loops/" + loop.loop.id, loop.loop.name)} ·{" "}
                {evidenceLabels[loop.strength.state]}
              </h3>
              <ol className="exec-loop">
                {loop.nodes.map((node) => (
                  <li key={node.id}>
                    {node.name}
                    <span>←</span>
                  </li>
                ))}
              </ol>
              <p>
                {loop.strength.reason} · خروجی {n(loop.trend.current)}{" "}
                {loop.periods.at(-1)?.snapshot?.metricUnit ?? ""} · چرخه{" "}
                {n(loop.trend.cycleTime)} روز ·{" "}
                {D.movementLabels[D.movement(loop.trend.delta)]}
              </p>
              <p>
                شاخص: {loop.periods.at(-1)?.snapshot?.metricName ?? "ثبت نشده"}{" "}
                · شواهد {n(loop.evidence.length)}
              </p>
              {loop.leakage.map((l) => (
                <p className="exec-callout" key={l.id}>
                  {l.description} · {severityLabels[l.severity]}
                </p>
              ))}
              <div className="exec-inline">
                {loop.links
                  .filter((l) => ["experiment", "idea"].includes(l.kind))
                  .map((l) =>
                    link(
                      "/scale/" +
                        (l.kind === "idea" ? "ideas" : "experiments") +
                        "/" +
                        l.entityId,
                      l.kind === "idea" ? "ایده مرتبط" : "آزمایش مرتبط",
                    ),
                  )}
              </div>
            </>
          ) : (
            <Empty>هنوز حلقه رشد قابل بررسی ثبت نشده است.</Empty>
          )}
        </Section>
      )}
      {show("readiness", "decisions") && (
        <Section
          id="candidates"
          title="کدام فرصت آماده بررسی مقیاس‌دهی است؟"
          eyebrow="سبد کاندیدها"
          href="/scale/readiness"
        >
          <div className="exec-distribution">
            {Object.entries(D.gateLabels).map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>
                  {n(
                    candidates.filter((c) => c.assessment.gate === key).length,
                  )}
                </strong>
              </div>
            ))}
          </div>
          <p className="exec-caption">
            دروازه تحلیلی با تصمیم نهایی مدیریت یکسان نیست. سناریوی
            نمایش‌داده‌شده: آخرین سناریوی ثبت‌شده هر کاندید.
          </p>
          <Table
            headers={[
              "کاندید / منبع",
              "شواهد",
              "آمادگی / اطمینان",
              "دروازه",
              "اولین شکست",
              "تصمیم مدیریت",
            ]}
            rows={candidates.map((c) => [
              <>
                {link("/scale/readiness/" + c.candidate.id, c.candidate.name)}
                <small>
                  {sourceTypes[c.candidate.sourceType]} ·{" "}
                  {c.scenario?.name ?? "سناریو ندارد"}
                </small>
              </>,
              c.assessment.evidence.detail,
              n(c.assessment.score) + " · " + conf[c.assessment.confidence],
              D.gateLabels[c.assessment.gate],
              c.assessment.primary?.area ?? "نامشخص",
              c.decision ? decisions[c.decision.decision] : "تصمیم ثبت نشده",
            ])}
          />
          {report === "decisions" ? (
            <div>
              {readinessData(store)
                .decisions.filter((x) =>
                  candidates.some((c) => c.candidate.id === x.scaleCandidateId),
                )
                .map((x) => (
                  <blockquote key={x.id}>
                    <strong>{decisions[x.decision]}</strong>
                    <p>{x.rationale}</p>
                    <small>
                      {new Date(x.createdAt).toLocaleDateString("fa-IR", {
                        timeZone: "Asia/Tehran",
                      })}
                    </small>
                  </blockquote>
                ))}
            </div>
          ) : (
            <>
              <h3>شواهد رشد × ظرفیت سازمان</h3>
              <div className="exec-matrix">
                {Object.entries(matrixLabels)
                  .filter(([k]) => k !== "unknown")
                  .map(([key, label]) => (
                    <div key={key}>
                      <h4>{label}</h4>
                      {candidates
                        .filter((c) => c.assessment.matrix === key)
                        .map((c) => (
                          <Link
                            key={c.candidate.id}
                            href={"/scale/readiness/" + c.candidate.id}
                          >
                            {c.candidate.name}
                          </Link>
                        ))}
                    </div>
                  ))}
              </div>
              <p>
                جایگاه نامشخص:{" "}
                {candidates
                  .filter((c) => c.assessment.matrix === "unknown")
                  .map((c) => c.candidate.name)
                  .join("، ") || "نداریم"}
              </p>
              {candidates.map((c) => (
                <Trend
                  key={c.candidate.id}
                  label={
                    "تاریخچه آمادگی: " +
                    c.candidate.name +
                    " · سناریو و پوشش هر ارزیابی مستقل است"
                  }
                  points={c.trend.map((t) => ({
                    label:
                      new Date(t.date).toLocaleDateString("fa-IR", {
                        timeZone: "Asia/Tehran",
                      }) +
                      " · پوشش " +
                      n(t.coverage) +
                      "٪ · " +
                      n(t.factor) +
                      "×",
                    value: t.score,
                  }))}
                />
              ))}
            </>
          )}
        </Section>
      )}
      {show("capacity") && (
        <Section
          id="capacity"
          title="اولین نقطه شکست در صورت رشد"
          eyebrow="توان سازمان"
          href="/scale/capacity"
        >
          {capacity.primary ? (
            <div className="exec-breakpoint">
              <h3>
                {link(
                  "/scale/readiness/" + capacity.primary.candidate.id,
                  capacity.primary.area,
                )}
              </h3>
              <p>{capacity.primary.evidence}</p>
              <strong>{capacity.primary.recommendedPreparation}</strong>
            </div>
          ) : (
            <Empty>
              ریسک قابل رتبه‌بندی ثبت نشده؛ این به معنی ظرفیت کافی نیست.
            </Empty>
          )}
          <Table
            headers={[
              "حوزه",
              "ظرفیت",
              "بار فعلی",
              "نیاز سناریو",
              "شکاف",
              "بهره‌برداری فعلی",
            ]}
            rows={capacity.rows
              .filter((p) =>
                candidates.some((c) => c.candidate.id === p.candidate.id),
              )
              .map((p) => [
                link("/scale/readiness/" + p.candidate.id, p.name),
                n(p.currentCapacity) + " " + p.unit,
                n(p.currentLoad),
                n(p.required),
                n(p.gap),
                n(p.utilization) + "٪",
              ])}
          />
          <p className="exec-caption">
            واحدها و دوره‌های متفاوت جمع نمی‌شوند. آستانه‌های ظرفیت راهنمای قابل
            تنظیم‌اند.
          </p>
          {candidates
            .filter((c) => c.assessment.next)
            .map((c) => (
              <p key={c.candidate.id}>
                گلوگاه بعدی احتمالی{" "}
                {link(
                  "/scale/readiness/" + c.candidate.id,
                  c.assessment.next!.area,
                )}
                ؛ {c.assessment.next!.evidence}
              </p>
            ))}
          <div className="exec-inline">
            {[
              ["کل", capacity.preparation.length],
              [
                "تکمیل",
                capacity.preparation.filter((p) => p.status === "completed")
                  .length,
              ],
              [
                "در حال انجام",
                capacity.preparation.filter((p) => p.status === "doing").length,
              ],
              [
                "مسدود",
                capacity.preparation.filter((p) => p.status === "blocked")
                  .length,
              ],
            ].map(([label, value]) => (
              <span key={label}>
                {label}: {n(value as number)}
              </span>
            ))}
          </div>
        </Section>
      )}
      {!report && (
        <>
          <Section
            id="alignment"
            title="جهت، موتور رشد و توان اجرا"
            eyebrow="پیوند 3S"
          >
            <div className="exec-3s">
              <div>
                <small>STRATEGY</small>
                <h3>به کجا می‌رویم؟</h3>
                <p>هدف و اولویت مرتبط با فرصت رشد</p>
              </div>
              <div>
                <small>SCALE</small>
                <h3>چه چیزی ما را می‌رساند؟</h3>
                <p>شواهد رشد و تصمیم مقیاس‌دهی</p>
              </div>
              <div>
                <small>SYSTEM</small>
                <h3>آیا سازمان توان حفظ آن را دارد؟</h3>
                <p>فرآیند، استقلال و ظرفیت</p>
              </div>
            </div>
            {candidates.map((c) => (
              <article className="exec-alignment" key={c.candidate.id}>
                <h3>
                  {link("/scale/readiness/" + c.candidate.id, c.candidate.name)}
                </h3>
                <p>
                  اولویت:{" "}
                  {sources.priorities.find(
                    (p) => p.id === c.objective?.relatedPriorityId,
                  )?.title ?? "بدون پیوند"}{" "}
                  ← هدف:{" "}
                  {c.objective
                    ? link(
                        `/strategy/cycles/${c.objective.cycleId}/objectives/${c.objective.id}`,
                        c.objective.title,
                      )
                    : "بدون پیوند"}{" "}
                  ← نتیجه کلیدی: {c.kr?.title ?? "بدون پیوند"}
                </p>
                <p>
                  {c.aligned
                    ? "پیوند ثبت شده؛ تأیید هم‌راستایی نیازمند قضاوت مدیریت است."
                    : "اکتشاف می‌تواند بدون پیوند باشد؛ تعهد منابع عمده نیازمند بررسی است."}
                </p>
              </article>
            ))}
            <Table
              headers={[
                "فرآیند مرتبط",
                "سلامت",
                "استاندارد",
                "پذیرش",
                "استقلال",
                "شواهد وابستگی",
              ]}
              rows={capacity.processes.map((p) => [
                link("/system/processes/" + p.id, p.title),
                n(p.health),
                n(p.standardization),
                n(p.adoption),
                n(p.independence),
                p.reasons.join("؛ ") || "مورد ثبت‌شده ندارد",
              ])}
            />
          </Section>
          <Section
            id="data"
            title="چقدر به این تصویر اطمینان داریم؟"
            eyebrow="کیفیت شواهد"
          >
            <div className="exec-stats">
              <Metric
                label="کامل‌بودن داده"
                value={n(d.confidence.completeness.score) + "٪"}
              />
              <Metric label="اطمینان داده" value={conf[d.confidence.state]} />
            </div>
            <p>{d.confidence.reason}</p>
            <div className="exec-inline">
              {d.confidence.completeness.parts.map(([label, value]) => (
                <span key={label}>
                  {value ? "✓" : "○"} {label}
                </span>
              ))}
            </div>
            <Table
              headers={["منبع", "آخرین مشاهده", "تازگی"]}
              rows={d.confidence.freshness.map((x) => [
                x.label,
                x.date
                  ? new Date(x.date).toLocaleDateString("fa-IR", {
                      timeZone: "Asia/Tehran",
                    })
                  : "ثبت نشده",
                x.future
                  ? "تاریخ آینده؛ بررسی شود"
                  : x.stale
                    ? "قدیمی یا ناموجود"
                    : "در بازه پایش",
              ])}
            />
            <details>
              <summary>شواهد حرکت رشد</summary>
              {d.momentum.signals.map((x, i) => (
                <p key={i}>
                  {x.label}: {D.movementLabels[D.movement(x.delta)]}
                </p>
              ))}
            </details>
            <p className="exec-caption">
              داده ناقص، عملکرد ضعیف نیست. این گزارش داده‌های جاری و تاریخچه
              ثبت‌شده را کنار هم می‌گذارد؛ تصویر تاریخی کل سازمان نیست.
            </p>
          </Section>
        </>
      )}
      <footer className="exec-footer">
        <Link href="/scale/reports">مرکز گزارش‌ها</Link>
        <span>Growth Engine · by 1 Minute Manager</span>
        <span>
          مرور{" "}
          {new Date(today).toLocaleDateString("fa-IR", {
            timeZone: "Asia/Tehran",
          })}
        </span>
      </footer>
    </div>
  );
}
