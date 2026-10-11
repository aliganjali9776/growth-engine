"use client";
import { reviewDate as tehranDay } from "@/lib/strategy/adapt/definition";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStrategy } from "./provider";
import {
  todayTehran,
  dateLabel,
  directions,
  cycleStatuses,
} from "@/lib/strategy/model";
import {
  getStrategyDashboard,
  type StrategyDashboard,
} from "@/lib/strategy/dashboard/selectors";
import {
  severityLabels,
  type ReportFilters,
} from "@/lib/strategy/dashboard/types";
import { krStatuses, objectiveHealthLabels } from "@/lib/strategy/kr/types";
import {
  initiativeStatuses,
  effectivenessLabels,
} from "@/lib/strategy/initiatives/types";
import "./dashboard.css";

const number = (n: number | null | undefined, suffix = "") =>
  n == null
    ? "داده کافی نیست"
    : new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(n) +
      suffix;
const changeField = (field: string) =>
  ({
    targetValue: "مقدار هدف",
    deadline: "مهلت",
    status: "وضعیت",
    rank: "ترتیب اولویت",
    progress: "پیشرفت",
    effectiveness: "اثربخشی",
    ownerRoleId: "مالک",
    title: "عنوان",
    startDate: "شروع",
  })[field] ?? field;
const changeValue = (value: unknown) =>
  typeof value === "number"
    ? number(value)
    : ({
        ...cycleStatuses,
        ...initiativeStatuses,
        selected: "منتخب",
        deprioritized: "خارج از تمرکز",
        cancelled: "لغوشده",
      }[String(value)] ?? String(value));
const changeDestination = (
  d: StrategyDashboard,
  c: StrategyDashboard["changes"][number],
) =>
  d.adapt.some((r) => r.id === c.reviewId)
    ? "/strategy/adapt/" + c.reviewId
    : `/strategy/cycles/${d.cycle.id}/learn`;
const pct = (n: number | null | undefined) => number(n, "٪");
const status = (s: string | null) =>
  krStatuses[s as keyof typeof krStatuses] ?? "داده کافی نیست";
const owner = (d: StrategyDashboard, id: string) =>
  d.source.roles.find((r) => r.id === id)?.title ?? "مالک نامشخص";
