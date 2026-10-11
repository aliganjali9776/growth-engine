"use client";
import { AdvisorEntry } from "@/components/advisor/entry";
import { reviewDate as tehranDay } from "@/lib/strategy/adapt/definition";
import { InitiativeSummary } from "./initiative-summary";
import { WeeklyLanding, ObjectiveWeeklyHistory } from "./weekly-history";
import { AdaptLanding, ChangeHistory } from "./adapt-workspace";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel, PageTitle, Empty } from "@/components/system/ui";
import { useStrategy } from "./provider";
import {
  ObjectiveMeasurement,
  StrategyMeasurementSummary,
  MeasurementAttention,
} from "./kr-views";
import {
  CycleEditor,
  ContextEditor,
  PriorityEditor,
  ChoiceEditor,
  ObjectiveEditor,
} from "./editors";
import {
  cycleStatuses,
  cycleTypes,
  contextLabels,
  dateLabel,
  directions,
  emptyContext,
  objectiveStatuses,
  priorityStatuses,
  reorderPriority,
  roleName,
  todayTehran,
  type StrategyCycle,
  type StrategicPriority,
  type StrategicChoice,
  type StrategyObjective,
} from "@/lib/strategy/model";
import { objectiveQuality, strategyReport } from "@/lib/strategy/report";
const num = (n: number) => n.toLocaleString("fa-IR");
function Readiness({ report }: { report: ReturnType<typeof strategyReport> }) {
  return (
    <Panel
      title="آمادگی طراحی استراتژی"
      caption="کامل‌بودن ساختار تصمیم‌گیری؛ این امتیاز عملکرد یا سلامت استراتژی نیست."
    >
      <div className="st-readiness">
        <strong>
          {num(report.score)}
          <small> / ۱۰۰</small>
        </strong>
        <span>{report.label}</span>
      </div>
      <details>
        <summary>مشاهده اجزای امتیاز</summary>
        <ul className="st-breakdown">
          {report.parts.map((p) => (
            <li key={p.label}>
              <span>{p.label}</span>
              <span>
                {num(Math.round(p.value * 10) / 10)} از {num(p.weight)}
              </span>
            </li>
          ))}
        </ul>
        <p>
          زمینه بر اساس ۶ فیلد، اولویت و هدف تا ۳ مورد، مالکیت و هم‌راستایی به
          نسبت پوشش محاسبه می‌شوند. نبود داده امتیاز آمادگی نمی‌گیرد.
        </p>
      </details>
    </Panel>
  );
}
function Attention({ report }: { report: ReturnType<typeof strategyReport> }) {
  const [all, set] = useState(false);
  return (
    <Panel
      title="نیازمند توجه"
      caption="یافته‌های توضیح‌پذیر از داده‌های همین دوره"
    >
      {!report.findings.length ? (
        <Empty>
          ساختار دوره در بررسی‌های فعلی هشدار ندارد؛ این به معنی موفقیت اجرایی
          نیست.
        </Empty>
      ) : (
        <>
          <ul className="st-findings">
            {report.findings.slice(0, all ? undefined : 5).map((f) => (
              <li key={f.id}>
                <Link href={f.href}>{f.text}</Link>
              </li>
            ))}
          </ul>
          {report.findings.length > 5 && (
            <Button secondary onClick={() => set(!all)}>
              {all
                ? "نمایش کمتر"
                : `نمایش همه ${num(report.findings.length)} مورد`}
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
function Evidence() {
  const { evidence } = useStrategy();
  const names = { system: "سیستم", strategy: "استراتژی", scale: "مقیاس" };
  return (
    <Panel
      title="شواهد ارزیابی 3S"
      caption="ورودی تصمیم‌گیری مدیریت؛ نتیجه ارزیابی به‌صورت خودکار به اولویت تبدیل نمی‌شود."
    >
      {evidence ? (
        <>
          <div className="st-metrics">
            {Object.entries(evidence).map(([k, v]) => (
              <div key={k}>
                <span>{names[k as keyof typeof names]}</span>
                <strong>{num(Math.round(v))}</strong>
              </div>
            ))}
          </div>
          <p>
            کمترین امتیاز:{" "}
            {Object.entries(evidence)
              .filter(([, v]) => v === Math.min(...Object.values(evidence)))
              .map(([k]) => names[k as keyof typeof names])
              .join("، ")}
            . انتخاب مسیر همچنان بر عهده مدیریت است.
          </p>
        </>
      ) : (
        <p>
          ارزیابی تکمیل‌شده‌ای در این مرورگر موجود نیست.{" "}
          <Link href="/assessment">رفتن به ارزیابی 3S</Link>
        </p>
      )}
    </Panel>
  );
}
function Alignment({ report }: { report: ReturnType<typeof strategyReport> }) {
  return (
    <Panel
      title="نقشه هم‌راستایی"
      caption="جهت‌گیری ← اولویت استراتژیک ← هدف کیفی"
    >
      <div className="st-alignment">
        {report.priorities.map((p) => (
          <section key={p.id}>
            <small>
              {p.direction === "custom"
                ? p.customDirection
                : directions[p.direction]}
            </small>
            <h3>
              {num(p.rank)}. {p.title}{" "}
              <span className="st-tag">{priorityStatuses[p.status]}</span>
            </h3>
            <ul>
              {report.objectives
                .filter((o) => o.relatedPriorityId === p.id)
                .map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/strategy/cycles/${o.cycleId}/objectives/${o.id}`}
                    >
                      {o.code} · {o.title}
                    </Link>
                  </li>
                ))}
            </ul>
            {!report.objectives.some((o) => o.relatedPriorityId === p.id) && (
              <p className="st-muted">هدف مرتبطی تعریف نشده است.</p>
            )}
          </section>
        ))}
      </div>
      {!report.priorities.length && (
        <Empty>
          پس از انتخاب اولویت و تعریف هدف، ارتباط آن‌ها اینجا نمایش داده می‌شود.
        </Empty>
      )}
      {report.objectives
        .filter((o) => !o.relatedPriorityId)
        .map((o) => (
          <p className="st-notice" key={o.id}>
            {o.title}: بدون اولویت مرتبط
          </p>
        ))}
    </Panel>
  );
}
export function StrategyWorkspace({
  mode = "home",
  cycleId,
  objectiveId,
}: {
  mode?:
    "home" | "cycles" | "cycle" | "priorities" | "objectives" | "objective";
  cycleId?: string;
  objectiveId?: string;
}) {
  const { store, roles, commit } = useStrategy(),
    report = strategyReport(store, roles, cycleId, todayTehran()),
    cycle = report.cycle;
  const [editCycle, setCycle] = useState<StrategyCycle | null>(null),
    [editContext, setContext] = useState(false),
    [editPriority, setPriority] = useState<StrategicPriority | null>(null),
    [editChoice, setChoice] = useState<StrategicChoice | null>(null),
    [editObjective, setObjective] = useState<StrategyObjective | null>(null),
    [error, setError] = useState("");
  function run(action: () => void) {
    try {
      action();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره انجام نشد.");
    }
  }
  function newCycle() {
    const now = new Date().toISOString(),
      today = todayTehran();
    setCycle({
      id: crypto.randomUUID(),
      name: "",
      description: "",
      startDate: today,
      endDate: today,
      status: "draft",
      cycleType: "custom",
      ownerRoleId: "",
      strategicTheme: "",
      createdAt: now,
      updatedAt: now,
    });
  }
  function newPriority() {
    if (!cycle) return;
    const now = new Date().toISOString();
    setPriority({
      id: crypto.randomUUID(),
      cycleId: cycle.id,
      title: "",
      description: "",
      direction: "revenue",
      customDirection: "",
      ownerRoleId: "",
      rank: Math.max(0, ...report.priorities.map((p) => p.rank)) + 1,
      rationale: "",
      successDefinition: "",
      status: "proposed",
      createdAt: now,
      updatedAt: now,
    });
  }
  function newChoice(type: StrategicChoice["type"]) {
    if (cycle)
      setChoice({
        id: crypto.randomUUID(),
        cycleId: cycle.id,
        type,
        statement: "",
        rationale: "",
        createdAt: new Date().toISOString(),
      });
  }
  function newObjective() {
    if (!cycle) return;
    const now = new Date().toISOString();
    let n = 1;
    while (
      store.objectives.some((o) => o.cycleId === cycle.id && o.code === `O${n}`)
    )
      n++;
    setObjective({
      id: crypto.randomUUID(),
      cycleId: cycle.id,
      code: `O${n}`,
      title: "",
      description: "",
      ownerRoleId: "",
      relatedPriorityId: "",
      status: "draft",
      startDate: cycle.startDate,
      deadline: cycle.endDate,
      createdAt: now,
      updatedAt: now,
    });
  }
  const base = cycle ? `/strategy/cycles/${cycle.id}` : "/strategy/cycles";
  if (cycleId && !cycle)
    return (
      <Panel title="دوره پیدا نشد">
        <p>دوره موردنظر در داده‌های این مرورگر وجود ندارد.</p>
        <Link href="/strategy/cycles">بازگشت به دوره‌ها</Link>
      </Panel>
    );
  const opened = store.objectives.find(
    (o) => o.id === objectiveId && o.cycleId === cycleId,
  );
  if (mode === "objective" && !opened)
    return (
      <Panel title="هدف پیدا نشد">
        <Link href={base + "/objectives"}>بازگشت به اهداف</Link>
      </Panel>
    );
  const priorityCards = (
    <div className="st-cards">
      {report.priorities.map((p, i) => (
        <article key={p.id} className="st-card">
          <div className="st-card-top">
            <span className="st-rank">{num(p.rank)}</span>
            <span className="st-tag">{priorityStatuses[p.status]}</span>
          </div>
          <small>
            {p.direction === "custom"
              ? p.customDirection
              : directions[p.direction]}
          </small>
          <h3>{p.title}</h3>
          <p>{p.rationale || "دلیل انتخاب هنوز نوشته نشده است."}</p>
          <p className="st-muted">
            موفقیت: {p.successDefinition || "تعریف نشده"}
          </p>
          <small>{roleName(p.ownerRoleId, roles)}</small>
          <div className="st-actions">
            <Button secondary onClick={() => setPriority(p)}>
              ویرایش {p.title}
            </Button>
            <button
              disabled={i === 0}
              aria-label={`بالا بردن ${p.title}`}
              onClick={() =>
                run(() => commit(reorderPriority(store, p.id, -1)))
              }
            >
              ↑
            </button>
            <button
              disabled={i === report.priorities.length - 1}
              aria-label={`پایین بردن ${p.title}`}
              onClick={() => run(() => commit(reorderPriority(store, p.id, 1)))}
            >
              ↓
            </button>
          </div>
        </article>
      ))}
    </div>
  );
  const objectiveCards = (
    <div className="st-cards">
      {store.objectives
        .filter(
          (o) =>
            o.cycleId === cycle?.id &&
            (mode !== "objective" || o.id === objectiveId),
        )
        .map((o) => {
          const q = objectiveQuality(o, cycle!, store, roles),
            p = store.priorities.find((p) => p.id === o.relatedPriorityId);
          return (
            <article className="st-card" key={o.id}>
              <div className="st-card-top">
                <b>{o.code}</b>
                <span className="st-tag">{objectiveStatuses[o.status]}</span>
              </div>
              <h3>
                <Link href={`${base}/objectives/${o.id}`}>{o.title}</Link>
              </h3>
              <p>{o.description}</p>
              <dl>
                <dt>مالک</dt>
                <dd>{roleName(o.ownerRoleId, roles)}</dd>
                <dt>اولویت مرتبط</dt>
                <dd>
                  {p?.title ?? "این هدف به هیچ اولویت استراتژیک متصل نیست."}
                </dd>
                <dt>مهلت</dt>
                <dd>{dateLabel(o.deadline)}</dd>
              </dl>
              {mode !== "objective" && (
                <ObjectiveMeasurement objective={o} compact />
              )}
              <details open={mode === "objective"}>
                <summary>کیفیت نگارش: {q.label}</summary>
                <ul>
                  {q.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <small>بررسی با قواعد ساده؛ بدون هوش مصنوعی</small>
              </details>
              <div className="st-actions">
                <Button secondary onClick={() => setObjective(o)}>
                  ویرایش {o.code}
                </Button>
                <Link href={`${base}/objectives/${o.id}`}>باز کردن هدف</Link>
              </div>
            </article>
          );
        })}
    </div>
  );
  return (
    <>
      {error && (
        <p className="st-notice" role="alert">
          {error}
        </p>
      )}
      {mode === "cycles" ? (
        <>
          <PageTitle
            title="دوره‌های استراتژیک"
            description="دوره‌های سه‌ماهه، چهارماهه، سالانه یا متناسب با ریتم کسب‌وکار"
            onAdd={newCycle}
            addLabel="ایجاد دوره"
          />
          <div className="st-cards">
            {store.cycles.map((c) => (
              <article className="st-card" key={c.id}>
                <span className="st-tag">
                  {cycleStatuses[c.status]} · {cycleTypes[c.cycleType]}
                </span>
                <h3>
                  <Link href={`/strategy/cycles/${c.id}`}>{c.name}</Link>
                </h3>
                <p>
                  {dateLabel(c.startDate)} تا {dateLabel(c.endDate)}
                </p>
                <p>{c.strategicTheme}</p>
                <small>{roleName(c.ownerRoleId, roles)}</small>
                {c.closedAt && (
                  <p>ثبت بسته‌شدن: {dateLabel(tehranDay(c.closedAt))}</p>
                )}
                <div className="st-actions">
                  <Link href={`/strategy/cycles/${c.id}`}>
                    باز کردن فضای دوره
                  </Link>
                  <Button secondary onClick={() => setCycle(c)}>
                    ویرایش دوره
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {!store.cycles.length && (
            <Empty>دوره‌ای ندارید؛ اولین دوره را ایجاد کنید.</Empty>
          )}
        </>
      ) : null}
      {mode === "home" && (
        <>
          <section className="st-hero">
            <div>
              <span>DIAGNOSE → CHOOSE → SET</span>
              <h2>{cycle?.name ?? "مسیر رشد بعدی را مشخص کنید"}</h2>
              <p>
                {cycle?.strategicTheme ||
                  "از تشخیص وضعیت تا انتخاب‌های روشن و اهداف هم‌راستا"}
              </p>
              <div className="st-actions">
                <Link className="st-hero-link" href={base}>
                  {cycle ? "ادامه طراحی دوره" : "ایجاد اولین دوره"}
                </Link>
                <Link href="/strategy/cycles">همه دوره‌ها</Link>
              </div>
            </div>
            <div className="st-hero-focus">
              <small>اولویت شماره یک</small>
              <h3>
                {report.selected.find((p) => p.rank === 1)?.title ??
                  "هنوز انتخاب نشده"}
              </h3>
              <p>
                {report.choices.find((c) => c.type === "focus")?.statement ??
                  "تمرکز دوره را روشن کنید."}
              </p>
            </div>
          </section>
          <div className="st-metrics">
            {[
              ["اولویت منتخب", report.selected.length],
              ["هدف فعال", report.active.length],
              ["هدف خارج از تمرکز", report.unaligned],
              ["روز باقی‌مانده", report.days ?? "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {typeof value === "number" ? num(value) : value}
                </strong>
              </div>
            ))}
          </div>
          <div className="st-grid">
            <Readiness report={report} />
            <Attention report={report} />
          </div>
          <StrategyMeasurementSummary />
          <WeeklyLanding />
          {cycle && <AdaptLanding cycleId={cycle.id} />}
          <InitiativeSummary />
          <Evidence />
          <Alignment report={report} />
        </>
      )}
      {mode === "cycle" && cycle && (
        <>
          <PageTitle
            title={cycle.name}
            description={`${dateLabel(cycle.startDate)} تا ${dateLabel(cycle.endDate)} · ${cycleStatuses[cycle.status]}`}
            onAdd={() => setCycle(cycle)}
            addLabel="ویرایش دوره"
          />
          <div className="st-steps">
            <a href="#strategy-context">۱. تشخیص وضعیت</a>
            <Link href={base + "/priorities"}>۲. انتخاب اولویت</Link>
            <a href="#strategy-choices">۳. تعیین مرز تمرکز</a>
            <Link href={base + "/objectives"}>۴. تعریف هدف</Link>
          </div>
          <p>{cycle.description}</p>
          <p>
            مضمون: {cycle.strategicTheme || "تعیین نشده"} · مالک:{" "}
            {roleName(cycle.ownerRoleId, roles)}
          </p>
          <div id="strategy-context">
            <Panel
              title="زمینه استراتژی"
              action={
                <Button secondary onClick={() => setContext(true)}>
                  ویرایش زمینه
                </Button>
              }
            >
              <div className="st-context">
                {Object.entries(contextLabels).map(([key, label]) => (
                  <div key={key}>
                    <h3>{label}</h3>
                    <p>
                      {report.context?.[key as keyof typeof contextLabels] ||
                        "هنوز مشخص نشده"}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Evidence />
          <Panel
            title="اولویت‌های استراتژیک"
            action={<Link href={base + "/priorities"}>انتخاب و رتبه‌بندی</Link>}
          >
            {report.selected.map((p) => (
              <p key={p.id}>
                {num(p.rank)}. {p.title}
              </p>
            ))}
            {!report.selected.length && (
              <Empty>اولویت منتخبی ثبت نشده است.</Empty>
            )}
          </Panel>
          <div id="strategy-choices">
            <Panel
              title="انتخاب‌های استراتژیک"
              caption="تصمیم آگاهانه درباره تمرکز و موضوعاتی که در این دوره دنبال نمی‌کنیم."
            >
              <div className="st-grid">
                {(["focus", "notNow"] as const).map((type) => (
                  <section className="st-choice" key={type}>
                    <h3>
                      {type === "focus"
                        ? "روی این موضوع تمرکز می‌کنیم"
                        : "فعلاً انجام نمی‌دهیم"}
                    </h3>
                    {report.choices
                      .filter((c) => c.type === type)
                      .map((c) => (
                        <article key={c.id}>
                          <p>{c.statement}</p>
                          <small>{c.rationale}</small>
                          <Button secondary onClick={() => setChoice(c)}>
                            ویرایش انتخاب
                          </Button>
                        </article>
                      ))}
                    <Button secondary onClick={() => newChoice(type)}>
                      {type === "focus" ? "افزودن تمرکز" : "افزودن فعلاً نه"}
                    </Button>
                  </section>
                ))}
              </div>
            </Panel>
          </div>
          <Panel
            title="اهداف دوره"
            action={
              <Link href={base + "/objectives"}>تعریف و بررسی اهداف</Link>
            }
          >
            {report.objectives.map((o) => (
              <p key={o.id}>
                <Link href={`${base}/objectives/${o.id}`}>
                  {o.code} · {o.title}
                </Link>
              </p>
            ))}
            {!report.objectives.length && (
              <Empty>هدف کیفی دوره را تعریف کنید.</Empty>
            )}
          </Panel>
          <div className="st-grid">
            <Readiness report={report} />
            <Attention report={report} />
          </div>
          <InitiativeSummary cycleId={cycle.id} />
          <Alignment report={report} />
        </>
      )}
      {mode === "priorities" && cycle && (
        <>
          <PageTitle
            title="اولویت‌های استراتژیک"
            description={`${cycle.name} · پیشنهاد: ۳ تا ۵ اولویت اصلی؛ رتبه‌های پایین‌تر اولویت بالاتری دارند.`}
            onAdd={
              ["completed", "archived"].includes(cycle.status)
                ? undefined
                : newPriority
            }
            addLabel="افزودن اولویت"
          />
          {report.selected.length > 5 && (
            <p role="status" className="st-notice">
              تعداد زیاد اولویت‌ها تمرکز استراتژی را کاهش می‌دهد.
            </p>
          )}
          {priorityCards}
          {!report.priorities.length && (
            <Empty>اولین اولویت را با دلیل «چرا اکنون؟» ثبت کنید.</Empty>
          )}
          <Alignment report={report} />
        </>
      )}
      {(mode === "objectives" || mode === "objective") && cycle && (
        <>
          <PageTitle
            title={mode === "objective" ? "شناسنامه هدف" : "اهداف کیفی دوره"}
            description={`${cycle.name} · تغییر مطلوب در هدف؛ شاهد قابل اندازه‌گیری در نتیجه کلیدی`}
            onAdd={
              ["completed", "archived"].includes(cycle.status)
                ? undefined
                : newObjective
            }
            addLabel="افزودن هدف"
          />
          {report.objectives.length > 5 && (
            <p className="st-notice">
              تعداد اهداف بیش از ۵ است؛ تمرکز دوره را بازبینی کنید.
            </p>
          )}
          {objectiveCards}
          {mode === "objective" && opened && (
            <>
              <AdvisorEntry type="objective" id={opened.id} />
              <ObjectiveMeasurement objective={opened} />
              <ObjectiveWeeklyHistory objectiveId={opened.id} />
              <ChangeHistory entityId={opened.id} />
              <InitiativeSummary cycleId={cycle.id} objectiveId={opened.id} />
            </>
          )}
          <MeasurementAttention
            cycleId={cycle.id}
            objectiveId={mode === "objective" ? objectiveId : undefined}
          />
          {!store.objectives.some((o) => o.cycleId === cycle.id) && (
            <Empty>هنوز هدفی تعریف نشده است.</Empty>
          )}
          <Attention report={report} />
          <Alignment report={report} />
        </>
      )}
      {editCycle && (
        <CycleEditor initial={editCycle} onClose={() => setCycle(null)} />
      )}
      {editContext && cycle && (
        <ContextEditor
          initial={report.context ?? emptyContext(cycle.id)}
          onClose={() => setContext(false)}
        />
      )}
      {editPriority && (
        <PriorityEditor
          initial={editPriority}
          onClose={() => setPriority(null)}
        />
      )}
      {editChoice && (
        <ChoiceEditor initial={editChoice} onClose={() => setChoice(null)} />
      )}
      {editObjective && cycle && (
        <ObjectiveEditor
          initial={editObjective}
          cycle={cycle}
          onClose={() => setObjective(null)}
        />
      )}
    </>
  );
}
