"use client";
import { AdvisorEntry } from "@/components/advisor/entry";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Panel, PageTitle } from "@/components/system/ui";
import { useScale } from "./provider";
import { FunnelEntityContext } from "./funnel";
import { NetworkEntityContext } from "./network-shared";
import { ReadinessEntry } from "./readiness-shared";
import { Text, Select, Numeric, fa } from "./shared";
import * as E from "@/lib/scale/experiments/model";
import * as L from "@/lib/scale/experiments/logic";
import {
  transitionExperiment,
  iterateExperiment,
  saveExecutionNotes,
  convertIdea,
} from "@/lib/scale/experiments/mutations";
import { ExperimentEditor, MetricEditor } from "./experiment-editor";
import { Measurements } from "./experiment-measurements";
import {
  CompletionEditor,
  CapacityContext,
  IdeaDecision,
} from "./experiment-review";
export function ExperimentLinks({
  ideaId,
  constraintId,
  leverId,
}: {
  ideaId?: string;
  constraintId?: string;
  leverId?: string;
}) {
  const { store } = useScale(),
    d = E.experimentData(store),
    list = d.experiments.filter(
      (e) =>
        (!ideaId || e.ideaId === ideaId) &&
        (!constraintId || e.constraintId === constraintId) &&
        (!leverId || e.leverId === leverId),
    );
  return (
    <Panel title="آزمایش‌ها و شواهد یادگیری">
      <p>
        {fa(list.length)} آزمایش مرتبط؛ نتایج، اثبات علت یا رتبه قطعی اهرم
        نیستند.
      </p>
      {Object.entries(E.results).map(([k, label]) => (
        <span className="scale-result-count" key={k}>
          {label}:{" "}
          {fa(
            list.filter((e) => e.status === "completed" && e.resultStatus === k)
              .length,
          )}{" "}
          ·{" "}
        </span>
      ))}
      {list.map((e) => (
        <p key={e.id}>
          <Link href={`/scale/experiments/${e.id}`}>
            {e.code} · {e.title}
          </Link>{" "}
          · {E.statuses[e.status]}{" "}
          {e.resultStatus ? "· " + E.results[e.resultStatus] : ""}{" "}
          {d.decisions.find((x) => x.experimentId === e.id)
            ? "· " +
              E.decisions[
                d.decisions.find((x) => x.experimentId === e.id)!.decision
              ]
            : ""}
        </p>
      ))}
      {d.learnings
        .filter((l) => list.some((e) => e.id === l.experimentId))
        .slice(-3)
        .map((l) => (
          <blockquote key={l.id}>
            {l.statement}{" "}
            <Link href={`/scale/experiments/${l.experimentId}`}>شواهد ←</Link>
          </blockquote>
        ))}
    </Panel>
  );
}
export function ConvertIdeaButton({ ideaId }: { ideaId: string }) {
  const { store, commit } = useScale(),
    router = useRouter(),
    [error, setError] = useState("");
  return (
    <>
      <Button
        onClick={() => {
          try {
            const result = convertIdea(store, ideaId);
            commit(result.store);
            router.push(`/scale/experiments/${result.experiment.id}`);
          } catch (x) {
            setError(String(x));
          }
        }}
      >
        تبدیل به آزمایش
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function GrowthLab() {
  const { store, sources } = useScale(),
    d = E.experimentData(store),
    summary = L.experimentPortfolioSummary(store),
    attention = L.experimentNeedsAttention(
      store,
      sources.capacity.some((p) => p.risk),
    );
  return (
    <Panel
      title="آزمایشگاه رشد"
      caption="حجم آزمایش یا تعداد موفقیت، به‌تنهایی معیار رشد بهتر نیست."
    >
      <div className="scale-tags">
        <span>
          آماده اجرا:{" "}
          {fa(d.experiments.filter((e) => e.status === "ready").length)}
        </span>
        <span>
          در حال اجرا:{" "}
          {fa(d.experiments.filter((e) => e.status === "running").length)}
        </span>
        <span>تکمیل‌شده: {fa(summary.completed)}</span>
        <span>
          ایده تأییدشده:{" "}
          {fa(store.ideas.filter((i) => i.status === "validated").length)}
        </span>
        <span>
          تصمیم مقیاس‌دهی:{" "}
          {fa(d.decisions.filter((x) => x.decision === "scale").length)}
        </span>
      </div>
      {d.experiments
        .filter((e) => e.status === "completed")
        .sort((a, b) =>
          (a.completedAt ?? "").localeCompare(b.completedAt ?? ""),
        )
        .slice(-1)
        .map((e) => (
          <p key={e.id}>
            آخرین نتیجه:{" "}
            <Link href={`/scale/experiments/${e.id}`}>
              {e.title} · {E.results[e.resultStatus!]}
            </Link>
          </p>
        ))}
      {d.learnings.slice(-3).map((l) => (
        <p key={l.id}>{l.statement}</p>
      ))}
      <ul>
        {attention.map((x, i) => (
          <li key={i}>
            <Link href={x.href}>{x.text}</Link>
          </li>
        ))}
      </ul>
      <Link href="/scale/experiments">بررسی آزمایش‌ها ←</Link>
    </Panel>
  );
}
export function Experiments({ id }: { id?: string }) {
  const { store, sources, commit } = useScale(),
    router = useRouter(),
    d = E.experimentData(store),
    [edit, setEdit] = useState<E.GrowthExperiment | null>(null),
    [metricOpen, setMetricOpen] = useState(false),
    [complete, setComplete] = useState(false),
    [error, setError] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [stale, setStale] = useState<number | null>(d.staleDays);
  const e = d.experiments.find((e) => e.id === id);
  function action(fn: () => void) {
    try {
      fn();
      setError("");
    } catch (x) {
      setError(x instanceof Error ? x.message : "ثبت نشد");
    }
  }
  if (id && !e)
    return (
      <Panel title="آزمایش پیدا نشد">
        <Link href="/scale/experiments">بازگشت به آزمایش‌ها</Link>
      </Panel>
    );
  const metric = e ? L.metricFor(store, e) : null,
    readiness = e ? L.experimentReadiness(store, e) : null,
    quality = e ? L.experimentQuality(store, e) : null,
    time = e ? L.experimentProgressTime(e) : null,
    decision = e ? d.decisions.find((x) => x.experimentId === e.id) : null,
    learning = e ? d.learnings.find((x) => x.experimentId === e.id) : null;
  const list = d.experiments.filter((e) =>
    Object.entries(filters).every(
      ([k, v]) =>
        !v ||
        (k === "decision"
          ? d.decisions.find((x) => x.experimentId === e.id)?.decision
          : e[k as keyof E.GrowthExperiment]) === v,
    ),
  );
  const summary = L.experimentPortfolioSummary(store);
  return (
    <>
      <PageTitle
        title={e ? `${e.code} · ${e.title}` : "آزمایش‌های رشد"}
        description="فرضیه، مشاهده، یادگیری و تصمیم؛ تکمیل آزمایش به معنی موفقیت نیست."
        onAdd={
          !e || ["draft", "ready"].includes(e.status)
            ? () => setEdit(e ?? E.newExperiment(store))
            : undefined
        }
        addLabel={e ? "ویرایش طراحی" : "آزمایش جدید"}
      />
      {e && <AdvisorEntry type="experiment" id={e.id} />}
      {error && <p role="alert">{error}</p>}
      {e ? (
        <>
          <FunnelEntityContext key={e.id} kind="experiment" entityId={e.id} />
          <NetworkEntityContext
            key={"network" + e.id}
            kind="experiment"
            entityId={e.id}
          />
          {e.status === "completed" &&
            ["win", "partial"].includes(e.resultStatus ?? "") && (
              <ReadinessEntry type="experiment" id={e.id} />
            )}
          <div className="scale-tags">
            <span>{E.statuses[e.status]}</span>
            <span>{E.experimentTypes[e.type]}</span>
            <span>
              {e.resultStatus
                ? E.results[e.resultStatus]
                : "نتیجه نهایی هنوز ثبت نشده"}
            </span>
          </div>
          <div className="scale-actions">
            {e.status === "draft" && (
              <Button
                onClick={() =>
                  action(() =>
                    commit(transitionExperiment(store, e.id, "ready")),
                  )
                }
              >
                تأیید آمادگی
              </Button>
            )}
            {e.status === "ready" && (
              <Button
                onClick={() =>
                  action(() => {
                    const owner = sources.roles.find(
                      (r) => r.id === e.ownerRoleId,
                    );
                    if (!owner) throw Error("نقش مسئول در سیستم موجود نیست.");
                    commit(
                      transitionExperiment(store, e.id, "running", owner.title),
                    );
                  })
                }
              >
                شروع آزمایش
              </Button>
            )}
            {e.status === "running" && (
              <Button
                secondary
                onClick={() =>
                  action(() =>
                    commit(transitionExperiment(store, e.id, "paused")),
                  )
                }
              >
                توقف موقت
              </Button>
            )}
            {e.status === "paused" && (
              <Button
                onClick={() =>
                  action(() =>
                    commit(transitionExperiment(store, e.id, "running")),
                  )
                }
              >
                ادامه اجرا
              </Button>
            )}
            {["running", "paused"].includes(e.status) && (
              <Button onClick={() => setComplete(true)}>
                ثبت نتیجه و یادگیری
              </Button>
            )}
            {!["completed", "cancelled"].includes(e.status) && (
              <Button
                secondary
                onClick={() =>
                  action(() =>
                    commit(transitionExperiment(store, e.id, "cancelled")),
                  )
                }
              >
                لغو آزمایش
              </Button>
            )}
          </div>
          <Panel title="مسئله، ایده و اهرم">
            <p>
              گلوگاه:{" "}
              <Link href={`/scale/constraints/${e.constraintId}`}>
                {e.snapshot?.constraintTitle ??
                  store.constraints.find((c) => c.id === e.constraintId)
                    ?.title ??
                  "انتخاب نشده"}
              </Link>
            </p>
            {e.ideaId && (
              <p>
                ایده:{" "}
                <Link href={`/scale/ideas/${e.ideaId}`}>
                  {e.snapshot?.ideaTitle ??
                    store.ideas.find((i) => i.id === e.ideaId)?.title}
                </Link>
              </p>
            )}
            <p>
              اهرم:{" "}
              {e.snapshot?.leverName ??
                store.levers.find((l) => l.id === e.leverId)?.name ??
                "بدون اهرم"}
            </p>
            <p>
              مسئول:{" "}
              {e.snapshot?.ownerName ??
                sources.roles.find((r) => r.id === e.ownerRoleId)?.title ??
                "انتخاب نشده"}
            </p>
            <p>{e.description}</p>
          </Panel>
          <Panel title="فرضیه و طراحی">
            <p>
              اگر {e.hypothesis.change || "…"} برای{" "}
              {e.hypothesis.audience || "…"}، انتظار داریم{" "}
              {e.hypothesis.movement || "…"}؛ زیرا{" "}
              {e.hypothesis.rationale || "…"}.
            </p>
            <dl>
              {Object.entries({
                تغییر: e.experimentDesign.change,
                دامنه: e.experimentDesign.audience,
                کانال: e.experimentDesign.channel,
                "حجم اجرا": e.experimentDesign.sample,
                مقایسه: e.experimentDesign.comparison,
                یادداشت: e.experimentDesign.notes,
              }).map(([label, value]) => (
                <div className="scale-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "ثبت نشده"}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="معیار موفقیت و خط مبنا">
            {metric && <MetricReference metric={metric} />}
            <h3>
              {metric?.name ?? "شاخص انتخاب نشده"} ·{" "}
              {metric ? E.directions[metric.direction] : ""}
            </h3>
            <p>
              خط مبنا {fa(e.baselineValue)} · حداقل{" "}
              {fa(e.minimumSuccessThreshold)} · هدف {fa(e.targetValue)}{" "}
              {metric?.unit}
            </p>
            <p>
              دوره مبنا: {e.baselinePeriod || "نامشخص"} · منبع:{" "}
              {e.baselineSource || "نامشخص"}
            </p>
            <p>{e.successCriteria || "معیار ثبت نشده"}</p>
            <p>
              تلورانس مطلق: {fa(e.tolerance)} {metric?.unit}
            </p>
            <p>
              برنامه: {e.startDate || "—"} تا {e.endDate || "—"} · روز سپری‌شده{" "}
              {fa(time?.elapsed)} · روز باقی‌مانده {fa(time?.remaining)}
            </p>
            {e.startedAt && (
              <p>
                شروع واقعی:{" "}
                {new Date(e.startedAt).toLocaleString("fa-IR", {
                  timeZone: "Asia/Tehran",
                })}
              </p>
            )}
            <p>کیفیت طراحی: {fa(quality?.score)}٪؛ احتمال موفقیت نیست.</p>
            <details>
              <summary>چک‌لیست و اجزای کیفیت</summary>
              {readiness?.items.map((i) => (
                <p key={i.label}>
                  {i.ready ? "✓" : "○"} {i.label}
                </p>
              ))}
              {quality?.parts.map((p) => (
                <p key={p.label}>
                  {p.label}: {fa(p.ready ? p.weight : 0)} از {fa(p.weight)}
                </p>
              ))}
            </details>
          </Panel>
          {e.startedAt && <Measurements key={e.id} experiment={e} />}
          <ExecutionNotes key={e.id + e.status} experiment={e} />
          {e.status === "completed" && (
            <Panel title="نتیجه ثابت، یادگیری و تصمیم">
              <h3>نتیجه نهایی مدیریت: {E.results[e.resultStatus!]}</h3>
              <p>
                نتیجه پیشنهادی قواعد:{" "}
                {E.results[L.suggestExperimentResult(store, e).status]} · مشاهده{" "}
                {fa(L.suggestExperimentResult(store, e).actual)}
              </p>
              <p>{e.resultRationale}</p>
              <h3>یادگیری</h3>
              <p>{learning?.statement}</p>
              <p>{learning?.evidence}</p>
              <p>{learning?.reusableInsight}</p>
              <h3>تصمیم: {decision ? E.decisions[decision.decision] : ""}</h3>
              <p>{decision?.rationale}</p>
              {decision && <StoredDecisionContext context={decision.context} />}
              <p>
                تأیید ظرفیت:{" "}
                {decision?.capacityReviewed
                  ? "ثبت شد"
                  : "برای این تصمیم الزامی نبود"}{" "}
                · بررسی استراتژی:{" "}
                {decision?.alignmentReviewed
                  ? "ثبت شد"
                  : "برای این تصمیم الزامی نبود"}
              </p>
              <Link href={`/scale/constraints/${e.constraintId}`}>
                بازبینی وضعیت گلوگاه؛ هیچ حل‌شدن خودکاری انجام نشد ←
              </Link>
              {decision &&
                ["iterate", "retest"].includes(decision.decision) && (
                  <p>
                    <Button
                      onClick={() =>
                        action(() => {
                          const next = iterateExperiment(store, e.id);
                          commit(next.store);
                          router.push(
                            `/scale/experiments/${next.experiment.id}`,
                          );
                        })
                      }
                    >
                      ایجاد نسخه جدید آزمایش
                    </Button>
                  </p>
                )}
            </Panel>
          )}
          <Panel
            title="زمینه فعلی سیستم و استراتژی"
            caption="این بخش زنده و خواندنی است؛ نتیجه ثبت‌شده بالا را تغییر نمی‌دهد."
          >
            <CapacityContext experiment={e} />
          </Panel>
          <Panel title="زنجیره آزمایش">
            {e.parentExperimentId && (
              <p>
                نسخه قبلی:{" "}
                <Link href={`/scale/experiments/${e.parentExperimentId}`}>
                  {
                    d.experiments.find((x) => x.id === e.parentExperimentId)
                      ?.code
                  }
                </Link>
              </p>
            )}
            <p>این نسخه: {e.code}</p>
            {d.experiments
              .filter((x) => x.parentExperimentId === e.id)
              .map((x) => (
                <p key={x.id}>
                  نسخه بعد:{" "}
                  <Link href={`/scale/experiments/${x.id}`}>
                    {x.code} · {x.title}
                  </Link>
                </p>
              ))}
          </Panel>
          {e.ideaId && e.status === "completed" && (
            <IdeaDecision ideaId={e.ideaId} />
          )}
        </>
      ) : (
        <>
          <div className="scale-stats">
            <div className="scale-card">
              همه آزمایش‌ها<strong>{fa(summary.total)}</strong>
            </div>
            <div className="scale-card">
              تکمیل‌شده<strong>{fa(summary.completed)}</strong>
            </div>
            <div className="scale-card">
              یادگیری‌ها<strong>{fa(summary.learnings)}</strong>
            </div>
            <div className="scale-card">
              میانگین زمان واقعی (روز)
              <strong>{fa(summary.averageDuration)}</strong>
            </div>
          </div>
          <div className="scale-tags">
            {Object.entries(E.statuses).map(([k, label]) => (
              <span key={k}>
                {label}:{" "}
                {fa(d.experiments.filter((e) => e.status === k).length)}
              </span>
            ))}
          </div>
          <p>
            {Object.entries(E.results)
              .map(([k, label]) => `${label}: ${fa(summary.distribution[k])}`)
              .join(" · ")}
          </p>
          <Button secondary onClick={() => setMetricOpen(true)}>
            تعریف شاخص رشد
          </Button>
          <details>
            <summary>تنظیم یادآوری داده قدیمی</summary>
            <Numeric
              label="آستانه بی‌خبری (روز، ۱ تا ۹۰)"
              value={stale}
              onChange={setStale}
              max={90}
            />
            <Button
              secondary
              onClick={() =>
                action(() => {
                  if (!stale) throw Error("روز معتبر وارد کنید.");
                  commit({
                    ...store,
                    experimentData: { ...d, staleDays: stale },
                  });
                })
              }
            >
              ذخیره آستانه
            </Button>
          </details>
          <div className="scale-grid">
            {(
              [
                [
                  "constraintId",
                  "گلوگاه",
                  Object.fromEntries(
                    store.constraints.map((c) => [c.id, c.title]),
                  ),
                ],
                [
                  "leverId",
                  "اهرم",
                  Object.fromEntries(store.levers.map((l) => [l.id, l.name])),
                ],
                [
                  "ownerRoleId",
                  "مسئول",
                  Object.fromEntries(sources.roles.map((r) => [r.id, r.title])),
                ],
                ["status", "وضعیت اجرا", E.statuses],
                ["resultStatus", "نتیجه", E.results],
                ["decision", "تصمیم", E.decisions],
                ["type", "نوع", E.experimentTypes],
              ] as [string, string, Record<string, string>][]
            ).map(([key, label, items]) => (
              <Select
                key={key}
                label={`فیلتر ${label}`}
                value={filters[key] ?? ""}
                empty="همه"
                items={items}
                onChange={(v) => setFilters({ ...filters, [key]: v })}
              />
            ))}
          </div>
          <div className="scale-grid">
            {list.map((e) => (
              <article className="scale-card" key={e.id}>
                <small>
                  {e.code} · {E.statuses[e.status]}
                </small>
                <h3>
                  <Link href={`/scale/experiments/${e.id}`}>{e.title}</Link>
                </h3>
                <p>
                  {e.snapshot?.constraintTitle ??
                    store.constraints.find((c) => c.id === e.constraintId)
                      ?.title ??
                    "گلوگاه انتخاب نشده"}
                </p>
                <p>
                  {e.snapshot?.leverName ??
                    store.levers.find((l) => l.id === e.leverId)?.name ??
                    "اهرم انتخاب نشده"}{" "}
                  ·{" "}
                  {e.snapshot?.ownerName ??
                    sources.roles.find((r) => r.id === e.ownerRoleId)?.title ??
                    "بدون مسئول"}
                </p>
                <p>
                  {L.metricFor(store, e)?.name ?? "بدون شاخص"} ·{" "}
                  {e.resultStatus
                    ? E.results[e.resultStatus]
                    : "نتیجه ثبت نشده"}
                </p>
                <p>
                  {e.startDate || "—"} تا {e.endDate || "—"}
                </p>
                <p>
                  {d.decisions.find((x) => x.experimentId === e.id)
                    ? E.decisions[
                        d.decisions.find((x) => x.experimentId === e.id)!
                          .decision
                      ]
                    : "تصمیم ثبت نشده"}
                </p>
              </article>
            ))}
          </div>
          {!list.length && (
            <p>
              آزمایشی با این شرایط وجود ندارد؛ از ایده آماده یا طراحی دستی شروع
              کنید.
            </p>
          )}
        </>
      )}
      {edit && (
        <ExperimentEditor
          key={edit.id}
          initial={edit}
          close={() => setEdit(null)}
        />
      )}{" "}
      {metricOpen && <MetricEditor close={() => setMetricOpen(false)} />}{" "}
      {complete && e && (
        <CompletionEditor experiment={e} close={() => setComplete(false)} />
      )}
    </>
  );
}
function StoredDecisionContext({ context }: { context: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(context);
  } catch {
    return <p>{context}</p>;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const c = parsed as Record<string, unknown>,
    rows = Array.isArray(c.capacity) ? c.capacity : [];
  return (
    <details>
      <summary>شواهد ثابت هنگام تصمیم</summary>
      {rows.map((row: unknown, index: number) => {
        if (!row || typeof row !== "object") return null;
        const p = row as Record<string, unknown>;
        return (
          <p key={index}>
            {typeof p.title === "string" ? p.title : "فرآیند"} · سلامت{" "}
            {fa(typeof p.health === "number" ? p.health : null)} · استقلال{" "}
            {fa(typeof p.independence === "number" ? p.independence : null)} ·{" "}
            {Array.isArray(p.reasons)
              ? p.reasons
                  .filter((x: unknown) => typeof x === "string")
                  .join("؛ ")
              : ""}
          </p>
        );
      })}
      <p>
        هدف:{" "}
        {typeof c.strategyObjective === "string"
          ? c.strategyObjective
          : "ثبت نشده"}{" "}
        · نتیجه کلیدی:{" "}
        {typeof c.strategyKR === "string" ? c.strategyKR : "ثبت نشده"}
      </p>
    </details>
  );
}
function MetricReference({ metric: m }: { metric: E.GrowthMetric }) {
  const { sources } = useScale();
  if (m.sourceType === "strategy") {
    const k = sources.keyResults.find((k) => k.id === m.sourceId);
    return (
      <p>
        منبع زنده شاخص:{" "}
        {k ? (
          <Link
            href={`/strategy/cycles/${k.cycleId}/objectives/${k.objectiveId}#kr-${k.id}`}
          >
            {k.title} · مقدار جاری {fa(k.currentValue)}
          </Link>
        ) : (
          "ارجاع استراتژی در دسترس نیست"
        )}
        ؛ این مقدار جایگزین مشاهده آزمایش نمی‌شود.
      </p>
    );
  }
  if (m.sourceType === "system") {
    const k = sources.systemKPIs.find((k) => k.id === m.sourceId);
    return (
      <p>
        منبع زنده شاخص:{" "}
        {k ? (
          <Link href={`/system/processes/${k.processId}/kpis`}>{k.name}</Link>
        ) : (
          "ارجاع سیستم در دسترس نیست"
        )}
        ؛ منبع فقط خواندنی است.
      </p>
    );
  }
  return (
    <p>
      منبع شاخص: {E.sourceTypes[m.sourceType]} · {m.description}
    </p>
  );
}
function ExecutionNotes({ experiment: e }: { experiment: E.GrowthExperiment }) {
  const { store, commit } = useScale(),
    [notes, setNotes] = useState(e.executionNotes),
    [blockers, setBlockers] = useState(e.blockers),
    [error, setError] = useState("");
  if (!e.startedAt) return null;
  return (
    <Panel title="اجرای آزمایش و موانع">
      {["running", "paused"].includes(e.status) ? (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            try {
              commit(saveExecutionNotes(store, e.id, notes, blockers));
              setError("ثبت شد.");
            } catch (x) {
              setError(String(x));
            }
          }}
        >
          <Text
            area
            label="یادداشت اجرای آزمایش"
            value={notes}
            onChange={setNotes}
          />
          <Text
            area
            label="ریسک / مانع اجرا"
            value={blockers}
            onChange={setBlockers}
          />
          <Button type="submit">ذخیره یادداشت اجرا</Button>
          <p role="status">{error}</p>
        </form>
      ) : (
        <>
          <p>{e.executionNotes || "یادداشتی ثبت نشده"}</p>
          <p>{e.blockers || "مانعی ثبت نشده"}</p>
        </>
      )}
    </Panel>
  );
}
