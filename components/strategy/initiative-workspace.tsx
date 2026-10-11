"use client";
import { reviewDate as tehranDay } from "@/lib/strategy/adapt/definition";
import {ChangeHistory,InitiativeLearningHistory} from './adapt-workspace';
import { useState } from "react";
import Link from "next/link";
import { Button, Field, Panel, Empty } from "@/components/system/ui";
import { useStrategy } from "./provider";
import { dateLabel, roleName, todayTehran } from "@/lib/strategy/model";
import {
  initiativeStatuses,
  initiativePriorities,
  effectivenessLabels,
  effortLabels,
  type StrategicInitiative,
} from "@/lib/strategy/initiatives/types";
import {
  portfolioSummary,
  initiativeDeadlineRisk,
  isInitiativeOverdue,
  initiativeKRSignals,
  initiativeReadOnly,
  ownerInitiativeLoad,
  isInitiativeActive,
} from "@/lib/strategy/initiatives/report";
import { initiativeQuality } from "@/lib/strategy/initiatives/validation";
import {
  calculateKRProgress,
  calculateKRStatus,
} from "@/lib/strategy/kr/calculations";
import { krStatuses } from "@/lib/strategy/kr/types";
import { InitiativeEditor } from "./initiative-editor";
import {
  InitiativeAttention,
  initiativeNumber as n,
  InitiativeSummary,
} from "./initiative-summary";
import { Options } from "./editors";
function Impact({ initiative: i }: { initiative: StrategicInitiative }) {
  return (
    <>
      {i.impactType === "unknown"
        ? "هنوز مشخص نشده"
        : i.impactType === "numeric"
          ? `${n(i.expectedImpactValue)} ${i.expectedImpactUnit}`
          : i.expectedImpact}
      {i.impactType === "numeric" && i.expectedImpact && (
        <span> · {i.expectedImpact}</span>
      )}
    </>
  );
}
export function InitiativeWorkspace({
  id,
  initialCycleId = "",
  initialObjectiveId = "",
  initialKRId = "",
}: {
  id?: string;
  initialCycleId?: string;
  initialObjectiveId?: string;
  initialKRId?: string;
}) {
  const { store, roles } = useStrategy(),
    today = todayTehran();
  const [cycleId, setCycle] = useState(
      initialCycleId ||
        store.cycles.find((c) => c.status === "active")?.id ||
        "",
    ),
    [objectiveId, setObjective] = useState(initialObjectiveId),
    [krId, setKR] = useState(initialKRId),
    [owner, setOwner] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [effectiveness, setEffectiveness] = useState(""),
    [overdue, setOverdue] = useState(false),
    [blocked, setBlocked] = useState(false),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("priority"),
    [edit, setEdit] = useState<{
      i: StrategicInitiative;
      execution: boolean;
    } | null>(null);
  function create() {
    const now = new Date().toISOString(),
      c = store.cycles.find((c) => c.id === cycleId),
      k = store.keyResults?.find(
        (k) =>
          k.id === krId &&
          k.cycleId === cycleId &&
          (!objectiveId || k.objectiveId === objectiveId),
      );
    let code = 1;
    while (
      store.initiatives?.some(
        (i) => i.cycleId === cycleId && i.code === `I${code}`,
      )
    )
      code++;
    setEdit({
      execution: false,
      i: {
        id: crypto.randomUUID(),
        cycleId,
        objectiveId: k?.objectiveId ?? objectiveId,
        keyResultId: k?.id ?? "",
        code: `I${code}`,
        title: "",
        description: "",
        ownerRoleId: "",
        hypothesis: "",
        expectedImpact: "",
        actualImpact: "",
        impactType: "unknown",
        expectedImpactValue: null,
        expectedImpactUnit: "",
        priority: "medium",
        status: "proposed",
        progress: 0,
        effectiveness: "notEvaluated",
        startDate: c?.startDate ?? "",
        dueDate: c?.endDate ?? "",
        blockedReason: "",
        notes: "",
        createdAt: now,
        updatedAt: now,
        effort: "unknown",
        impactLevel: "unknown",
      },
    });
  }
  const items = (store.initiatives ?? []).filter(
      (i) => !cycleId || i.cycleId === cycleId,
    ),
    summary = portfolioSummary(items, today);
  const list = items.filter(
    (i) =>
      (!objectiveId || i.objectiveId === objectiveId) &&
      (!krId || i.keyResultId === krId) &&
      (!owner || i.ownerRoleId === owner) &&
      (!status || i.status === status) &&
      (!priority || i.priority === priority) &&
      (!effectiveness || i.effectiveness === effectiveness) &&
      (!overdue || isInitiativeOverdue(i, today)) &&
      (!blocked || i.status === "blocked") &&
      (!search ||
        (i.title + " " + i.code)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())),
  );
  const priorities = { critical: 0, high: 1, medium: 2, low: 3 },
    statuses = {
      blocked: 0,
      inProgress: 1,
      planned: 2,
      proposed: 3,
      completed: 4,
      cancelled: 5,
    },
    effects = {
      ineffective: 0,
      weak: 1,
      notEvaluated: 2,
      promising: 3,
      effective: 4,
    };
  list.sort((a, b) =>
    sort === "progress"
      ? b.progress - a.progress
      : sort === "status"
        ? statuses[a.status] - statuses[b.status]
        : sort === "effectiveness"
          ? effects[a.effectiveness] - effects[b.effectiveness]
          : sort === "updated"
            ? b.updatedAt.localeCompare(a.updatedAt)
            : sort === "due"
              ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
              : priorities[a.priority] - priorities[b.priority] ||
                a.code.localeCompare(b.code),
  );
  const opened = id ? store.initiatives?.find((i) => i.id === id) : null;
  if (id && !opened)
    return (
      <Panel title="اقدام پیدا نشد">
        <p>این اقدام در داده‌های همین مرورگر وجود ندارد.</p>
        <Link href="/strategy/initiatives">بازگشت به سبد اقدامات</Link>
      </Panel>
    );
  const editors = edit && (
    <InitiativeEditor
      initial={edit.i}
      execution={edit.execution}
      onClose={() => setEdit(null)}
    />
  );
  if (opened) {
    const i = opened,
      kr = store.keyResults?.find((k) => k.id === i.keyResultId),
      o = store.objectives.find((o) => o.id === i.objectiveId),
      p = store.priorities.find((p) => p.id === o?.relatedPriorityId),
      q = initiativeQuality(i, store, roles),
      pacing = kr ? calculateKRStatus(kr, today) : null,
      signals = initiativeKRSignals(i, store, today),
      risk = initiativeDeadlineRisk(i, today),
      locked = initiativeReadOnly(store, i);
    return (
      <>
        <div className="sys-page-title">
          <div>
            <Link href="/strategy/initiatives">سبد اقدامات</Link>
            <h2>
              {i.code} · {i.title}
            </h2>
            <p>
              {initiativeStatuses[i.status]} · اهمیت اجرا:{" "}
              {initiativePriorities[i.priority]}
            </p>
          </div>
          <div className="st-actions">
            <Button
              disabled={locked}
              onClick={() => setEdit({ i, execution: true })}
            >
              به‌روزرسانی اجرا و اثر
            </Button>
            <Button
              secondary
              disabled={locked}
              onClick={() => setEdit({ i, execution: false })}
            >
              ویرایش اقدام
            </Button>
          </div>
        </div>
        <div className="st-grid">
          <Panel title="نمای اقدام">
            <p>{i.description || "شرحی ثبت نشده است."}</p>
            <p>نقش مالک: {roleName(i.ownerRoleId, roles)}</p>
            <p>
              فرد فعلی نقش:{" "}
              {roles.find((r) => r.id === i.ownerRoleId)?.personName ??
                "تخصیص داده نشده"}
            </p>
            <p>
              {dateLabel(i.startDate)} تا {dateLabel(i.dueDate)}
            </p>
            <p>
              اثر تخمینی {effortLabels[i.impactLevel]} · تلاش{" "}
              {effortLabels[i.effort]}
            </p>
            {locked && (
              <p className="st-notice">
                دوره بسته است؛ اطلاعات فقط خواندنی است.
              </p>
            )}
          </Panel>
          <Panel title="هم‌راستایی استراتژیک">
            <ol className="in-alignment">
              <li>اولویت: {p?.title ?? "انتخاب نشده"}</li>
              <li>
                هدف:{" "}
                {o ? (
                  <Link
                    href={`/strategy/cycles/${o.cycleId}/objectives/${o.id}`}
                  >
                    {o.code} · {o.title}
                  </Link>
                ) : (
                  "انتخاب نشده"
                )}
              </li>
              <li>
                نتیجه کلیدی:{" "}
                {kr ? (
                  <Link
                    href={`/strategy/cycles/${kr.cycleId}/objectives/${kr.objectiveId}#kr-${kr.id}`}
                  >
                    {kr.code} · {kr.title}
                  </Link>
                ) : (
                  "این اقدام هنوز به نتیجه کلیدی مشخصی متصل نشده است."
                )}
              </li>
              <li>اقدام: {i.title}</li>
            </ol>
          </Panel>
        </div>
        <Panel
          title="فرضیه اثرگذاری"
          caption="چرا فکر می‌کنیم این اقدام، نتیجه کلیدی را حرکت می‌دهد؟"
        >
          <p className="in-hypothesis">
            {i.hypothesis || "هنوز نوشته نشده است."}
          </p>
        </Panel>
        <div className="st-grid">
          <Panel title="اجرا">
            <div className="kr-progress">
              <strong>{n(i.progress)}٪</strong>
              <progress
                max={100}
                value={i.progress}
                aria-label="پیشرفت اجرای اقدام"
              />
            </div>
            <p>{initiativeStatuses[i.status]}</p>
            <p>
              شروع اجرا:{" "}
              {i.startedAt ? dateLabel(tehranDay(i.startedAt)) : "ثبت نشده"}
            </p>
            <p>
              آخرین ثبت تکمیل:{" "}
              {i.completedAt
                ? dateLabel(tehranDay(i.completedAt))
                : "ثبت نشده"}
            </p>
            <small>تکمیل اجرا به معنی موفقیت نتیجه نیست.</small>
          </Panel>
          <Panel
            title="وضعیت KR مرتبط"
            caption="زمینه نتیجه؛ اثر قطعی اقدام نیست"
          >
            {kr ? (
              <>
                <p>{kr.title}</p>
                <div className="st-metrics">
                  <div>
                    <span>شروع KR</span>
                    <strong>{n(kr.startValue)}</strong>
                  </div>
                  <div>
                    <span>فعلی</span>
                    <strong>
                      {kr.type === "milestone"
                        ? "مرحله‌ای"
                        : n(kr.currentValue)}
                    </strong>
                  </div>
                  <div>
                    <span>هدف</span>
                    <strong>{n(kr.targetValue)}</strong>
                  </div>
                  <div>
                    <span>پیشرفت KR</span>
                    <strong>{n(calculateKRProgress(kr))}٪</strong>
                  </div>
                </div>
                <p>
                  {pacing?.status
                    ? krStatuses[pacing.status]
                    : "داده کافی نیست"}{" "}
                  · اطمینان {n(kr.confidence)} / ۱۰ · {kr.unit}
                </p>
                {i.baselineCapturedAt ? (
                  <p>
                    هنگام آغاز ثبت‌شده اقدام: مقدار{" "}
                    {n(i.krValueAtStart ?? null)} و پیشرفت{" "}
                    {n(i.krProgressAtStart ?? null)}٪. این ثبت، تاریخچه هفتگی یا
                    اثبات اثر نیست.
                  </p>
                ) : (
                  <p>
                    مبنای آغاز اجرا هنوز ثبت نشده است؛ تغییر نسبت به آغاز را حدس
                    نمی‌زنیم.
                  </p>
                )}
              </>
            ) : (
              <Empty>ابتدا یک نتیجه قابل اندازه‌گیری انتخاب کنید.</Empty>
            )}
          </Panel>
        </div>
        <div className="st-grid">
          <Panel title="اثر مورد انتظار">
            <p>
              <Impact initiative={i} />
            </p>
          </Panel>
          <Panel title="اثر واقعی و اثربخشی">
            <span className="st-tag">
              {effectivenessLabels[i.effectiveness]}
            </span>
            <p>{i.actualImpact || "اثر واقعی هنوز ثبت نشده است."}</p>
            <small>ارزیابی دستی مدیریت؛ مستقل از پیشرفت اجرا.</small>
          </Panel>
        </div>
        <Panel title="ریسک‌ها، موانع و کیفیت">
          <p>
            {risk.overdue
              ? "مهلت گذشته است."
              : risk.dueSoon
                ? "مهلت در هفت روز آینده است."
                : "هشدار فوری مهلت وجود ندارد."}
          </p>
          {i.blockedReason && (
            <p>
              {i.status === "blocked" ? "دلیل توقف" : "آخرین مانع ثبت‌شده"}:{" "}
              {i.blockedReason}
            </p>
          )}
          {signals.map((f) => (
            <p key={f.id} className="st-notice">
              {f.text}
            </p>
          ))}
          <p>کیفیت: {q.label}</p>
          <ul>
            {[...q.missing, ...q.warnings].map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="یادداشت‌ها">
          <p>{i.notes || "یادداشتی ثبت نشده است."}</p>
        </Panel>
        <ChangeHistory entityId={i.id}/>
        <InitiativeLearningHistory id={i.id}/>
        {o && (
          <InitiativeSummary cycleId={i.cycleId} objectiveId={i.objectiveId} />
        )}{" "}
        {editors}
      </>
    );
  }
  return (
    <>
      <div className="sys-page-title">
        <div>
          <h2>سبد اقدامات استراتژیک</h2>
          <p>
            فرضیه‌های اجرا برای حرکت‌دادن نتایج؛ ابتدا نتیجه قابل اندازه‌گیری را
            مشخص کنید.
          </p>
        </div>
        <Button onClick={create}>افزودن اقدام</Button>
      </div>
      <div className="st-metrics in-metrics">
        {[
          ["کل اقدامات", summary.total],
          ["فعال هم‌زمان", summary.active],
          ["متوقف‌شده", summary.blocked],
          ["عقب‌افتاده", summary.overdue],
          ["تکمیل‌شده", summary.completed],
          ["موثر", summary.effective],
          ["نیازمند ارزیابی", summary.needsEvaluation],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{n(value as number)}</strong>
          </div>
        ))}
      </div>
      <small>
        خلاصه مربوط به کل دوره انتخاب‌شده است؛ فیلترهای دیگر فقط فهرست را محدود
        می‌کنند. فعال یعنی در حال اجرا یا متوقف‌شده.
      </small>
      <div className="kr-filters">
        <Field label="جست‌وجوی اقدام">
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="دوره سبد">
          <select
            value={cycleId}
            onChange={(e) => {
              setCycle(e.target.value);
              setObjective("");
              setKR("");
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
        <Field label="هدف سبد">
          <select
            value={objectiveId}
            onChange={(e) => {
              setObjective(e.target.value);
              setKR("");
            }}
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
        <Field label="نتیجه کلیدی سبد">
          <select value={krId} onChange={(e) => setKR(e.target.value)}>
            <option value="">همه نتایج</option>
            {(store.keyResults ?? [])
              .filter(
                (k) =>
                  (!cycleId || k.cycleId === cycleId) &&
                  (!objectiveId || k.objectiveId === objectiveId),
              )
              .map((k) => (
                <option key={k.id} value={k.id}>
                  {k.code} · {k.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="مالک اقدام">
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">همه نقش‌ها</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="فیلتر وضعیت اقدام">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            <Options items={initiativeStatuses} />
          </select>
        </Field>
        <Field label="فیلتر اهمیت اجرا">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">همه اهمیت‌ها</option>
            <Options items={initiativePriorities} />
          </select>
        </Field>
        <Field label="فیلتر اثربخشی">
          <select
            value={effectiveness}
            onChange={(e) => setEffectiveness(e.target.value)}
          >
            <option value="">همه ارزیابی‌ها</option>
            <Options items={effectivenessLabels} />
          </select>
        </Field>
        <Field label="ترتیب اقدامات">
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="priority">اهمیت اجرایی</option>
            <option value="due">نزدیک‌ترین مهلت</option>
            <option value="progress">بیشترین پیشرفت اجرا</option>
            <option value="effectiveness">کمترین اثربخشی</option>
            <option value="status">وضعیت اجرا</option>
            <option value="updated">تازه‌ترین تغییر</option>
          </select>
        </Field>
      </div>
      <div className="st-actions">
        <label>
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => setOverdue(e.target.checked)}
          />{" "}
          فقط عقب‌افتاده
        </label>
        <label>
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
          />{" "}
          فقط متوقف‌شده
        </label>
      </div>
      <p>{n(list.length)} اقدام در فهرست</p>
      <div className="st-cards kr-cards">
        {list.map((i) => {
          const o = store.objectives.find((o) => o.id === i.objectiveId),
            k = store.keyResults?.find((k) => k.id === i.keyResultId);
          return (
            <article className="st-card in-card" key={i.id}>
              <div className="st-card-top">
                <b>{i.code}</b>
                <span className="st-tag">{initiativeStatuses[i.status]}</span>
              </div>
              <h3>
                <Link href={"/strategy/initiatives/" + i.id}>{i.title}</Link>
              </h3>
              <p>
                هدف: {o?.title ?? "بدون هدف"}
                <br />
                KR: {k?.title ?? "هنوز متصل نشده"}
              </p>
              <p>
                {roleName(i.ownerRoleId, roles)} ·{" "}
                {roles.find((r) => r.id === i.ownerRoleId)?.personName ??
                  "بدون فرد تخصیص‌یافته"}
              </p>
              <p>
                اهمیت اجرا: {initiativePriorities[i.priority]} · مهلت{" "}
                {dateLabel(i.dueDate)}
              </p>
              <div className="kr-progress">
                <strong>{n(i.progress)}٪</strong>
                <progress
                  max={100}
                  value={i.progress}
                  aria-label={"پیشرفت " + i.code}
                />
              </div>
              <p>اثربخشی: {effectivenessLabels[i.effectiveness]}</p>
              <small>
                اثر تخمینی {effortLabels[i.impactLevel]} / تلاش{" "}
                {effortLabels[i.effort]}
              </small>
              <div className="st-actions">
                <Link href={"/strategy/initiatives/" + i.id}>
                  باز کردن اقدام
                </Link>
                <Button
                  secondary
                  disabled={initiativeReadOnly(store, i)}
                  onClick={() => setEdit({ i, execution: true })}
                >
                  به‌روزرسانی {i.code}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <Empty>
          هنوز برای نتایج کلیدی این دوره اقدامی تعریف نشده یا فیلترها نتیجه‌ای
          ندارند.
        </Empty>
      )}
      <Panel title="ظرفیت و تمرکز اجرا">
        <p>تعداد فعال هم‌زمان: {n(summary.active)}</p>
        {ownerInitiativeLoad(items).map((load) => (
          <p key={load.ownerRoleId}>
            {roleName(load.ownerRoleId, roles)}: {n(load.count)}{" "}
            {load.overloaded
              ? "· تمرکز اجرای استراتژی روی این نقش بالاست."
              : ""}
          </p>
        ))}
        {[
          ...new Set(
            items.filter(isInitiativeActive).map((i) => i.objectiveId),
          ),
        ].map((oid) => (
          <p key={oid}>
            {store.objectives.find((o) => o.id === oid)?.title ?? "هدف ناموجود"}
            :{" "}
            {n(
              items.filter(
                (i) => i.objectiveId === oid && isInitiativeActive(i),
              ).length,
            )}{" "}
            اقدام فعال
          </p>
        ))}
      </Panel>
      {cycleId && <InitiativeAttention cycleId={cycleId} />} {editors}
    </>
  );
}