function Blank({
  children = "داده‌ای برای این انتخاب ثبت نشده است.",
}: {
  children?: ReactNode;
}) {
  return <p className="sd-empty">{children}</p>;
}
function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="sd-section">
      <header>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function Bar({
  value,
  gold = false,
}: {
  value: number | null;
  gold?: boolean;
}) {
  return (
    <span className={"sd-bar " + (gold ? "gold" : "")} aria-hidden="true">
      <i style={{ width: `${value ?? 0}%` }} />
    </span>
  );
}
function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <div
      className="sd-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="جدول گزارش؛ قابل پیمایش افقی"
    >
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Health({ d }: { d: StrategyDashboard }) {
  return (
    <details className="sd-disclosure">
      <summary>سلامت چگونه محاسبه شد؟ · نسخه {d.health.version}</summary>
      <p>
        سلامت با پیشرفت برابر نیست. وزن مؤلفه‌های قابل محاسبه بازتوزیع می‌شود؛
        حداقل ۶۰٪ وزن و داده عملکرد زمانی لازم است.
      </p>
      <Table
        heads={[
          "مؤلفه",
          "امتیاز",
          "وزن پایه",
          "سهم نهایی",
          "داده موجود",
          "منطق",
        ]}
      >
        {d.health.components.map((c) => (
          <tr key={c.id}>
            <th>{c.label}</th>
            <td>{number(c.score)}</td>
            <td>{pct(c.weight)}</td>
            <td>{number(c.contribution)}</td>
            <td>{c.availability}</td>
            <td>{c.reason}</td>
          </tr>
        ))}
      </Table>
      <p>
        پوشش وزنی: {pct(d.health.coverage)} · امتیاز پیش از سقف ریسک:{" "}
        {number(d.health.raw)} · امتیاز نهایی: {number(d.health.score)}
      </p>
      {d.health.caps.map((c) => (
        <p key={c}>{c}</p>
      ))}
    </details>
  );
}
function ExecutiveHeader({ d }: { d: StrategyDashboard }) {
  return (
    <>
      <header className="sd-hero">
        <div className="sd-eyebrow">GROWTH ENGINE / EXECUTIVE STRATEGY</div>
        <div className="sd-hero-title">
          <div>
            <p>
              {d.source.historical ? "گزارش نهایی دوره" : "نبض استراتژی"} · تا{" "}
              {dateLabel(d.asOf)}
            </p>
            <h2>{d.cycle.name}</h2>
          </div>
          <div className="sd-lead-number">
            <strong>{pct(d.progress)}</strong>
            <span>پیشرفت نتایج</span>
          </div>
        </div>
        <dl className="sd-metrics">
          <Stat
            label="سلامت استراتژی"
            value={
              <>
                {number(d.health.score)} <small>{d.health.label}</small>
              </>
            }
          />
          <Stat label="حرکت اخیر" value={d.momentum.label} />
          <Stat label="اطمینان میانگین" value={number(d.confidence, " / ۱۰")} />
          <Stat
            label="روز تا پایان دوره"
            value={
              d.source.historical
                ? "دوره بسته"
                : number(Math.max(0, d.daysRemaining))
            }
          />
          <Stat label="کامل بودن داده" value={pct(d.completeness.score)} />
        </dl>
        <div className="sd-focus">
          <span>تمرکز اصلی مدیریت</span>
          {d.focus ? (
            <Link href={d.focus.destination}>
              {d.focus.title} — {d.focus.recommendedManagementAction} ←
            </Link>
          ) : (
            <p>
              ابتدا پوشش داده و ریتم مرور را حفظ کنید؛ ریسک برجسته‌ای در داده
              موجود شناسایی نشده است.
            </p>
          )}
        </div>
      </header>
      <p className="sd-summary">{d.summary}</p>
      <p className="sd-provenance">
        {d.source.historySource} · {number(d.performance.knownObjectives)} از{" "}
        {number(d.performance.objectiveTotal)} هدف فعال قابل محاسبه · میانگین
        اهداف با وزن برابر، KRها با وزن تعریف‌شده در هر هدف.
      </p>
      <Health d={d} />
    </>
  );
}
function Risks({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="attention"
      title="نیازمند توجه مدیریت"
      note="اولویت با شدت، سهم نتیجه، مهلت و تکرار شواهد است؛ هر مورد به محل تصمیم متصل است."
    >
      {!d.risks.length ? (
        <Blank>ریسک برجسته‌ای در داده موجود شناسایی نشده است.</Blank>
      ) : (
        <ol className="sd-risk-list">
          {d.risks.slice(0, 7).map((r, i) => (
            <li key={r.id}>
              <span className="sd-index">{number(i + 1)}</span>
              <div>
                <div className="sd-inline">
                  <span className={"sd-status " + r.severity}>
                    {severityLabels[r.severity]}
                  </span>
                  <Link href={r.destination}>
                    <strong>{r.title}</strong>
                  </Link>
                </div>
                <p>{r.description}</p>
                <small>{r.recommendedManagementAction}</small>
                <details>
                  <summary>شواهد و دلیل اولویت</summary>
                  <p>{r.evidence.join(" · ")}</p>
                  <p>{r.rankReasons.join(" · ")}</p>
                </details>
              </div>
              <Link
                className="sd-drill"
                href={r.destination}
                aria-label={"بررسی " + r.title}
              >
                ←
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
function MiniTrend({
  values,
}: {
  values: { weekNumber: number; progress: number | null }[];
}) {
  const known = values.filter((v) => v.progress !== null);
  if (known.length < 2) return <small>روند: داده کافی نیست</small>;
  const min = values[0].weekNumber,
    max = values.at(-1)!.weekNumber;
  return (
    <svg
      className="sd-spark"
      viewBox="0 0 110 34"
      role="img"
      aria-label="پیشرفت هدف در مرورهای ثبت‌شده"
    >
      {values.map((v, index) => {
        const previous = values[index - 1],
          x = (week: number) =>
            5 + (100 * (week - min)) / Math.max(1, max - min);
        return v.progress === null ? null : (
          <g key={v.weekNumber}>
            <circle
              cx={x(v.weekNumber)}
              cy={30 - v.progress * 0.26}
              r="2"
              fill="currentColor"
            />
            {previous?.progress != null &&
              previous.weekNumber === v.weekNumber - 1 && (
                <line
                  x1={x(previous.weekNumber)}
                  y1={30 - previous.progress * 0.26}
                  x2={x(v.weekNumber)}
                  y2={30 - v.progress * 0.26}
                  stroke="currentColor"
                  strokeWidth="2"
                />
              )}
          </g>
        );
      })}
    </svg>
  );
}
function Objectives({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="objectives"
      title="سلامت اهداف"
      note="نتیجه، اجرا و اطمینان را کنار هم بخوانید."
    >
      {!d.selectedRows.length ? (
        <Blank />
      ) : (
        d.selectedRows.map((o) => (
          <article className="sd-objective" key={o.objective.id}>
            <div className="sd-objective-title">
              <span className="sd-code">{o.objective.code}</span>
              <div>
                <Link href={o.destination}>
                  <h3>{o.objective.title}</h3>
                </Link>
                <small>
                  {o.priority?.title ?? "بدون اولویت معتبر"} ·{" "}
                  {o.owner?.title ?? "مالک نامشخص"} ·{" "}
                  {o.objective.status === "draft"
                    ? "پیش‌نویس"
                    : o.objective.status === "completed"
                      ? "پایان‌یافته"
                      : "فعال"}
                </small>
              </div>
              <span className={"sd-status " + o.health.health}>
                {objectiveHealthLabels[o.health.health]}
              </span>
            </div>
            <div className="sd-objective-data">
              <div>
                <span>
                  نتیجه <b>{pct(o.progress)}</b>
                </span>
                <Bar value={o.progress} />
              </div>
              <div>
                <span>
                  اجرا <b>{pct(o.execution.summary.execution)}</b>
                </span>
                <Bar value={o.execution.summary.execution} gold />
              </div>
              <div>
                اطمینان <b>{number(o.confidence, " / ۱۰")}</b>
                <small>
                  فاصله اجرا − نتیجه: {number(o.execution.gap, " واحد درصد")}
                </small>
              </div>
              <div>
                <small>مهلت: {dateLabel(o.objective.deadline)}</small>
                <MiniTrend values={o.trend} />
              </div>
            </div>
            <div className="sd-kr-mix">
              {Object.entries({ ...krStatuses, unknown: "نامشخص" }).map(
                ([key, label]) => {
                  const n = o.rows.filter(
                    (r) => (r.pacing.status ?? "unknown") === key,
                  ).length;
                  return n ? (
                    <span key={key}>
                      {label}: {number(n)}
                    </span>
                  ) : null;
                },
              )}
              {!o.krs.length && <span>بدون نتیجه کلیدی</span>}
            </div>
          </article>
        ))
      )}
    </Section>
  );
}
function Trend({ d }: { d: StrategyDashboard }) {
  const [metric, setMetric] = useState<"progress" | "confidence">("progress"),
    [selected, setSelected] = useState<string>("");
  const rows = d.trend,
    min = rows[0]?.weekNumber ?? 1,
    max = rows.at(-1)?.weekNumber ?? 1,
    get = (r: (typeof rows)[number]) =>
      metric === "progress" ? r.overallProgress : r.averageConfidence,
    x = (w: number) => 55 + ((w - min) / Math.max(1, max - min)) * 790,
    y = (v: number) => 185 - (v / (metric === "progress" ? 100 : 10)) * 155;
  const chosen = rows.find((r) => r.reviewId === selected) ?? rows.at(-1);
  return (
    <Section
      id="trend"
      title="روند استراتژی"
      note={d.momentum.label + " · " + d.momentum.reason}
    >
      <div className="sd-chart-controls">
        <span>آیا نتایج در مرورهای هفتگی حرکت می‌کنند؟</span>
        <div role="group" aria-label="معیار نمودار">
          <button
            type="button"
            aria-pressed={metric === "progress"}
            onClick={() => setMetric("progress")}
          >
            پیشرفت
          </button>
          <button
            type="button"
            aria-pressed={metric === "confidence"}
            onClick={() => setMetric("confidence")}
          >
            اطمینان
          </button>
        </div>
      </div>
      {!rows.length ? (
        <Blank>
          با ثبت مرورهای هفتگی، روند عملکرد در این بخش نمایش داده می‌شود.
        </Blank>
      ) : (
        <>
          <div
            className="sd-chart-scroll"
            tabIndex={0}
            role="region"
            aria-label="نمودار هفتگی؛ قابل پیمایش افقی"
          >
            <svg
              className="sd-chart"
              viewBox="0 0 900 235"
              role="img"
              aria-label={
                metric === "progress"
                  ? "روند پیشرفت واقعی در مرورهای هفتگی"
                  : "روند اطمینان در مرورهای هفتگی"
              }
            >
              {[0, 25, 50, 75, 100].map((n) => (
                <g key={n}>
                  <line
                    x1="55"
                    x2="845"
                    y1={185 - n * 1.55}
                    y2={185 - n * 1.55}
                    stroke="#e7e9e9"
                  />
                  <text x="30" y={190 - n * 1.55} textAnchor="middle">
                    {number(metric === "progress" ? n : n / 10)}
                  </text>
                </g>
              ))}
              {[...new Set(d.trendEvents.map((e) => e.weekNumber))]
                .filter((w) => w >= min && w <= max)
                .map((w) => (
                  <g key={"event-" + w}>
                    <line
                      x1={x(w)}
                      x2={x(w)}
                      y1="25"
                      y2="185"
                      stroke="#b49b61"
                      strokeDasharray="3 5"
                      opacity=".45"
                    />
                    <rect
                      x={x(w) - 4}
                      y="192"
                      width="8"
                      height="8"
                      fill="#b49b61"
                    >
                      <title>
                        {d.trendEvents
                          .filter((e) => e.weekNumber === w)
                          .map((e) => e.label + " · " + e.description)
                          .join("؛ ")}
                      </title>
                    </rect>
                  </g>
                ))}
              {rows.map((r, i) => {
                const v = get(r),
                  prev = rows[i - 1],
                  pv = prev ? get(prev) : null;
                return (
                  <g key={r.reviewId}>
                    {v !== null &&
                      pv !== null &&
                      prev &&
                      r.weekNumber === prev.weekNumber + 1 && (
                        <line
                          x1={x(prev.weekNumber)}
                          y1={y(pv)}
                          x2={x(r.weekNumber)}
                          y2={y(v)}
                          stroke="#183548"
                          strokeWidth="2.5"
                        />
                      )}
                    {v !== null && (
                      <circle
                        cx={x(r.weekNumber)}
                        cy={y(v)}
                        r="5"
                        fill="#b49b61"
                      >
                        <title>
                          {"هفته " + number(r.weekNumber) + " · " + number(v)}
                        </title>
                      </circle>
                    )}
                    <text x={x(r.weekNumber)} y="219" textAnchor="middle">
                      {number(r.weekNumber)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="sd-chart-controls">
            <small>
              محور افقی: هفته دوره · فقط مرورهای تکمیل‌شده؛ فاصله‌های بدون داده
              به هم وصل نمی‌شوند.
            </small>
            <label>
              جزئیات هفته{" "}
              <select
                value={chosen?.reviewId ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {rows.map((r) => (
                  <option key={r.reviewId} value={r.reviewId}>
                    هفته {number(r.weekNumber)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {chosen && (
            <div className="sd-trend-detail">
              <Link href={"/strategy/weekly-review/" + chosen.reviewId}>
                هفته {number(chosen.weekNumber)} ←
              </Link>
              <span>نتیجه {pct(chosen.overallProgress)}</span>
              <span>اطمینان {number(chosen.averageConfidence, " / ۱۰")}</span>
              <span>کیفیت مرور {pct(chosen.quality)}</span>
              {d.trendEvents
                .filter((e) => e.weekNumber === chosen.weekNumber)
                .map((e) => (
                  <Link key={e.id} href={e.destination}>
                    {e.label} · {e.description} ←
                  </Link>
                ))}
            </div>
          )}
          <details className="sd-disclosure">
            <summary>رویدادهای مهم کنار روند</summary>
            {d.changes.length === 0 && d.adapt.length === 0 ? (
              <Blank />
            ) : (
              <ul>
                {d.changes.map((c) => (
                  <li key={c.id}>
                    <Link href={changeDestination(d, c)}>
                      {dateLabel(tehranDay(c.changedAt))} ·{" "}
                      {changeField(c.fieldChanged)}: {changeValue(c.oldValue)} ←{" "}
                      {changeValue(c.newValue)}
                    </Link>{" "}
                    — {c.reason}
                  </li>
                ))}
                {d.adapt
                  .filter((a) => a.status === "completed")
                  .map((a) => (
                    <li key={a.id}>
                      <Link href={"/strategy/adapt/" + a.id}>
                        مرور تطبیقی · {dateLabel(a.periodEnd)}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </details>
        </>
      )}
    </Section>
  );
}
function KRs({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="kr-performance"
      title="عملکرد نتایج کلیدی"
      note="ترتیب: بیشترین ریسک. پیشرفت مورد انتظار زمانی، معیار خطی مقایسه است؛ پیش‌بینی نیست."
    >
      <dl className="sd-statline">
        <Stat label="KR فعال" value={number(d.performance.total)} />
        {Object.entries(d.performance.counts).map(([k, v]) => (
          <Stat key={k} label={status(k)} value={number(v)} />
        ))}
        <Stat
          label="به‌روز نشده / کهنه"
          value={number(d.freshness.stale.length)}
        />
        <Stat
          label="میانگین ساده KR"
          value={pct(d.performance.averageProgress)}
        />
        <Stat
          label="میانگین اهداف با وزن KR"
          value={pct(d.performance.weightedProgress)}
        />
      </dl>
      {!d.krRows.length ? (
        <Blank />
      ) : (
        <Table
          heads={[
            "نتیجه کلیدی / هدف",
            "مالک",
            "وزن",
            "فعلی / هدف",
            "پیشرفت",
            "پیشرفت مورد انتظار زمانی",
            "فاصله",
            "اطمینان",
            "وضعیت",
            "آخرین ثبت",
          ]}
        >
          {d.krRows.map((r) => (
            <tr key={r.kr.id}>
              <th>
                <Link href={r.destination}>
                  {r.kr.code} · {r.kr.title}
                </Link>
                <small>
                  {r.objective.code} · {r.objective.title}
                </small>
              </th>
              <td>{owner(d, r.kr.ownerRoleId)}</td>
              <td>{pct(r.weight)}</td>
              <td>
                {r.kr.type === "milestone" ? (
                  "مرحله‌ای"
                ) : (
                  <>
                    {number(r.kr.currentValue)} / {number(r.kr.targetValue)}{" "}
                    {r.kr.unit}
                  </>
                )}
              </td>
              <td>
                {pct(r.progress)}
                <Bar value={r.progress} />
              </td>
              <td>{pct(r.pacing.expected)}</td>
              <td>
                {number(
                  r.progress === null || r.pacing.expected === null
                    ? null
                    : r.progress - r.pacing.expected,
                  " واحد",
                )}
              </td>
              <td>{number(r.kr.confidence, " / ۱۰")}</td>
              <td>
                <span className={"sd-status " + r.pacing.status}>
                  {status(r.pacing.status)}
                </span>
              </td>
              <td>
                {r.kr.lastUpdateAt
                  ? dateLabel(tehranDay(r.kr.lastUpdateAt))
                  : "ثبت نشده"}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
function Execution({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="execution"
      title="اجرا در برابر نتیجه"
      note="درصد انجام کار، شاهد اثربخشی نیست؛ این مقایسه رابطه علت‌ومعلولی را اثبات نمی‌کند."
    >
      {!d.execution.length ? (
        <Blank />
      ) : (
        <div className="sd-pairs">
          {d.execution.map((o) => (
            <article key={o.id}>
              <Link href={o.destination}>
                <h3>{o.title}</h3>
              </Link>
              <div>
                <span>نتیجه {pct(o.result)}</span>
                <Bar value={o.result} />
              </div>
              <div>
                <span>اجرا {pct(o.execution)}</span>
                <Bar value={o.execution} gold />
              </div>
              <p>{o.interpretation}</p>
              <small>فاصله اجرا − نتیجه: {number(o.gap, " واحد درصد")}</small>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
function Confidence({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="confidence"
      title="اطمینان و ریسک"
      note={
        "میانگین " +
        number(d.confidence, " از ۱۰") +
        " · داده ناموجود از میانگین کنار گذاشته شده است."
      }
    >
      <div className="sd-distribution">
        {d.distribution.map((b) => (
          <div key={b.label}>
            <span>{b.label}</span>
            <b>{number(b.count)} KR</b>
            <Bar
              value={
                d.performance.total
                  ? (100 * b.count) / d.performance.total
                  : null
              }
            />
          </div>
        ))}
      </div>
      <div className="sd-columns">
        <div>
          <h3>نتایج با اطمینان پایین</h3>
          {d.krRows
            .filter((r) => r.kr.confidence !== null && r.kr.confidence <= 3)
            .map((r) => (
              <p key={r.kr.id}>
                <Link href={r.destination}>{r.kr.title}</Link> ·{" "}
                {number(r.kr.confidence, " / ۱۰")}
              </p>
            ))}
          {!d.krRows.some(
            (r) => r.kr.confidence !== null && r.kr.confidence <= 3,
          ) && (
            <Blank>اطمینان پایین ثبت‌شده‌ای در این انتخاب وجود ندارد.</Blank>
          )}
        </div>
        <div>
          <h3>بیشترین افت در سه مرور متوالی</h3>
          {!d.confidenceTrend.declines.length ? (
            <Blank>افت متوالی قابل استناد شناسایی نشده است.</Blank>
          ) : (
            d.confidenceTrend.declines.map((c) => (
              <p key={c.id}>
                <Link
                  href={
                    d.krRows.find((k) => k.kr.id === c.id)?.destination ??
                    "/strategy/key-results"
                  }
                >
                  {d.source.store.keyResults?.find((k) => k.id === c.id)?.title}
                </Link>{" "}
                · {number(c.from)} ← {number(c.to)}
              </p>
            ))
          )}
        </div>
      </div>
    </Section>
  );
}
function Initiatives({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="initiatives"
      title="اثربخشی اقدامات"
      note="اثر مورد انتظار و واقعی به‌صورت شواهد متنی خوانده می‌شوند؛ واحدهای متفاوت جمع نمی‌شوند."
    >
      <dl className="sd-statline">
        {(
          [
            ["فعال", d.portfolio.active],
            ["متوقف", d.portfolio.blocked],
            ["دیرکرد", d.portfolio.overdue],
            ["تکمیل‌شده", d.portfolio.completed],
            ["موثر", d.portfolio.effective],
            ["کم‌اثر / بی‌اثر", d.portfolio.weak],
            ["ارزیابی‌نشده", d.portfolio.unevaluated],
          ] as const
        ).map(([k, v]) => (
          <Stat key={k} label={k} value={number(v)} />
        ))}
      </dl>
      {!d.initiatives.length ? (
        <Blank />
      ) : (
        <Table
          heads={[
            "اقدام / KR",
            "پیشرفت",
            "اثربخشی",
            "اثر مورد انتظار",
            "اثر واقعی",
            "وضعیت",
            "مالک",
          ]}
        >
          {d.initiatives.map((i) => (
            <tr key={i.id}>
              <th>
                <Link href={"/strategy/initiatives/" + i.id}>
                  {i.code} · {i.title}
                </Link>
                <small>
                  {d.source.store.keyResults?.find(
                    (k) => k.id === i.keyResultId,
                  )?.title ?? "KR معتبر ندارد"}
                </small>
              </th>
              <td>{pct(i.progress)}</td>
              <td>{effectivenessLabels[i.effectiveness]}</td>
              <td>{i.expectedImpact || "ثبت نشده"}</td>
              <td>{i.actualImpact || "ثبت نشده"}</td>
              <td>{initiativeStatuses[i.status]}</td>
              <td>{owner(d, i.ownerRoleId)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
function Alignment({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="alignment"
      title="نقشه هم‌راستایی"
      note={
        "پوشش رابطه‌ها و مالکیت: " +
        pct(d.alignment.score) +
        " · جهت ← اولویت ← هدف ← نتیجه ← اقدام"
      }
    >
      <dl className="sd-statline">
        {d.alignment.parts.map((p) => (
          <Stat
            key={p.label}
            label={p.label}
            value={number(p.have) + " / " + number(p.total)}
          />
        ))}
      </dl>
      <div className="sd-tree">
        {d.selectedRows.map((o) => (
          <details key={o.objective.id} open={d.selectedRows.length < 4}>
            <summary>
              {o.priority?.customDirection ||
                (o.priority ? directions[o.priority.direction] : null) ||
                "جهت مشخص نشده"}{" "}
              / {o.priority?.title ?? "بدون اولویت"} — {o.objective.code} ·{" "}
              {o.objective.title}
            </summary>
            <ul>
              {o.krs.map((k) => (
                <li key={k.id}>
                  <Link href={o.destination + "#kr-" + k.id}>
                    {k.code} · {k.title}
                  </Link>
                  <ul>
                    {d.source.store.initiatives
                      ?.filter(
                        (i) =>
                          i.keyResultId === k.id && i.status !== "cancelled",
                      )
                      .map((i) => (
                        <li key={i.id}>
                          <Link href={"/strategy/initiatives/" + i.id}>
                            {i.title}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
            {!o.krs.length && <p>هدف بدون KR</p>}
          </details>
        ))}
      </div>
      <details className="sd-disclosure">
        <summary>شکاف‌های هم‌راستایی و مالکیت</summary>
        {d.alignment.priorityGaps.map((p) => (
          <p key={p.id}>
            <Link href={`/strategy/cycles/${d.cycle.id}/priorities`}>
              {p.title}
            </Link>{" "}
            · اولویت بدون هدف
          </p>
        ))}
        {d.alignment.ownerGaps.map((x) => (
          <p key={x.id}>{x.title} · مالک معتبر ندارد</p>
        ))}
        {d.alignment.initiativeGaps.map((i) => (
          <p key={i.id}>
            <Link href={"/strategy/initiatives/" + i.id}>{i.title}</Link> · KR
            معتبر ندارد
          </p>
        ))}
        {d.alignment.unassistedKRs.map((k) => (
          <p key={k.id}>
            {k.title} · اطمینان پایین بدون اقدام مرتبط؛ نیاز به اقدام را بررسی
            کنید.
          </p>
        ))}
        <p>
          نداشتن اقدام برای KR محقق‌شده یا غیر وابسته به اقدام، جریمه ندارد.
        </p>
      </details>
    </Section>
  );
}
function Blockers({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="blockers"
      title="موانع اصلی"
      note="مانع آخرین ثبت هر نتیجه؛ خالی شدن مانع در مرور بعدی، مانع قبلی را از این فهرست حذف می‌کند."
    >
      {!d.blockers.length ? (
        <Blank>مانع جاری ثبت‌شده‌ای وجود ندارد.</Blank>
      ) : (
        <Table
          heads={["مانع / موجودیت", "مالک", "تکرار", "آخرین شاهد", "وضعیت"]}
        >
          {d.blockers.map((b) => (
            <tr key={b.id}>
              <th>
                <Link href={b.destination}>{b.text}</Link>
                <small>{b.title}</small>
              </th>
              <td>{owner(d, b.ownerRoleId)}</td>
              <td>
                <span className={"sd-status " + (b.recurring ? "high" : "")}>
                  {number(b.count)} ثبت متوالی
                </span>
              </td>
              <td>{dateLabel(b.date)}</td>
              <td>{b.status}</td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  );
}
function Changes({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="changes"
      title="تصمیم‌ها و تغییرات مهم"
      note="تعداد تغییر به‌تنهایی نشانه ضعف استراتژی نیست؛ دلیل و شواهد تصمیم را بخوانید."
    >
      <dl className="sd-statline">
        <Stat label="تغییرات دوره" value={number(d.changes.length)} />
        <Stat label="تغییر هدف KR" value={number(d.changeSummary.krTargets)} />
        <Stat
          label="تغییر مهلت هدف"
          value={number(d.changeSummary.objectiveDeadlines)}
        />
        <Stat
          label="تغییر اقدام"
          value={number(d.changeSummary.initiativeChanges)}
        />
        <Stat
          label="تغییر اولویت"
          value={number(d.changeSummary.priorityChanges)}
        />
      </dl>
      {!d.decisions.length && !d.changes.length ? (
        <Blank />
      ) : (
        <>
          <ul className="sd-event-list">
            {d.decisions.slice(0, 8).map((c) => (
              <li key={c.id}>
                <time>{dateLabel(tehranDay(c.createdAt))}</time>
                <div>
                  <Link href={c.destination}>{c.title}</Link>
                  <p>{c.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <Table heads={["تاریخ", "موجودیت / تغییر", "قبل ← بعد", "دلیل"]}>
            {d.changes.map((c) => (
              <tr key={c.id}>
                <td>{dateLabel(tehranDay(c.changedAt))}</td>
                <th>
                  <Link href={changeDestination(d, c)}>
                    {d.source.store.keyResults?.find((k) => k.id === c.entityId)
                      ?.title ??
                      d.source.store.objectives.find((o) => o.id === c.entityId)
                        ?.title ??
                      d.source.store.initiatives?.find(
                        (i) => i.id === c.entityId,
                      )?.title ??
                      {
                        kr: "نتیجه",
                        objective: "هدف",
                        initiative: "اقدام",
                        cycle: "دوره",
                        priority: "اولویت",
                      }[c.entityType]}{" "}
                    · {changeField(c.fieldChanged)}
                  </Link>
                </th>
                <td>
                  {changeValue(c.oldValue)} ← {changeValue(c.newValue)}
                </td>
                <td>{c.reason}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
      {d.adapt.flatMap((r) =>
        r.resourceShifts.map((s) => (
          <p key={s.id}>
            <Link href={"/strategy/adapt/" + r.id}>
              جابجایی منابع: {s.fromArea} ← {s.toArea}
            </Link>{" "}
            · {s.description} — {s.rationale}
          </p>
        )),
      )}
    </Section>
  );
}
function Learning({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="learning"
      title="تطبیق، یادگیری و انضباط مرور"
      note="انضباط مدیریت، نتیجه استراتژی نیست."
    >
      <dl className="sd-statline">
        <Stat
          label="پوشش مرور هفتگی سررسیدشده"
          value={pct(d.discipline.weeklyRate)}
        />
        <Stat
          label="کیفیت میانگین مرور"
          value={pct(d.discipline.averageQuality)}
        />
        <Stat label="پوشش مرور تطبیقی" value={pct(d.discipline.adaptRate)} />
        <Stat label="درس‌های ثبت‌شده" value={number(d.learnings.length)} />
        <Stat
          label="فرض پشتیبانی‌شده"
          value={number(
            d.assumptions.filter((a) => a.status === "supported").length,
          )}
        />
        <Stat
          label="فرض در حال تضعیف"
          value={number(
            d.assumptions.filter((a) => a.status === "weakening").length,
          )}
        />
        <Stat
          label="فرض ردشده"
          value={number(
            d.assumptions.filter((a) => a.status === "invalidated").length,
          )}
        />
      </dl>
      <p>
        آخرین مرور هفتگی:{" "}
        {d.discipline.lastWeekly ? (
          <Link href={"/strategy/weekly-review/" + d.discipline.lastWeekly.id}>
            {dateLabel(d.discipline.lastWeekly.periodEnd)}
          </Link>
        ) : (
          "ثبت نشده"
        )}{" "}
        · آخرین تطبیق:{" "}
        {d.discipline.lastAdapt ? (
          <Link href={"/strategy/adapt/" + d.discipline.lastAdapt.id}>
            {dateLabel(d.discipline.lastAdapt.periodEnd)}
          </Link>
        ) : (
          "ثبت نشده"
        )}
      </p>
      <p>
        نتایج متوقف:{" "}
        {number(d.risks.filter((r) => r.type === "stalled").length)} · افت
        اطمینان: {number(d.confidenceTrend.declines.length)} · موانع تکراری:{" "}
        {number(d.blockers.filter((b) => b.recurring).length)} · تغییر اقدام:{" "}
        {number(d.changeSummary.initiativeChanges)} · جابجایی منابع:{" "}
        {number(d.adapt.reduce((n, r) => n + r.resourceShifts.length, 0))}
      </p>
      <ul>
        {d.learnings.map((l) => (
          <li key={l.id}>
            {l.statement}
            <small>{l.evidence}</small>
          </li>
        ))}
      </ul>
      <details className="sd-disclosure">
        <summary>آمادگی پایان دوره و شواهد یادگیری</summary>
        {d.discipline.cycleReadiness.length ? (
          d.discipline.cycleReadiness.map((x, i) => <p key={i}>{x}</p>)
        ) : (
          <p>موارد الزامی مرور پایان دوره تکمیل شده‌اند.</p>
        )}
        {d.assumptions.map((a) => (
          <p key={a.id}>
            {a.statement} — {a.evidence || "شاهد ثبت نشده"}
          </p>
        ))}
        <Link href={`/strategy/cycles/${d.cycle.id}/learn`}>
          مرور پایان دوره و یادگیری ←
        </Link>
      </details>
    </Section>
  );
}
function Quality({ d }: { d: StrategyDashboard }) {
  return (
    <Section
      id="quality"
      title="کامل بودن و تازگی داده"
      note="داده ناقص به معنای عملکرد ضعیف نیست؛ داده کامل هم لزوماً تازه نیست."
    >
      <div className="sd-columns">
        <div>
          <h3>کامل بودن داده · {pct(d.completeness.score)}</h3>
          {d.completeness.parts.map((p) => (
            <div className="sd-quality-row" key={p.label}>
              <span>{p.label}</span>
              <b>{pct(p.score)}</b>
            </div>
          ))}
        </div>
        <div>
          <h3>تازگی داده</h3>
          <p>
            {number(d.freshness.updatedThisWeek)} از {number(d.freshness.total)}{" "}
            KR در هفته جاری به‌روز شده
          </p>
          <p>
            {number(d.freshness.stale.length)} KR بدون ثبت یا کهنه‌تر از ۷ روز ·{" "}
            {number(d.freshness.neverUpdated)} بدون ثبت اولیه
          </p>
          <p>
            مرور هفتگی:{" "}
            {d.discipline.weeklyOverdue
              ? "عقب‌افتاده"
              : "سررسیدهای موجود پوشش داده شده"}{" "}
            · مرور تطبیقی:{" "}
            {d.discipline.adaptOverdue
              ? "عقب‌افتاده"
              : "عقب‌افتادگی شناسایی نشده"}
          </p>
          <Link
            href={`/strategy/weekly-review?cycle=${encodeURIComponent(d.cycle.id)}`}
          >
            ثبت و مرور داده ←
          </Link>
        </div>
      </div>
    </Section>
  );
}

const reports = [
  ["objectives", "عملکرد اهداف"],
  ["kr", "عملکرد نتایج کلیدی"],
  ["trend", "روند هفتگی"],
  ["confidence", "اطمینان"],
  ["initiatives", "اثربخشی اقدامات"],
  ["execution", "اجرا در برابر نتیجه"],
  ["alignment", "هم‌راستایی"],
  ["blockers", "موانع"],
  ["changes", "تغییرات استراتژیک"],
  ["learning", "یادگیری دوره"],
] as const;
export function StrategyDashboardPage({
  mode = "dashboard",
  initialCycle,
}: {
  mode?: "dashboard" | "reports" | "executive";
  initialCycle?: string;
}) {
  const { store, roles } = useStrategy(),
    router = useRouter(),
    pathname = usePathname(),
    [filters, setFilters] = useState<ReportFilters>({ cycleId: initialCycle }),
    [report, setReport] = useState("objectives");
  const today = todayTehran(),
    d = useMemo(
      () => getStrategyDashboard(store, roles, today, filters),
      [store, roles, today, filters],
    );
  const set = (key: keyof ReportFilters, value: string) =>
    setFilters((f) =>
      key === "cycleId"
        ? { cycleId: value, weeks: f.weeks }
        : { ...f, [key]: key === "weeks" ? Number(value) : value || undefined },
    );
  const body = d
    ? {
        objectives: <Objectives d={d} />,
        kr: <KRs d={d} />,
        trend: <Trend d={d} />,
        confidence: <Confidence d={d} />,
        initiatives: <Initiatives d={d} />,
        execution: <Execution d={d} />,
        alignment: <Alignment d={d} />,
        blockers: <Blockers d={d} />,
        changes: <Changes d={d} />,
        learning: <Learning d={d} />,
      }
    : null;
  return (
    <div
      className={
        "sd-dashboard " + (mode === "executive" ? "sd-presentation" : "")
      }
    >
      <div className="sd-toolbar">
        <div>
          <h1>
            {mode === "dashboard"
              ? "داشبورد استراتژی"
              : mode === "reports"
                ? "مرکز گزارش‌های استراتژی"
                : "گزارش اجرایی استراتژی"}
          </h1>
          <p>از شواهد تا تصمیم مدیریت</p>
        </div>
        <div className="sd-actions">
          <Link
            href={
              "/strategy/dashboard" +
              (d ? "?cycle=" + encodeURIComponent(d.cycle.id) : "")
            }
          >
            داشبورد
          </Link>
          <Link
            href={
              "/strategy/reports" +
              (d ? "?cycle=" + encodeURIComponent(d.cycle.id) : "")
            }
          >
            گزارش‌ها
          </Link>
          <Link
            href={
              "/strategy/reports/executive" +
              (d ? "?cycle=" + encodeURIComponent(d.cycle.id) : "")
            }
          >
            نمای ارائه
          </Link>
        </div>
      </div>
      <div className="sd-filters">
        <label>
          دوره استراتژیک
          <select
            value={d?.cycle.id ?? ""}
            onChange={(e) =>
              router.push(
                `${pathname}?cycle=${encodeURIComponent(e.target.value)}`,
                { scroll: false },
              )
            }
          >
            {store.cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {["completed", "archived"].includes(c.status) ? " · بسته" : ""}
              </option>
            ))}
          </select>
        </label>
        {mode !== "executive" && (
          <label>
            بازه روند
            <select
              value={filters.weeks ?? 13}
              onChange={(e) => set("weeks", e.target.value)}
            >
              <option value={13}>۱۳ هفته اخیر</option>
              <option value={26}>۲۶ هفته اخیر</option>
              <option value={1000}>همه مرورها</option>
            </select>
          </label>
        )}
        {mode === "reports" && d && (
          <>
            <label>
              گزارش
              <select
                value={report}
                onChange={(e) => {
                  setReport(e.target.value);
                  setFilters((f) => ({ cycleId: f.cycleId, weeks: f.weeks }));
                }}
              >
                {reports.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {[
              "objectives",
              "kr",
              "confidence",
              "initiatives",
              "execution",
              "alignment",
            ].includes(report) && (
              <>
                <label>
                  هدف
                  <select
                    value={filters.objectiveId ?? ""}
                    onChange={(e) => set("objectiveId", e.target.value)}
                  >
                    <option value="">همه اهداف</option>
                    {d.rows.map((o) => (
                      <option key={o.objective.id} value={o.objective.id}>
                        {o.objective.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  اولویت
                  <select
                    value={filters.priorityId ?? ""}
                    onChange={(e) => set("priorityId", e.target.value)}
                  >
                    <option value="">همه اولویت‌ها</option>
                    {d.source.store.priorities.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {["objectives", "kr", "initiatives"].includes(report) && (
              <label>
                مالک
                <select
                  value={filters.ownerRoleId ?? ""}
                  onChange={(e) => set("ownerRoleId", e.target.value)}
                >
                  <option value="">همه مالکان</option>
                  {d.source.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {report === "kr" && (
              <label>
                وضعیت KR
                <select
                  value={filters.krStatus ?? ""}
                  onChange={(e) => set("krStatus", e.target.value)}
                >
                  <option value="">همه وضعیت‌ها</option>
                  {Object.entries({ ...krStatuses, unknown: "نامشخص" }).map(
                    ([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
            {report === "initiatives" && (
              <label>
                وضعیت اقدام
                <select
                  value={filters.initiativeStatus ?? ""}
                  onChange={(e) => set("initiativeStatus", e.target.value)}
                >
                  <option value="">همه وضعیت‌ها</option>
                  {Object.entries(initiativeStatuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>
      {!d ? (
        <Blank>
          هنوز دوره استراتژیک وجود ندارد.{" "}
          <Link href="/strategy/cycles">تعریف دوره ←</Link>
        </Blank>
      ) : mode === "reports" ? (
        <>
          <p className="sd-provenance">
            {d.cycle.name} · {d.source.historySource} · اعداد خلاصه مربوط به کل
            دوره‌اند؛ فیلترها ردیف‌های گزارش را محدود می‌کنند.
          </p>
          {body?.[report as keyof typeof body]}
          <Quality d={d} />
        </>
      ) : (
        <>
          <ExecutiveHeader d={d} />
          <Risks d={d} />
          <Objectives d={d} />
          <Trend d={d} />
          {mode === "executive" ? (
            <>
              <Execution d={d} />
              <Changes d={d} />
              <footer className="sd-summary">
                تصمیم بعدی:{" "}
                {d.focus?.recommendedManagementAction ??
                  "پوشش داده و ریتم مرور دوره را حفظ کنید."}
              </footer>
            </>
          ) : (
            <>
              <details className="sd-disclosure" open>
                <summary>نتایج کلیدی و شکاف اجرا</summary>
                <KRs d={d} />
                <Execution d={d} />
                <Confidence d={d} />
              </details>
              <details className="sd-disclosure">
                <summary>سبد اقدامات و نقشه هم‌راستایی</summary>
                <Initiatives d={d} />
                <Alignment d={d} />
              </details>
              <details className="sd-disclosure">
                <summary>موانع، تصمیم‌ها و تغییرات</summary>
                <Blockers d={d} />
                <Changes d={d} />
              </details>
              <details className="sd-disclosure">
                <summary>یادگیری و کیفیت داده</summary>
                <Learning d={d} />
                <Quality d={d} />
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
