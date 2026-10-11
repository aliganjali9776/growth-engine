"use client";
import { AdvisorEntry } from "@/components/advisor/entry";
import { reviewDate as tehranDay } from "@/lib/strategy/adapt/definition";
import { KRInitiativeLinks } from "./initiative-summary";
import { KRWeeklyHistory } from "./weekly-history";
import { ChangeHistory } from "./adapt-workspace";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel, Empty, Field } from "@/components/system/ui";
import { useStrategy } from "./provider";
import {
  dateLabel,
  roleName,
  todayTehran,
  type StrategyObjective,
} from "@/lib/strategy/model";
import {
  krTypes,
  krStatuses,
  objectiveHealthLabels,
  type KeyResult,
} from "@/lib/strategy/kr/types";
import {
  calculateKRProgress,
  calculateKRStatus,
  confidenceLabel,
  weightInfo,
  calculateWeightedContribution,
} from "@/lib/strategy/kr/calculations";
import { calculateKRCompleteness } from "@/lib/strategy/kr/validation";
import {
  objectiveMeasurement,
  measurementReport,
  krReadOnly,
} from "@/lib/strategy/kr/report";
import { setKRWeightMode } from "@/lib/strategy/kr/mutations";
import { KREditor } from "./kr-editor";
export const krNumber = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
function Progress({ value }: { value: number | null }) {
  return (
    <div className="kr-progress">
      {value === null ? (
        <span>—</span>
      ) : (
        <>
          <strong>{krNumber(value)}٪</strong>
          <progress max={100} value={value} aria-label="پیشرفت محاسبه‌شده" />
        </>
      )}
    </div>
  );
}
export function KRCard({
  kr,
  onEdit,
}: {
  kr: KeyResult;
  onEdit: (kr: KeyResult, measurement: boolean) => void;
}) {
  const { store, roles } = useStrategy(),
    o = store.objectives.find((o) => o.id === kr.objectiveId)!,
    mode = o.krWeightMode ?? "equal";
  const progress = calculateKRProgress(kr),
    pacing = calculateKRStatus(kr, todayTehran()),
    quality = calculateKRCompleteness(kr, store, roles, mode),
    weights = weightInfo(
      (store.keyResults ?? []).filter((k) => k.objectiveId === o.id),
      mode,
    ),
    weight =
      mode === "custom"
        ? kr.weight
        : (weights.weights.find((w) => w.id === kr.id)?.weight ?? null);
  return (
    <article className="st-card kr-card" id={"kr-" + kr.id}>
      <div className="st-card-top">
        <b>
          {kr.code} · {krTypes[kr.type]}
        </b>
        <span className={"st-tag kr-status-" + pacing.status}>
          {kr.lifecycle === "cancelled"
            ? "لغوشده"
            : pacing.status
              ? krStatuses[pacing.status]
              : "داده کافی نیست"}
        </span>
      </div>
      <h3>{kr.title}</h3>
      <Link
        href={`/strategy/cycles/${kr.cycleId}/objectives/${kr.objectiveId}`}
      >
        {o.code} · {o.title}
      </Link>
      <p>{roleName(kr.ownerRoleId, roles)}</p>
      <Progress value={progress} />
      {kr.type === "milestone" ? (
        <ul>
          {kr.milestones.map((m) => (
            <li key={m.id}>
              {m.completed ? "✓" : "○"} {m.title} · {krNumber(m.weight)}٪{" "}
              {m.completedAt && (
                <small>· {dateLabel(tehranDay(m.completedAt))}</small>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <dl>
          <dt>شروع</dt>
          <dd>{krNumber(kr.startValue)}</dd>
          <dt>فعلی</dt>
          <dd>
            {kr.type === "binary"
              ? kr.currentValue === null
                ? "ثبت نشده"
                : kr.currentValue
                  ? "بله"
                  : "خیر"
              : krNumber(kr.currentValue)}
          </dd>
          <dt>هدف</dt>
          <dd>
            {krNumber(kr.targetValue)} {kr.unit}
          </dd>
        </dl>
      )}
      <dl>
        <dt>وزن مؤثر</dt>
        <dd>
          {krNumber(weight)}٪ {mode === "equal" ? "(برابر)" : ""}
        </dd>
        <dt>سهم در هدف</dt>
        <dd>
          {weights.valid && kr.lifecycle === "active"
            ? krNumber(calculateWeightedContribution(progress, weight))
            : "—"}{" "}
          واحد درصد
        </dd>
        <dt>اطمینان</dt>
        <dd>
          {krNumber(kr.confidence)} / ۱۰ · {confidenceLabel(kr.confidence)}
        </dd>
        <dt>مهلت</dt>
        <dd>{dateLabel(kr.deadline)}</dd>
        <dt>آخرین مقدار</dt>
        <dd>
          {kr.lastUpdateAt
            ? new Date(kr.lastUpdateAt).toLocaleString("fa-IR", {
                timeZone: "Asia/Tehran",
              })
            : "ثبت نشده"}
        </dd>
      </dl>
      {pacing.stale &&
        o.status === "active" &&
        store.cycles.find((c) => c.id === kr.cycleId)?.status === "active" && (
          <p className="st-notice">نیازمند به‌روزرسانی</p>
        )}
      <details>
        <summary>دلیل وضعیت و کیفیت داده</summary>
        <p>{pacing.reason}</p>
        <p>
          پیشرفت مورد انتظار زمانی: {krNumber(pacing.expected)}٪؛ معیار خطی
          مقایسه است، پیش‌بینی نیست.
        </p>
        <p>
          کامل بودن داده: {quality.score.toLocaleString("fa-IR")}٪ ·{" "}
          {quality.label}
        </p>
        <ul>
          {[...quality.missing, ...quality.warnings].map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        {kr.notes && <p>یادداشت مدیریت: {kr.notes}</p>}
      </details>
      <AdvisorEntry type="kr" id={kr.id} />
      <KRInitiativeLinks keyResultId={kr.id} />
      <KRWeeklyHistory keyResultId={kr.id} />
      <ChangeHistory entityId={kr.id} />
      <div className="st-actions">
        <Button
          secondary
          disabled={krReadOnly(store, kr)}
          onClick={() => onEdit(kr, true)}
        >
          به‌روزرسانی {kr.code}
        </Button>
        <Button
          secondary
          disabled={krReadOnly(store, kr)}
          onClick={() => onEdit(kr, false)}
        >
          ویرایش {kr.code}
        </Button>
      </div>
    </article>
  );
}
function newKR(
  store: ReturnType<typeof useStrategy>["store"],
  o: StrategyObjective,
): KeyResult {
  let code = 1;
  while (
    store.keyResults?.some(
      (k) => k.cycleId === o.cycleId && k.code === `KR${code}`,
    )
  )
    code++;
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    cycleId: o.cycleId,
    objectiveId: o.id,
    code: `KR${code}`,
    title: "",
    description: "",
    ownerRoleId: o.ownerRoleId,
    type: "increase",
    startValue: null,
    targetValue: null,
    currentValue: null,
    unit: "",
    weight: null,
    confidence: null,
    startDate: o.startDate,
    deadline: o.deadline,
    notes: "",
    createdAt: now,
    updatedAt: now,
    lifecycle: "active",
    milestones: [],
  };
}
export function ObjectiveMeasurement({
  objective,
  compact = false,
}: {
  objective: StrategyObjective;
  compact?: boolean;
}) {
  const { store, roles, commit } = useStrategy(),
    m = objectiveMeasurement(store, objective, roles, todayTehran()),
    [edit, setEdit] = useState<{ k: KeyResult; measurement: boolean } | null>(
      null,
    ),
    [error, setError] = useState("");
  const all = (store.keyResults ?? []).filter(
      (k) => k.objectiveId === objective.id,
    ),
    locked = krReadOnly(store, {
      objectiveId: objective.id,
      cycleId: objective.cycleId,
    });
  const summary = (
    <>
      <Progress value={m.progress} />
      {!m.krs.length && <p>هنوز نتیجه کلیدی تعریف نشده است.</p>}
      <p>
        <span className={"st-tag kr-status-" + m.health.health}>
          {objectiveHealthLabels[m.health.health]}
        </span>{" "}
        · اطمینان {krNumber(m.confidence)} / ۱۰
      </p>
      <small>
        کامل بودن داده: {krNumber(m.completeness)}٪ · پوشش اطمینان:{" "}
        {krNumber(m.confidenceCoverage)}٪
      </small>
    </>
  );
  if (compact) return <div className="kr-objective-mini">{summary}</div>;
  return (
    <Panel
      title="پیشرفت و سلامت هدف"
      caption="محاسبه از نتایج فعال؛ مستقل از وضعیت چرخه عمر هدف"
      action={
        <Button
          disabled={locked}
          onClick={() =>
            setEdit({ k: newKR(store, objective), measurement: false })
          }
        >
          افزودن نتیجه کلیدی
        </Button>
      }
    >
      {summary}
      <p>{m.health.reason}</p>
      <div className="kr-weight-row">
        <Field label="روش وزن‌دهی نتایج">
          <select
            disabled={locked}
            value={objective.krWeightMode ?? "equal"}
            onChange={(e) => {
              try {
                commit(
                  setKRWeightMode(
                    store,
                    objective.id,
                    e.target.value as "equal" | "custom",
                  ),
                );
                setError("");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "ذخیره انجام نشد.",
                );
              }
            }}
          >
            <option value="equal">وزن برابر</option>
            <option value="custom">وزن سفارشی</option>
          </select>
        </Field>
        <p>
          مجموع وزن: {krNumber(m.weights.total)}٪ · {m.weights.label}
        </p>
      </div>
      {!m.weights.valid && m.krs.length > 0 && (
        <p className="st-notice">
          وزن‌های سفارشی را به مجموع ۱۰۰٪ برسانید. وزن ناقص یا اضافی خودکار
          نرمال نمی‌شود و پیشرفت هدف نامعلوم می‌ماند.
        </p>
      )}
      <small>
        اطمینان هدف در وزن نامعتبر، میانگین برابر اطمینان‌های ثبت‌شده است؛ با
        وزن معتبر، میانگین وزنی داده موجود. سهم صفر در پیشرفت و سلامت اثر ندارد.
      </small>
      {locked && (
        <p className="st-notice">
          دوره بسته یا هدف لغوشده؛ سابقه نتایج فقط خواندنی است.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="st-cards kr-cards">
        {all.map((k) => (
          <KRCard
            key={k.id}
            kr={k}
            onEdit={(k, measurement) => setEdit({ k, measurement })}
          />
        ))}
      </div>
      {edit && (
        <KREditor
          initial={edit.k}
          measurement={edit.measurement}
          onClose={() => setEdit(null)}
        />
      )}
    </Panel>
  );
}
export function MeasurementAttention({
  cycleId,
  objectiveId,
}: {
  cycleId?: string;
  objectiveId?: string;
}) {
  const { store, roles } = useStrategy(),
    report = measurementReport(store, roles, todayTehran(), cycleId),
    [all, setAll] = useState(false);
  const findings = objectiveId
    ? report.findings.filter((f) =>
        f.href.includes("/objectives/" + objectiveId),
      )
    : report.findings;
  return (
    <Panel
      title="نیازمند توجه · نتایج کلیدی"
      caption="قواعد اندازه‌گیری؛ موارد شدیدتر در ابتدا نمایش داده می‌شوند."
    >
      {findings.length ? (
        <>
          <ul className="st-findings">
            {findings.slice(0, all ? undefined : 5).map((f) => (
              <li key={f.id}>
                <Link href={f.href}>{f.text}</Link>
              </li>
            ))}
          </ul>
          {findings.length > 5 && (
            <Button secondary onClick={() => setAll(!all)}>
              {all
                ? "نمایش کمتر"
                : `نمایش همه ${findings.length.toLocaleString("fa-IR")} مورد`}
            </Button>
          )}
        </>
      ) : (
        <Empty>
          هشدار اندازه‌گیری ثبت نشده است. نبود نتیجه یا دوره فعال، عملکرد موفق
          محسوب نمی‌شود.
        </Empty>
      )}
    </Panel>
  );
}
export function StrategyMeasurementSummary() {
  const { store, roles } = useStrategy(),
    r = measurementReport(store, roles, todayTehran());
  return (
    <>
      <Panel
        title="وضعیت فعلی اندازه‌گیری"
        caption="میانگین برابر اهداف فعالِ دارای پیشرفت معتبر؛ اهداف بدون داده صفر محسوب نمی‌شوند."
      >
        <div className="st-metrics">
          {[
            ["اهداف فعال", r.activeObjectives],
            ["کل نتایج دوره", r.totalKRs],
            ["پیشرفت اهداف فعال", r.progress],
            ["پوشش پیشرفت اهداف", r.progressCoverage],
            ["در مسیر", r.counts.onTrack],
            ["در معرض ریسک", r.counts.atRisk],
            ["خارج از مسیر", r.counts.offTrack],
            ["اطمینان پایین", r.counts.lowConfidence],
          ].map(([label, n]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>
                {krNumber(n as number | null)}
                {String(label).includes("پیشرفت") && n !== null ? "٪" : ""}
              </strong>
            </div>
          ))}
        </div>
        <p>
          کامل بودن داده نتایج: {krNumber(r.completeness)}٪ · شمارش وضعیت‌ها
          مربوط به اهداف فعال است.
        </p>
        {r.progress === null && (
          <p>هنوز پیشرفت قابل محاسبه‌ای برای اهداف فعال وجود ندارد.</p>
        )}
        <Link href="/strategy/key-results">
          مشاهده و به‌روزرسانی نتایج کلیدی
        </Link>
      </Panel>
      <MeasurementAttention />
    </>
  );
}
export function KeyResultsPage({
  initialCycleId,
  initialKRId,
}: {
  initialCycleId?: string;
  initialKRId?: string;
}) {
  const { store, roles } = useStrategy(),
    [cycleId, setCycle] = useState(
      initialCycleId ??
        store.keyResults?.find((k) => k.id === initialKRId)?.cycleId ??
        store.cycles.find((c) => c.status === "active")?.id ??
        "",
    ),
    [focusedKR, setFocusedKR] = useState(initialKRId),
    [objectiveId, setObjective] = useState(""),
    [owner, setOwner] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [confidence, setConfidence] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("deadline"),
    [cancelled, showCancelled] = useState(false),
    [edit, setEdit] = useState<{ k: KeyResult; measurement: boolean } | null>(
      null,
    );
  const objective = store.objectives.find((o) => o.id === objectiveId),
    today = todayTehran();
  const list = (store.keyResults ?? []).filter(
    (k) =>
      (!focusedKR || k.id === focusedKR) &&
      (!cycleId || k.cycleId === cycleId) &&
      (!objectiveId || k.objectiveId === objectiveId) &&
      (!owner || k.ownerRoleId === owner) &&
      (!type || k.type === type) &&
      (cancelled || k.lifecycle === "active") &&
      (!status ||
        (calculateKRStatus(k, today).status ?? "unknown") === status) &&
      (!confidence ||
        (confidence === "missing"
          ? k.confidence === null
          : confidence === "low"
            ? k.confidence !== null && k.confidence <= 3
            : confidence === "medium"
              ? k.confidence !== null && k.confidence >= 4 && k.confidence <= 6
              : k.confidence !== null && k.confidence >= 7)) &&
      (!search ||
        (k.title + " " + k.code)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())),
  );
  const effectiveWeight = (k: KeyResult) =>
    weightInfo(
      (store.keyResults ?? []).filter((x) => x.objectiveId === k.objectiveId),
      store.objectives.find((o) => o.id === k.objectiveId)?.krWeightMode ??
        "equal",
    ).weights.find((w) => w.id === k.id)?.weight ?? -1;
  const severity = {
    offTrack: 0,
    atRisk: 1,
    notStarted: 2,
    onTrack: 3,
    achieved: 4,
    unknown: 5,
  };
  list.sort((a, b) =>
    sort === "progress"
      ? (calculateKRProgress(b) ?? -1) - (calculateKRProgress(a) ?? -1)
      : sort === "confidence"
        ? (a.confidence ?? 11) - (b.confidence ?? 11)
        : sort === "weight"
          ? effectiveWeight(b) - effectiveWeight(a)
          : sort === "status"
            ? severity[calculateKRStatus(a, today).status ?? "unknown"] -
              severity[calculateKRStatus(b, today).status ?? "unknown"]
            : (a.deadline || "9999").localeCompare(b.deadline || "9999"),
  );
  return (
    <>
      <div className="sys-page-title">
        <div>
          <h2>نتایج کلیدی</h2>
          <p>
            شواهد قابل اندازه‌گیری برای تحقق اهداف؛ ابتدا هدف را انتخاب کنید.
          </p>
        </div>
        <Button
          disabled={
            !objective ||
            krReadOnly(store, {
              objectiveId: objective.id,
              cycleId: objective.cycleId,
            })
          }
          onClick={() =>
            objective &&
            setEdit({ k: newKR(store, objective), measurement: false })
          }
        >
          افزودن نتیجه کلیدی
        </Button>
      </div>
      {focusedKR && (
        <Button secondary onClick={() => setFocusedKR(undefined)}>
          نمایش همه نتایج این دوره
        </Button>
      )}
      <div className="kr-filters">
        <Field label="جست‌وجوی نتیجه">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="عنوان یا کد"
          />
        </Field>
        <Field label="دوره">
          <select
            value={cycleId}
            onChange={(e) => {
              setCycle(e.target.value);
              setFocusedKR(undefined);
              setObjective("");
            }}
          >
            <option value="">همه دوره‌ها</option>
            {store.cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="هدف">
          <select
            value={objectiveId}
            onChange={(e) => setObjective(e.target.value)}
          >
            <option value="">همه اهداف</option>
            {store.objectives
              .filter((o) => !cycleId || o.cycleId === cycleId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {o.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="مالک نتیجه">
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">همه نقش‌ها</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وضعیت محاسبه‌شده">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(krStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            <option value="unknown">داده کافی نیست</option>
          </select>
        </Field>
        <Field label="نوع نتیجه">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">همه انواع</option>
            {Object.entries(krTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اطمینان">
          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            <option value="">همه</option>
            <option value="low">پایین (۱–۳)</option>
            <option value="medium">متوسط (۴–۶)</option>
            <option value="high">خوب و بالا (۷–۱۰)</option>
            <option value="missing">ثبت نشده</option>
          </select>
        </Field>
        <Field label="مرتب‌سازی">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="deadline">نزدیک‌ترین مهلت</option>
            <option value="progress">بیشترین پیشرفت</option>
            <option value="confidence">کمترین اطمینان</option>
            <option value="weight">بیشترین وزن مؤثر</option>
            <option value="status">شدت وضعیت</option>
          </select>
        </Field>
      </div>
      <label>
        <input
          type="checkbox"
          checked={cancelled}
          onChange={(e) => showCancelled(e.target.checked)}
        />{" "}
        نمایش نتایج لغوشده
      </label>
      <p>{list.length.toLocaleString("fa-IR")} نتیجه</p>
      <div className="st-cards kr-cards">
        {list.map((k) => (
          <KRCard
            kr={k}
            key={k.id}
            onEdit={(k, measurement) => setEdit({ k, measurement })}
          />
        ))}
      </div>
      {!list.length && (
        <Empty>
          نتیجه‌ای مطابق این فیلترها وجود ندارد. برای ایجاد، دوره و هدف را
          انتخاب کنید.
        </Empty>
      )}
      {edit && (
        <KREditor
          initial={edit.k}
          measurement={edit.measurement}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
