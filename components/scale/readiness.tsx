"use client";
import { AdvisorEntry } from "@/components/advisor/entry";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button, PageTitle } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Numeric, fa } from "./shared";
import * as M from "@/lib/scale/readiness/model";
import * as L from "@/lib/scale/readiness/logic";
import * as U from "@/lib/scale/readiness/mutations";
import {
  networkData,
  channelPeriods,
  channelStatuses,
  maturities,
  loopPeriods,
} from "@/lib/scale/network/model";
import {
  channelPerformance,
  channelTrend,
  channelPortfolioSummary,
  channelScaleReadiness,
  loopStrength,
  loopTrend,
} from "@/lib/scale/network/logic";
import {
  experimentData,
  results,
  decisions as experimentDecisions,
} from "@/lib/scale/experiments/model";
import {
  CandidateEditor,
  AreaEditor,
  ScenarioEditor,
  PreparationEditor,
  InvestmentEditor,
} from "./readiness-editors";
const capacityLabels = {
  unknown: "نامشخص",
  available: "آزاد",
  tight: "فشرده",
  overloaded: "بیش از آستانه",
};
const completenessLabels: Record<string, string> = {
  demand: "شواهد تقاضا",
  funnel: "قیف",
  capacity: "ظرفیت",
  system: "سیستم",
  finance: "مالی",
  owner: "مالک",
  scenario: "سناریو",
};
function SourceEvidence({ c }: { c: M.ScaleCandidate }) {
  const { store, sources } = useScale(),
    n = networkData(store),
    e = experimentData(store);
  if (c.sourceType === "channel") {
    const ch = n.channels.find((x) => x.id === c.sourceId);
    if (!ch) return <p>منبع در دسترس نیست.</p>;
    const ps = channelPeriods(n, ch.id),
      p = ps.at(-1),
      m = channelPerformance(p),
      t = channelTrend(p, ps.at(-2)),
      portfolio = channelPortfolioSummary(
        store,
        p ? `${p.periodStart}|${p.periodEnd}` : "",
      ),
      process = sources.capacity.find((x) => x.id === ch.systemProcessId),
      r = channelScaleReadiness(
        store,
        ch.id,
        process?.health != null ? !process.risk : null,
      );
    return (
      <>
        <Link href={`/scale/channels/${ch.id}`}>{ch.name}</Link>
        <p>
          {channelStatuses[ch.status]} · بلوغ {maturities[ch.maturity]} · تبدیل{" "}
          {fa(m.conversion)}٪ · مشتری {fa(p?.customers)} · درآمد منتسب{" "}
          {fa(p?.revenue)} {p?.currency}
        </p>
        <p>
          تغییر واجد شرایط {fa(t.qualifiedLeads)} · تمرکز کانال اول سبد{" "}
          {fa(portfolio.concentration.top)}٪{" "}
          {portfolio.concentration.partial ? "(پوشش ناقص)" : ""}
        </p>
        <details>
          <summary>زمینه آمادگی کانال از Build 5D</summary>
          <p>
            {fa(r.score)} از ۱۰۰ با پوشش {r.coverage}٪؛ این زمینه جایگزین دروازه
            جامع نیست.
          </p>
        </details>
        {n.links
          .filter((l) => l.channelId === ch.id && l.kind === "experiment")
          .map((l) => (
            <p key={l.id}>
              <Link href={`/scale/experiments/${l.entityId}`}>
                {e.experiments.find((x) => x.id === l.entityId)?.title}
              </Link>
            </p>
          ))}
      </>
    );
  }
  if (c.sourceType === "loop") {
    const l = n.loops.find((x) => x.id === c.sourceId);
    if (!l) return null;
    const t = loopTrend(n, l.id),
      strength = loopStrength(store, l);
    return (
      <>
        <Link href={`/scale/loops/${l.id}`}>{l.name}</Link>
        <p>{strength.reason}</p>
        <p>
          خروجی {fa(t.current)} · تغییر {fa(t.delta)} · چرخه {fa(t.cycleTime)}{" "}
          روز · دوره‌ها {loopPeriods(n, l.id).length}
        </p>
        {n.leakage
          .filter((x) => x.loopId === l.id && !x.resolved)
          .map((x) => (
            <p key={x.id}>نشتی: {x.description}</p>
          ))}
        {n.evidence
          .filter((x) => x.loopId === l.id)
          .map((x) => (
            <blockquote key={x.id}>{x.text}</blockquote>
          ))}
      </>
    );
  }
  if (c.sourceType === "experiment") {
    const x = e.experiments.find((x) => x.id === c.sourceId);
    if (!x) return null;
    return (
      <>
        <Link href={`/scale/experiments/${x.id}`}>{x.title}</Link>
        <p>
          نتیجه: {x.resultStatus ? results[x.resultStatus] : "نامشخص"} ·{" "}
          {x.resultRationale}
        </p>
        {x.parentExperimentId && (
          <Link href={`/scale/experiments/${x.parentExperimentId}`}>
            آزمایش قبلی در زنجیره
          </Link>
        )}
        {e.learnings
          .filter((l) => l.experimentId === x.id)
          .map((l) => (
            <blockquote key={l.id}>{l.statement}</blockquote>
          ))}
        {e.decisions
          .filter((d) => d.experimentId === x.id)
          .map((d) => (
            <p key={d.id}>
              {experimentDecisions[d.decision]}: {d.rationale}
            </p>
          ))}
      </>
    );
  }
  return c.sourceType === "management" ? (
    <p>{c.manualEvidence || "شواهد مدیریت ثبت نشده است."}</p>
  ) : (
    <Link
      href={
        c.sourceType === "funnel"
          ? "/scale/funnel"
          : `/scale/ideas/${c.sourceId}`
      }
    >
      باز کردن منبع فرصت
    </Link>
  );
}
function FinancialEditor({ candidateId }: { candidateId: string }) {
  const { store, commit } = useScale(),
    d = M.readinessData(store),
    [kind, setKind] = useState<keyof typeof M.financeTypes>("workingCapital"),
    [state, setState] = useState<keyof typeof M.financialStates>("unknown"),
    [evidence, setEvidence] = useState(""),
    [message, setMessage] = useState("");
  return (
    <Panel
      title="ظرفیت مالی و سرمایه در گردش"
      caption="ارزیابی کیفی پذیرفته است؛ عدد جریان نقد ساخته نمی‌شود."
    >
      {d.financial
        .filter((f) => f.candidateId === candidateId)
        .map((f) => (
          <p key={f.id}>
            {M.financeTypes[f.kind]} · {M.financialStates[f.state]} ·{" "}
            {f.evidence}
          </p>
        ))}
      <Select
        label="نوع ظرفیت مالی"
        value={kind}
        items={M.financeTypes}
        onChange={(v) => {
          setKind(v as typeof kind);
          const f = d.financial.find(
            (f) => f.candidateId === candidateId && f.kind === v,
          );
          setState(f?.state ?? "unknown");
          setEvidence(f?.evidence ?? "");
        }}
      />
      <Select
        label="ارزیابی ظرفیت مالی"
        value={state}
        items={M.financialStates}
        onChange={(v) => setState(v as typeof state)}
      />
      <Text
        label="دلیل و منبع ارزیابی مالی"
        value={evidence}
        onChange={setEvidence}
        area
      />
      <Button
        onClick={() => {
          try {
            commit(
              U.saveFinancial(store, {
                id: M.id(),
                candidateId,
                kind,
                state,
                evidence,
                updatedAt: M.now(),
              }),
            );
            setMessage("ارزیابی مالی ذخیره شد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        ثبت ارزیابی مالی
      </Button>
      {message && <p role="status">{message}</p>}
    </Panel>
  );
}
function DecisionPanel({
  c,
  scenario,
  a,
}: {
  c: M.ScaleCandidate;
  scenario: M.ScaleScenario | null;
  a: L.Assessment;
}) {
  const { store, sources, commit } = useScale(),
    [decision, setDecision] = useState<keyof typeof M.decisions>("prepare"),
    [rationale, setRationale] = useState(""),
    [owner, setOwner] = useState(c.ownerRoleId),
    [reviewed, setReviewed] = useState(false),
    [message, setMessage] = useState("");
  return (
    <Panel
      title="تصمیم صریح مدیریت"
      caption="دروازه تحلیلی پیشنهاد است؛ هیچ تصمیمی خودکار ثبت نمی‌شود."
    >
      <p>
        پیشنهاد وضعیت: {L.gateLabels[a.gate]} · اولین محدودیت{" "}
        {a.primary?.area ?? "نامشخص / در داده موجود دیده نشد"}
      </p>
      <p>
        پیش از ثبت، شواهد رشد، اقتصاد، ظرفیت، فرآیندها، استراتژی و سرمایه‌گذاری
        را مرور کنید. تصمیم همراه با تصویر ثابت همین ارزیابی ثبت می‌شود.
      </p>
      <Select
        label="تصمیم مقیاس‌دهی"
        value={decision}
        items={M.decisions}
        onChange={(v) => setDecision(v as typeof decision)}
      />
      <Select
        label="نقش تصمیم‌گیر"
        value={owner}
        items={Object.fromEntries(sources.roles.map((r) => [r.id, r.title]))}
        empty="انتخاب نقش"
        onChange={setOwner}
      />
      <Text
        label="دلیل تصمیم مقیاس‌دهی"
        value={rationale}
        onChange={setRationale}
        area
      />
      <label>
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        شواهد، ظرفیت، اقتصاد، استراتژی و نیاز سرمایه‌گذاری را مرور کردم
      </label>
      <div className="scale-actions">
        {c && <AdvisorEntry type="candidate" id={c.id} />}
        <Button
          onClick={() => {
            try {
              commit(
                U.recordAssessment(store, c.id, scenario?.id ?? "", sources, {
                  decision,
                  rationale,
                  reviewedByRoleId: owner,
                  reviewed,
                }),
              );
              setMessage("تصمیم و تصویر شواهد ثبت شد.");
              setRationale("");
              setReviewed(false);
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          ثبت تصمیم و تصویر ارزیابی
        </Button>
        <Button
          secondary
          onClick={() => {
            try {
              commit(
                U.recordAssessment(store, c.id, scenario?.id ?? "", sources),
              );
              setMessage("ارزیابی جدید بدون تغییر تصمیم ثبت شد.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          ثبت ارزیابی مجدد
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </Panel>
  );
}
function History({ candidateId }: { candidateId: string }) {
  const { store } = useScale(),
    d = M.readinessData(store);
  return (
    <Panel
      title="تاریخچه ارزیابی و تصمیم"
      caption="ارقام و شواهد زیر مربوط به زمان ثبت‌اند؛ با تغییر داده فعلی بازنویسی نمی‌شوند."
    >
      {d.snapshots
        .filter((s) => s.candidateId === candidateId)
        .map((s, i) => {
          const a = s.assessment as L.Assessment,
            decision = d.decisions.find((x) => x.snapshotId === s.id);
          return (
            <article className="scale-card" key={s.id}>
              <h3>
                ارزیابی {i + 1} ·{" "}
                {new Date(s.createdAt).toLocaleString("fa-IR", {
                  timeZone: "Asia/Tehran",
                })}
              </h3>
              <p>
                {s.candidate.name} · {fa(a.score)} از ۱۰۰ · پوشش {a.coverage}٪ ·
                اطمینان {L.confidenceLabels[a.confidence]} ·{" "}
                {L.gateLabels[a.gate]}
              </p>
              <p>
                {s.scenario?.name ?? "بدون سناریو"} · ضریب{" "}
                {fa(s.scenario?.factor)} · ریسک {a.primary?.area ?? "ثبت نشده"}
              </p>
              {decision && (
                <>
                  <strong>{M.decisions[decision.decision]}</strong>
                  <p>{decision.rationale}</p>
                  <p>
                    نقش ثبت‌کننده:{" "}
                    {(
                      s.sourceContext as {
                        roles?: { id: string; title: string }[];
                      }
                    )?.roles?.find((r) => r.id === decision.reviewedByRoleId)
                      ?.title ?? "نقش پیشین در دسترس نیست"}
                  </p>
                </>
              )}
              <details>
                <summary>شواهد و ظرفیت همان زمان</summary>
                {a.components.map((p) => (
                  <p key={p.key}>
                    {p.label}: {fa(p.value)} · {p.evidence}
                  </p>
                ))}
                {a.plan.map((p) => (
                  <p key={p.id}>
                    {p.name}: ظرفیت {fa(p.currentCapacity)}، نیاز{" "}
                    {fa(p.required)}، شکاف {fa(p.gap)} {p.unit} / {p.period}
                  </p>
                ))}
                {a.risks.map((r, j) => (
                  <p key={j}>
                    {r.area}: {r.evidence}
                  </p>
                ))}
                <p>
                  آماده‌سازی تکمیل‌شده در زمان ثبت: {a.preparation.completed} از{" "}
                  {a.preparation.total}
                </p>
              </details>
            </article>
          );
        })}
    </Panel>
  );
}
export function ReadinessWorkspace({
  mode = "readiness",
  candidateId,
  initialSource,
  initialSourceId,
}: {
  mode?: "readiness" | "capacity" | "decisions";
  candidateId?: string;
  initialSource?: string;
  initialSourceId?: string;
}) {
  const { store, sources, commit } = useScale(),
    d = M.readinessData(store);
  const [selected, setSelected] = useState(
      candidateId ?? d.candidates[0]?.id ?? "",
    ),
    [scenarioId, setScenarioId] = useState(""),
    [candidateEdit, setCandidateEdit] = useState<M.ScaleCandidate | null>(() =>
      initialSource && Object.hasOwn(M.sourceTypes, initialSource)
        ? {
            ...M.newCandidate(),
            sourceType: initialSource as M.ScaleCandidate["sourceType"],
            sourceId: initialSourceId ?? "",
          }
        : null,
    ),
    [areaEdit, setAreaEdit] = useState<M.CapacityArea | null>(null),
    [scenarioEdit, setScenarioEdit] = useState<M.ScaleScenario | null>(null),
    [prepEdit, setPrepEdit] = useState<M.ScalePreparationItem | null>(null),
    [investment, setInvestment] = useState(false),
    [tight, setTight] = useState<number | null>(d.thresholds.tight),
    [over, setOver] = useState<number | null>(d.thresholds.overloaded),
    [message, setMessage] = useState("");
  const c = d.candidates.find((c) => c.id === selected),
    scenarios = d.scenarios.filter((x) => x.candidateId === selected),
    scenario =
      scenarios.find((x) => x.id === scenarioId) ?? scenarios.at(-1) ?? null,
    a = c ? L.scaleReadiness(store, c, sources, scenario) : null;
  const portfolio = d.candidates
    .filter((c) => c.status !== "archived")
    .map((c) => ({
      c,
      a: L.scaleReadiness(
        store,
        c,
        sources,
        d.scenarios.filter((x) => x.candidateId === c.id).at(-1) ?? null,
      ),
    }));
  if (candidateId && !c)
    return (
      <Panel title="کاندید پیدا نشد">
        <Link href="/scale/readiness">بازگشت به کاندیدها</Link>
      </Panel>
    );
  const title =
    mode === "capacity"
      ? "برنامه ظرفیت برای رشد"
      : mode === "decisions"
        ? "تصمیم‌های مقیاس‌دهی"
        : "دروازه آمادگی مقیاس‌دهی";
  return (
    <>
      <PageTitle
        title={title}
        description="آیا رشد قابل تکرار است و سازمان توان پاسخ‌گویی دارد؟"
        onAdd={() => setCandidateEdit(M.newCandidate())}
        addLabel="کاندید جدید"
      />
      <div className="scale-actions">
        <Link href="/scale/readiness">آمادگی</Link>
        <Link href="/scale/capacity">ظرفیت</Link>
        <Link href="/scale/scale-decisions">تصمیم‌ها</Link>
      </div>
      {!candidateId && mode === "readiness" && (
        <>
          <Panel title="سبد کاندیدها">
            <div className="scale-grid">
              {portfolio.map(({ c, a }) => (
                <article className="scale-card" key={c.id}>
                  <h3>
                    <Link href={`/scale/readiness/${c.id}`}>{c.name}</Link>
                  </h3>
                  <p>
                    {M.sourceTypes[c.sourceType]} ·{" "}
                    {M.candidateStatuses[c.status]} ·{" "}
                    {sources.roles.find((r) => r.id === c.ownerRoleId)?.title ??
                      "بدون مالک"}
                  </p>
                  <p>
                    آمادگی {fa(a.score)} · اطمینان{" "}
                    {L.confidenceLabels[a.confidence]} · {L.gateLabels[a.gate]}
                  </p>
                  <p>{a.evidence.detail}</p>
                  <p>ریسک اصلی: {a.primary?.area ?? "نامشخص / مشاهده نشد"}</p>
                  <p>
                    آخرین تصمیم:{" "}
                    {(() => {
                      const x = d.decisions
                        .filter((x) => x.scaleCandidateId === c.id)
                        .at(-1);
                      return x ? M.decisions[x.decision] : "ثبت نشده";
                    })()}
                  </p>
                </article>
              ))}
            </div>
            {!portfolio.length && (
              <p>
                برای بررسی یک فرصت، کاندید بسازید و منبع شواهد را انتخاب کنید.
              </p>
            )}
          </Panel>
          <Panel title="شواهد رشد در برابر ظرفیت سازمان">
            <div className="scale-matrix">
              {[
                [
                  "high-high",
                  "شواهد قوی / ظرفیت کافی",
                  "کاندید بررسی تصمیم مقیاس‌دهی",
                ],
                [
                  "high-low",
                  "شواهد قوی / ظرفیت محدود",
                  "ابتدا سازمان را آماده کنید",
                ],
                ["low-high", "شواهد محدود / ظرفیت کافی", "آزمایش بیشتر"],
                [
                  "low-low",
                  "شواهد محدود / ظرفیت محدود",
                  "از مقیاس‌دهی زودهنگام پرهیز کنید",
                ],
              ].map(([key, label, caption]) => (
                <section key={key}>
                  <h3>{label}</h3>
                  <p>{caption}</p>
                  {portfolio
                    .filter((r) => r.a.matrix === key)
                    .map((r) => (
                      <p key={r.c.id}>
                        <Link href={`/scale/readiness/${r.c.id}`}>
                          {r.c.name}
                        </Link>
                      </p>
                    ))}
                </section>
              ))}
            </div>
            <p>
              جایگاه نامشخص:{" "}
              {portfolio
                .filter((r) => r.a.matrix === "unknown")
                .map((r) => r.c.name)
                .join("، ") || "نداریم"}
              ؛ نبود ظرفیت با ظرفیت صفر یکسان نیست.
            </p>
          </Panel>
        </>
      )}
      <Select
        label="کاندید مورد بررسی"
        value={selected}
        items={Object.fromEntries(d.candidates.map((c) => [c.id, c.name]))}
        empty="انتخاب کاندید"
        onChange={(v) => {
          setSelected(v);
          setScenarioId("");
        }}
      />
      {c && a && (
        <>
          <div className="scale-actions">
            <Button secondary onClick={() => setCandidateEdit(c)}>
              ویرایش کاندید
            </Button>
            <Button onClick={() => setScenarioEdit(M.newScenario(c.id))}>
              سناریوی جدید
            </Button>
          </div>
          <Select
            label="سناریوی مورد بررسی"
            value={scenario?.id ?? ""}
            items={Object.fromEntries(
              scenarios.map((s) => [s.id, `${s.name} · ${s.factor}×`]),
            )}
            empty="بدون سناریو"
            onChange={setScenarioId}
          />
          {scenario && (
            <Button secondary onClick={() => setScenarioEdit(scenario)}>
              ویرایش سناریو
            </Button>
          )}
          <section className={`scale-gate gate-${a.gate}`}>
            <span>SCALE GATE</span>
            <h2>{L.gateLabels[a.gate]}</h2>
            <div className="scale-grid">
              <div>
                <strong>{fa(a.score)} / ۱۰۰</strong>
                <p>آمادگی: {a.readinessLabel}</p>
              </div>
              <div>
                <strong>{L.confidenceLabels[a.confidence]}</strong>
                <p>اطمینان شواهد</p>
              </div>
              <div>
                <strong>{a.completeness}٪</strong>
                <p>کامل‌بودن داده · پوشش امتیاز {a.coverage}٪</p>
              </div>
            </div>
            <p>این وضعیت تحلیلی است؛ تصمیم مدیریت خودکار تغییر نمی‌کند.</p>
          </section>
          <Panel title="شواهد رشد و اقتصاد">
            <p>{a.evidence.detail}</p>
            <SourceEvidence c={c} />
            <p>
              تکرارپذیری:{" "}
              {
                {
                  unproven: "اثبات‌نشده",
                  early: "اولیه",
                  repeatable: "تکرارپذیر",
                }[a.repeatability.state as "unproven" | "early" | "repeatable"]
              }
            </p>
            <details>
              <summary>اجزای امتیاز و پوشش داده</summary>
              {a.components.map((p) => (
                <p key={p.key}>
                  <strong>
                    {p.label} ({p.weight}٪): {fa(p.value)}
                  </strong>{" "}
                  · {p.evidence}
                </p>
              ))}
              {Object.entries(a.completenessParts).map(([k, v]) => (
                <p key={k}>
                  {completenessLabels[k]}: {v ? "موجود" : "ناقص"}
                </p>
              ))}
              <p>
                اجزای نامشخص از مخرج امتیاز حذف می‌شوند؛ اطمینان بر پوشش، کیفیت
                منبع و عمق تاریخچه تکیه دارد. استاندارد، پذیرش و KPI جدا از
                استقلال بررسی می‌شوند؛ سلامت کل دوباره امتیاز نمی‌گیرد.
              </p>
            </details>
          </Panel>
          <Panel title="اولین نقطه شکست">
            <h3>
              {a.primary?.area ?? "داده کافی برای تعیین محدودیت قطعی نداریم"}
            </h3>
            <p>{a.primary?.evidence}</p>
            <p>{a.primary?.recommendedPreparation}</p>
            <p>محدودیت بعدی احتمالی: {a.next?.area ?? "نامشخص"}</p>
            <p>
              {a.next
                ? "با رفع گلوگاه فعلی، این حوزه ممکن است به گلوگاه بعدی تبدیل شود."
                : "نبود ریسک ثبت‌شده به معنی نبود ریسک واقعی نیست."}
            </p>
            <p>
              اولویت با شدت و سپس نسبت شکاف به ظرفیت است؛ زمان وقوع شکست را
              پیش‌بینی نمی‌کنیم.
            </p>
          </Panel>
          <Panel
            title="نیاز سناریو از قیف"
            caption="همان محاسبه معکوس قیف با نرخ‌های مشاهده‌شده یا هدف؛ واحد و دوره باید تطبیق داده شوند."
          >
            <p>
              {a.requirements.period || "قیف مبنا انتخاب نشده"} · هدف درآمد
              ثبت‌شده {fa(a.requirements.revenueTarget)}
            </p>
            <div className="scale-grid">
              {a.requirements.rows.map((r) => (
                <article key={r.id}>
                  <strong>{r.name}</strong>
                  <p>
                    {fa(r.current)} ← {fa(r.required)} {r.unit}
                  </p>
                </article>
              ))}
            </div>
            <Link href="/scale/funnel">بررسی قیف و سناریوی تبدیل ←</Link>
          </Panel>
          <Panel
            title="ظرفیت فعلی، بار و نیاز"
            action={
              <Button onClick={() => setAreaEdit(M.newArea(c.id))}>
                حوزه ظرفیت جدید
              </Button>
            }
          >
            <p>
              حدود پیش‌فرض ۷۰٪ و ۹۰٪ راهنمای عملیاتی‌اند؛ قانون عمومی ریسک
              نیستند. نامشخص‌ها جمع یا صفر نمی‌شوند.
            </p>
            <div className="scale-grid">
              {a.plan.map((p) => (
                <article className="scale-card" key={p.id}>
                  <h3>
                    {p.name} · {M.areaTypes[p.area]}
                  </h3>
                  <p>
                    {p.unit} / {p.period} ·{" "}
                    {sources.roles.find((r) => r.id === p.ownerRoleId)?.title ??
                      "بدون مالک"}
                  </p>
                  <p>
                    ظرفیت {fa(p.currentCapacity)} · بار {fa(p.currentLoad)} ·
                    نیاز {fa(p.required)} · شکاف {fa(p.gap)}
                  </p>
                  <p>
                    بهره‌برداری فعلی {fa(p.utilization)}٪ · سناریو{" "}
                    {fa(p.projectedUtilization)}٪ · {capacityLabels[p.status]}
                  </p>
                  <p>{p.basis}</p>
                  <p>
                    {p.action || "اقدام تعیین نشده"} · {p.source}
                  </p>
                  {p.criticalRoleGap && <p>شکاف نقش بحرانی</p>}
                  <Button secondary onClick={() => setAreaEdit(p)}>
                    ویرایش ظرفیت {p.name}
                  </Button>
                </article>
              ))}
            </div>
            <details>
              <summary>تنظیم آستانه ظرفیت</summary>
              <Numeric
                label="شروع وضعیت فشرده (%)"
                value={tight}
                onChange={setTight}
              />
              <Numeric
                label="آستانه بار زیاد (%)"
                value={over}
                onChange={setOver}
              />
              <Button
                onClick={() => {
                  try {
                    commit(
                      U.saveThresholds(store, {
                        tight: tight ?? 0,
                        overloaded: over ?? 0,
                      }),
                    );
                    setMessage("آستانه‌ها ذخیره شد.");
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                ذخیره آستانه ظرفیت
              </Button>
              {message && <p role="status">{message}</p>}
            </details>
            <p>
              بار نقش‌ها:{" "}
              {a.plan
                .filter((p) => p.status === "overloaded" && p.ownerRoleId)
                .map(
                  (p) =>
                    `${sources.roles.find((r) => r.id === p.ownerRoleId)?.title ?? "نقش ناموجود"} (${p.name})`,
                )
                .join("، ") || "بار زیاد قابل استناد ثبت نشده"}
            </p>
          </Panel>
          <Panel title="آمادگی سیستم و هم‌راستایی استراتژی">
            <p>
              فقط فرآیندهای انتخاب‌شده کاندید؛ داده‌های سیستم و استراتژی فقط
              خوانده می‌شوند.
            </p>
            {a.linkedProcesses.map((p) => (
              <article key={p.id}>
                <h3>
                  <Link href={`/system/processes/${p.id}`}>{p.title}</Link>
                </h3>
                <p>
                  سلامت {fa(p.health)} · استاندارد {fa(p.standardization)} ·
                  پذیرش {fa(p.adoption)} · KPI {fa(p.kpi)} · استقلال{" "}
                  {fa(p.independence)}
                </p>
                <p>
                  {p.reasons.join("؛ ") || "ریسک ثبت‌شده در این خلاصه دیده نشد"}
                </p>
              </article>
            ))}
            {!a.linkedProcesses.length && (
              <p>فرآیند مرتبط انتخاب نشده؛ آمادگی سیستم نامشخص است.</p>
            )}
            <Link href="/system/independence">
              آزمون استقلال ۳۰روزه و مالکیت نقش‌ها ←
            </Link>
            {sources.independence30
              .filter((p) => c.processIds.includes(p.processId))
              .map((p) => (
                <p key={p.processId}>
                  آزمون ۳۰روزه ·{" "}
                  {sources.processes.find((x) => x.id === p.processId)?.name}:{" "}
                  {p.ownerReliable
                    ? "مالک دارای متصدی فعال"
                    : "مالکیت نیازمند بررسی"}{" "}
                  ·{" "}
                  {p.sopApproved
                    ? "استاندارد تأییدشده"
                    : "استاندارد تأیید نشده"}{" "}
                  · {p.risks.join("، ") || "ریسک ثبت‌شده ندارد"}
                </p>
              ))}
            <p>
              هدف:{" "}
              {sources.objectives.find((o) => o.id === c.objectiveId)?.title ??
                "نامشخص"}{" "}
              · نتیجه کلیدی:{" "}
              {sources.keyResults.find((k) => k.id === c.krId)?.title ??
                "نامشخص"}
            </p>
            <p>
              آیا این فرصت از استراتژی فعلی پشتیبانی می‌کند؟ پیوند به‌تنهایی
              تأیید هم‌راستایی نیست.
            </p>
            <Link href="/strategy">بررسی استراتژی و اولویت‌ها ←</Link>
            <p>
              اولویت استراتژیک:{" "}
              {sources.priorities.find(
                (p) =>
                  p.id ===
                  sources.objectives.find((o) => o.id === c.objectiveId)
                    ?.relatedPriorityId,
              )?.title ?? "نامشخص"}{" "}
              · دوره هدف:{" "}
              {sources.cycleLabels[
                sources.objectives.find((o) => o.id === c.objectiveId)
                  ?.cycleId ?? ""
              ] ?? "نامشخص"}
            </p>
          </Panel>
          <FinancialEditor key={`finance-${c.id}`} candidateId={c.id} />
          <Panel
            title="سرمایه‌گذاری لازم"
            action={
              <Button onClick={() => setInvestment(true)}>
                نیاز سرمایه‌گذاری جدید
              </Button>
            }
          >
            {d.investments
              .filter((i) => i.candidateId === c.id)
              .map((i) => (
                <p key={i.id}>
                  {M.investmentTypes[i.kind]}: {fa(i.amount)} {i.unit} ·{" "}
                  {i.description}
                </p>
              ))}
            <p>
              توجه مدیریت، نیروی انسانی و موجودی ممکن است بدون مبلغ دقیق ثبت
              شوند.
            </p>
          </Panel>
          <Panel
            title="برنامه آماده‌سازی"
            action={
              <Button onClick={() => setPrepEdit(M.newPreparation(c.id))}>
                اقدام آماده‌سازی جدید
              </Button>
            }
          >
            <p>
              لازم {a.preparation.total} · تکمیل {a.preparation.completed} ·
              باقی‌مانده {a.preparation.remaining} · مسدود{" "}
              {a.preparation.blocked}
            </p>
            <p>
              تکمیل اقدام، امتیاز آمادگی را خودکار افزایش نمی‌دهد؛ ظرفیت و شواهد
              باید دوباره ارزیابی شوند.
            </p>
            {d.preparation
              .filter((p) => p.candidateId === c.id)
              .map((p) => (
                <article key={p.id}>
                  <h3>{p.title}</h3>
                  <p>
                    {M.preparationStatuses[p.status]} ·{" "}
                    {sources.roles.find((r) => r.id === p.ownerRoleId)?.title ??
                      "بدون مالک"}{" "}
                    · {p.dueDate || "بدون موعد"}
                  </p>
                  <Button secondary onClick={() => setPrepEdit(p)}>
                    ویرایش آماده‌سازی {p.title}
                  </Button>
                </article>
              ))}
          </Panel>
          <Panel title="نیازمند توجه">
            {L.scaleNeedsAttention(a, c).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </Panel>
          <DecisionPanel
            key={`decision-${c.id}`}
            c={c}
            scenario={scenario}
            a={a}
          />
          <History candidateId={c.id} />
        </>
      )}
      {candidateEdit && (
        <CandidateEditor
          key={candidateEdit.id}
          initial={candidateEdit}
          close={(savedId) => {
            if (savedId) setSelected(savedId);
            setCandidateEdit(null);
          }}
        />
      )}
      {areaEdit && (
        <AreaEditor initial={areaEdit} close={() => setAreaEdit(null)} />
      )}{" "}
      {scenarioEdit && (
        <ScenarioEditor
          initial={scenarioEdit}
          close={() => {
            setScenarioId(scenarioEdit.id);
            setScenarioEdit(null);
          }}
        />
      )}
      {prepEdit && (
        <PreparationEditor initial={prepEdit} close={() => setPrepEdit(null)} />
      )}{" "}
      {investment && c && (
        <InvestmentEditor
          candidateId={c.id}
          close={() => setInvestment(false)}
        />
      )}
    </>
  );
}
