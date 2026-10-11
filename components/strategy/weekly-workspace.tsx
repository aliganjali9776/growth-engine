"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Panel, Field, Empty, Drawer } from "@/components/system/ui";
import { useStrategy } from "./provider";
import { todayTehran, dateLabel, roleName } from "@/lib/strategy/model";
import {
  krStatuses,
  objectiveHealthLabels,
  type KeyResult,
} from "@/lib/strategy/kr/types";
import {
  calculateKRProgress,
  calculateKRStatus,
} from "@/lib/strategy/kr/calculations";
import { initiativeStatuses } from "@/lib/strategy/initiatives/types";
import { isInitiativeOverdue } from "@/lib/strategy/initiatives/report";
import {
  getCycleWeek,
  weekPeriod,
  weeklyComparison,
  weeklyMomentum,
} from "@/lib/strategy/weekly/calculations";
import {
  createStrategySnapshot,
  weeklyReviewSignals,
  reviewCompletionWarnings,
} from "@/lib/strategy/weekly/report";
import {
  createWeeklyReview,
  saveReviewNotes,
  completeWeeklyReview,
  reopenWeeklyReview,
} from "@/lib/strategy/weekly/mutations";
import { movementLabels } from "@/lib/strategy/weekly/types";
import { initiativeNumber as n } from "./initiative-summary";
import { WeeklyHistory } from "./weekly-history";
import {
  CheckInEditor,
  ReviewNotesEditor,
  DecisionEditor,
} from "./weekly-editors";
export function WeeklyWorkspace({
  reviewId,
  initialCycleId,
}: {
  reviewId?: string;
  initialCycleId?: string;
}) {
  const { store, roles, commit } = useStrategy(),
    router = useRouter(),
    today = todayTehran(),
    [cycleId, setCycle] = useState(
      initialCycleId ??
        store.cycles.find((c) => c.status === "active")?.id ??
        store.cycles[0]?.id ??
        "",
    ),
    [chosenWeek, setWeek] = useState(""),
    [error, setError] = useState(""),
    [tab, setTab] = useState("review"),
    [editingKR, setEditingKR] = useState<KeyResult | null>(null),
    [notes, setNotes] = useState(false),
    [decision, setDecision] = useState(false),
    [confirmComplete, setConfirmComplete] = useState(false),
    [ack, setAck] = useState(false),
    [confirmReopen, setConfirmReopen] = useState(false);
  const review = store.weeklyReviews?.find((r) => r.id === reviewId),
    cycle = store.cycles.find((c) => c.id === (review?.cycleId ?? cycleId));
  function act(fn: () => void) {
    try {
      setError("");
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات انجام نشد.");
    }
  }
  if (reviewId && !review)
    return (
      <Panel title="مرور پیدا نشد">
        <p>این مرور در داده‌های همین مرورگر وجود ندارد.</p>
        <Link href="/strategy/weekly-review">بازگشت به مرور هفتگی</Link>
      </Panel>
    );
  if (!cycle)
    return (
      <Panel title="مرور هفتگی">
        <Empty>ابتدا یک دوره استراتژیک بسازید.</Empty>
        <Link href="/strategy/cycles">دوره‌ها</Link>
      </Panel>
    );
  const clock = getCycleWeek(cycle, today),
    weekNumber =
      Number(chosenWeek) ||
      (clock.weekNumber ?? (clock.phase === "after" ? clock.totalWeeks : 1)),
    reviews = (store.weeklyReviews ?? [])
      .filter((r) => r.cycleId === cycle.id)
      .sort((a, b) => b.weekNumber - a.weekNumber),
    closed = ["completed", "archived"].includes(cycle.status),
    newer = review && reviews.some((r) => r.weekNumber > review.weekNumber),
    readOnly = closed || !!newer || review?.status === "completed";
  if (!review)
    return (
      <>
        <div className="sys-page-title">
          <div>
            <h2>مرور هفتگی استراتژی</h2>
            <p>نتیجه چه تغییری کرد، چه چیزی مانع شد و قدم بعدی چیست؟</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="st-notice">
            {error}
          </p>
        )}
        <div className="kr-filters">
          <Field label="دوره مرور">
            <select
              value={cycle.id}
              onChange={(e) => {
                setCycle(e.target.value);
                setWeek("");
              }}
            >
              {store.cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="هفته مرور">
            <select
              value={weekNumber}
              onChange={(e) => setWeek(e.target.value)}
            >
              {Array.from({ length: clock.totalWeeks }, (_, i) => i + 1).map(
                (w) => {
                  const p = weekPeriod(cycle, w);
                  return (
                    <option key={w} value={w} disabled={p.periodStart > today}>
                      هفته {n(w)} · {dateLabel(p.periodStart)} تا{" "}
                      {dateLabel(p.periodEnd)}
                    </option>
                  );
                },
              )}
            </select>
          </Field>
        </div>
        <p>
          {clock.phase === "before"
            ? "دوره هنوز آغاز نشده است."
            : clock.phase === "after"
              ? "دوره پایان یافته؛ مرورهای گذشته قابل مشاهده‌اند."
              : `اکنون هفته ${n(clock.weekNumber)} از ${n(clock.totalWeeks)} است.`}
        </p>
        <Button
          disabled={
            clock.phase === "before" ||
            (closed && !reviews.some((r) => r.weekNumber === weekNumber))
          }
          onClick={() =>
            act(() => {
              const existing = reviews.find((r) => r.weekNumber === weekNumber);
              if (existing) {
                router.push("/strategy/weekly-review/" + existing.id);
                return;
              }
              const id = crypto.randomUUID();
              commit(
                createWeeklyReview(
                  store,
                  cycle.id,
                  weekNumber,
                  id,
                  today,
                  new Date().toISOString(),
                ),
              );
              router.push("/strategy/weekly-review/" + id);
            })
          }
        >
          {reviews.some((r) => r.weekNumber === weekNumber)
            ? "باز کردن مرور هفته"
            : "آغاز مرور هفته"}
        </Button>
        <div className="kr-editor-tabs" role="group" aria-label="نمای مرور">
          <button
            onClick={() => setTab("review")}
            aria-pressed={tab === "review"}
          >
            آرشیو مرورها
          </button>
          <button
            onClick={() => setTab("history")}
            aria-pressed={tab === "history"}
          >
            تاریخچه هفتگی
          </button>
        </div>
        {tab === "history" ? (
          <WeeklyHistory cycleId={cycle.id} />
        ) : (
          <Panel title="آرشیو مرورها">
            {reviews.length ? (
              reviews.map((r) => {
                const s = store.strategyWeeklySnapshots?.find(
                  (s) => s.reviewId === r.id,
                );
                return (
                  <article className="st-card" key={r.id}>
                    <Link href={"/strategy/weekly-review/" + r.id}>
                      هفته {n(r.weekNumber)} ·{" "}
                      {r.status === "completed"
                        ? "تکمیل‌شده"
                        : r.reopenedAt
                          ? "بازگشایی‌شده"
                          : "پیش‌نویس"}
                    </Link>
                    <p>
                      {s
                        ? `پوشش ${n(s.checkInCompletion)}٪ · نتیجه ${n(s.overallProgress)}٪ · اطمینان ${n(s.averageConfidence)}`
                        : "هنوز تصویر نهایی ثبت نشده"}
                    </p>
                    {s && (
                      <small>
                        {s.mainRisk}
                        {r.status === "draft"
                          ? " · مقادیر مربوط به آخرین تکمیل هستند"
                          : ""}
                      </small>
                    )}
                  </article>
                );
              })
            ) : (
              <Empty>
                هنوز مروری ثبت نشده است. هیچ تاریخچه فرضی برای این دوره ساخته
                نمی‌شود.
              </Empty>
            )}
          </Panel>
        )}
      </>
    );
  const frozen = store.strategyWeeklySnapshots?.find(
      (s) => s.reviewId === review.id,
    ),
    snapshot =
      review.status === "completed" && frozen
        ? frozen
        : createStrategySnapshot(
            store,
            review,
            roles,
            today,
            new Date().toISOString(),
          ),
    data = weeklyReviewSignals(store, review, today),
    ins = (store.krCheckIns ?? []).filter((i) => i.reviewId === review.id),
    krs = review.status === "completed" ? snapshot.krContext : data.krs,
    previousReview = reviews.find(
      (r) => r.status === "completed" && r.weekNumber < review.weekNumber,
    ),
    previous = store.strategyWeeklySnapshots?.find(
      (s) => s.reviewId === previousReview?.id,
    ),
    comparison = weeklyComparison(snapshot, previous),
    momentum = weeklyMomentum(snapshot, previous),
    decisions = (store.strategyDecisions ?? []).filter(
      (d) => d.reviewId === review.id,
    ),
    warnings = reviewCompletionWarnings(store, review, today),
    labels: Record<string, string> = {
      overallProgress: "پیشرفت استراتژی",
      averageConfidence: "میانگین اطمینان",
      onTrack: "در مسیر",
      atRisk: "در معرض ریسک",
      offTrack: "خارج از مسیر",
      blockedInitiatives: "اقدامات متوقف",
    };
  return (
    <>
      <Link
        href={`/strategy/weekly-review?cycle=${encodeURIComponent(cycle.id)}`}
      >
        آرشیو و تاریخچه هفتگی
      </Link>
      <div className="sys-page-title">
        <div>
          <h2>مرور هفته {n(review.weekNumber)}</h2>
          <p>
            {cycle.name} · {dateLabel(review.periodStart)} تا{" "}
            {dateLabel(review.periodEnd)}
          </p>
          <span className="st-tag">
            {review.status === "completed"
              ? "تکمیل‌شده و قفل"
              : review.reopenedAt
                ? "بازگشایی‌شده"
                : "پیش‌نویس"}
          </span>
        </div>
        <div className="st-actions">
          {review.status === "completed" ? (
            <Button
              secondary
              disabled={closed || !!newer}
              onClick={() => setConfirmReopen(true)}
            >
              بازگشایی مرور
            </Button>
          ) : (
            <Button
              disabled={readOnly}
              onClick={() => {
                setConfirmComplete(true);
                setAck(false);
              }}
            >
              تکمیل مرور
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="st-notice">
          {error}
        </p>
      )}
      {review.status === "completed" ? (
        <p className="st-notice">
          تصویر ثابت ثبت‌شده در {dateLabel(snapshot.date)}؛ تغییرات بعدی KR،
          اقدام و مالک، این اعداد را تغییر نمی‌دهند. نسخه {n(review.revision)}
        </p>
      ) : (
        <p className="st-notice">
          نمای پیش‌نویس از وضعیت فعلی ساخته می‌شود. ثبت برای هفته گذشته، ثبت
          امروز درباره آن بازه است و سابقه خودکار گذشته محسوب نمی‌شود.
        </p>
      )}
      {newer && (
        <p className="st-notice">
          هفته جدیدتری وجود دارد؛ این مرور فقط خواندنی است تا زنجیره تاریخچه
          تغییر نکند.
        </p>
      )}
      <Panel
        title="پوشش ثبت و کیفیت مرور"
        caption="کیفیت فرایند مدیریت؛ مستقل از عملکرد استراتژی"
      >
        <div className="st-metrics">
          <div>
            <span>نتایج ثبت‌شده</span>
            <strong>
              {n(snapshot.checkedIn)}/{n(snapshot.total)}
            </strong>
          </div>
          <div>
            <span>پوشش ثبت</span>
            <strong>{n(snapshot.checkInCompletion)}٪</strong>
          </div>
          <div>
            <span>کیفیت مرور هفتگی</span>
            <strong>{n(snapshot.quality)}٪</strong>
          </div>
          <div>
            <span>به‌روزرسانی‌نشده</span>
            <strong>{n(snapshot.staleKRIds.length)}</strong>
          </div>
        </div>
        <details>
          <summary>فرمول کیفیت مرور</summary>
          <p>
            پوشش ثبت KR: ۴۰٪ · بررسی نتایج پرریسک: ۲۰٪ · بررسی موانع: ۱۵٪ ·
            تصمیم یا قدم بعدی: ۱۰٪ · تمرکز هفته بعد: ۱۵٪. نبود ریسک یا مانع، بخش
            مربوط را کامل می‌کند.
          </p>
        </details>
      </Panel>
      <Panel
        title="نبض هفتگی استراتژی"
        caption="نتایج ثبت‌نشده نیز با آخرین مقدار شناخته‌شده و علامت به‌روزرسانی‌نشده دیده می‌شوند؛ این مقادیر بررسی‌شده فرض نمی‌شوند."
      >
        <div className="st-metrics">
          <div>
            <span>پیشرفت اهداف</span>
            <strong>{n(snapshot.overallProgress)}٪</strong>
            <small>
              داده معتبر {n(snapshot.objectiveCoverage)}/
              {n(snapshot.objectiveTotal)} هدف
            </small>
          </div>
          <div>
            <span>اطمینان میانگین</span>
            <strong>{n(snapshot.averageConfidence)}</strong>
          </div>
          <div>
            <span>در مسیر</span>
            <strong>{n(snapshot.krStatusCounts.onTrack)}</strong>
          </div>
          <div>
            <span>در معرض ریسک / خارج مسیر</span>
            <strong>
              {n(snapshot.krStatusCounts.atRisk)} /{" "}
              {n(snapshot.krStatusCounts.offTrack)}
            </strong>
          </div>
          <div>
            <span>اقدام فعال / متوقف</span>
            <strong>
              {n(snapshot.activeInitiatives)} / {n(snapshot.blockedInitiatives)}
            </strong>
          </div>
          <div>
            <span>بهبود / پسرفت KR</span>
            <strong>
              {n(snapshot.improved)} / {n(snapshot.regressed)}
            </strong>
          </div>
        </div>
        <p>
          {momentum.label}: {momentum.reason}
        </p>
        <details>
          <summary>
            مقایسه با مرور تکمیل‌شده قبلی{" "}
            {previousReview ? `(هفته ${n(previousReview.weekNumber)})` : ""}
          </summary>
          {previous ? (
            comparison.map((row) => (
              <p key={row.key}>
                {labels[row.key]}: {n(row.previous)} ← {n(row.current)} · تغییر{" "}
                {n(row.delta)}
              </p>
            ))
          ) : (
            <Empty>مرور قبلی وجود ندارد؛ تغییر فرضی نمایش داده نمی‌شود.</Empty>
          )}
        </details>
      </Panel>
      <Panel title="نتایج نیازمند توجه">
        <ul className="st-findings">
          {snapshot.signals.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        {!snapshot.signals.length && <Empty>هشدار اضافی ثبت نشده است.</Empty>}
        {!readOnly &&
          data.riskIds.map((id) => {
            const k = data.krs.find((k) => k.id === id)!;
            return (
              <label key={id} className="wk-check">
                <input
                  type="checkbox"
                  checked={review.reviewedRiskIds.includes(id)}
                  onChange={(e) =>
                    act(() =>
                      commit(
                        saveReviewNotes(
                          store,
                          {
                            ...review,
                            reviewedRiskIds: e.target.checked
                              ? [...review.reviewedRiskIds, id]
                              : review.reviewedRiskIds.filter((x) => x !== id),
                          },
                          today,
                          new Date().toISOString(),
                        ),
                      ),
                    )
                  }
                />
                {k.code} · وضعیت و قدم بعدی را بررسی کردم
              </label>
            );
          })}
      </Panel>
      <Panel
        title="ثبت‌های هفتگی نتایج"
        caption="همه نتایج از همین صفحه؛ بدون مراجعه جداگانه به صفحات KR"
      >
        <div className="st-cards kr-cards">
          {krs.map((k) => {
            const c = ins.find((c) => c.keyResultId === k.id),
              status =
                c?.status ??
                calculateKRStatus(
                  k,
                  review.status === "completed" ? snapshot.date : today,
                ).status;
            return (
              <article key={k.id} className="st-card">
                <h3>
                  {k.code} · {k.title}
                </h3>
                <p>
                  {roleName(c?.ownerRoleId ?? k.ownerRoleId, roles)} ·{" "}
                  {store.objectives.find((o) => o.id === k.objectiveId)?.title}
                </p>
                <span className="st-tag">
                  {c ? "ثبت‌شده" : "به‌روزرسانی نشده"}
                </span>
                <p>
                  قبلی{" "}
                  {n(
                    k.type === "milestone"
                      ? (c?.previousProgress ?? null)
                      : (c?.previousValue ?? null),
                  )}
                  {k.type === "milestone" ? "٪" : ""} ← فعلی{" "}
                  {k.type === "milestone"
                    ? `${n(c?.progress ?? calculateKRProgress(k))}٪ مرحله‌ای`
                    : n(c?.currentValue ?? k.currentValue)}{" "}
                  {k.type === "milestone" ? "" : k.unit}
                </p>
                <p>
                  پیشرفت {n(c?.progress ?? calculateKRProgress(k))}٪ · اطمینان{" "}
                  {n(c?.confidence ?? k.confidence)} ·{" "}
                  {status ? krStatuses[status] : "داده کافی نیست"}
                </p>
                {c && (
                  <>
                    <p>
                      {movementLabels[c.movement]} · تغییر اطمینان{" "}
                      {n(c.confidenceDelta)}
                    </p>
                    {c.blocker && <p>مانع: {c.blocker}</p>}
                    {c.nextAction && <p>قدم بعدی: {c.nextAction}</p>}
                  </>
                )}
                <Button
                  secondary
                  disabled={readOnly}
                  onClick={() => setEditingKR(k)}
                >
                  {c ? "اصلاح ثبت" : "ثبت هفتگی"} {k.code}
                </Button>
              </article>
            );
          })}
        </div>
        {!krs.length && <Empty>نتیجه فعال در هدف فعال وجود ندارد.</Empty>}
      </Panel>
      <Panel
        title="زمینه اجرای اقدامات"
        caption="وضعیت اجرا و نتیجه جداست؛ این نما رابطه علت‌ومعلولی را اثبات نمی‌کند."
      >
        {snapshot.initiativeContext.length ? (
          snapshot.initiativeContext.map((i) => {
            const began = i.startedAt
                ? new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Tehran",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(i.startedAt))
                : null,
              ended = i.completedAt
                ? new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Tehran",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(i.completedAt))
                : null;
            return (
              <article key={i.id} className="wk-initiative">
                <Link href={"/strategy/initiatives/" + i.id}>
                  {i.code} · {i.title}
                </Link>
                <p>
                  {initiativeStatuses[i.status]} · اجرا {n(i.progress)}٪{" "}
                  {isInitiativeOverdue(i, snapshot.date) ? "· عقب‌افتاده" : ""}
                  {began &&
                  began >= review.periodStart &&
                  began <= review.periodEnd
                    ? " · آغاز در این هفته"
                    : ""}
                  {ended &&
                  ended >= review.periodStart &&
                  ended <= review.periodEnd
                    ? " · تکمیل در این هفته"
                    : ""}
                </p>
                {i.blockedReason && i.status === "blocked" && (
                  <p>{i.blockedReason}</p>
                )}
              </article>
            );
          })
        ) : (
          <Empty>اقدامی برای این دوره ثبت نشده است.</Empty>
        )}
      </Panel>
      <div className="st-grid">
        <Panel title="بردهای هفته">
          {[...ins.map((i) => i.win), ...review.wins]
            .filter(Boolean)
            .map((s, i) => (
              <p key={i}>{s}</p>
            ))}
        </Panel>
        <Panel title="موانع تجمیع‌شده">
          {snapshot.blockers.length ? (
            snapshot.blockers.map((b, i) => (
              <p key={i}>
                <strong>{b.title}</strong>: {b.text}
              </p>
            ))
          ) : (
            <Empty>مانعی ثبت نشده است.</Empty>
          )}
          {!readOnly && (
            <label className="wk-check">
              <input
                type="checkbox"
                checked={review.blockersReviewed}
                onChange={(e) =>
                  act(() =>
                    commit(
                      saveReviewNotes(
                        store,
                        { ...review, blockersReviewed: e.target.checked },
                        today,
                        new Date().toISOString(),
                      ),
                    ),
                  )
                }
              />
              موانع را بررسی کردم
            </label>
          )}
        </Panel>
      </div>
      <Panel
        title="جمع‌بندی و تمرکز هفته بعد"
        action={
          <Button secondary disabled={readOnly} onClick={() => setNotes(true)}>
            ویرایش جمع‌بندی
          </Button>
        }
      >
        <p>{review.executiveSummary || "جمع‌بندی مدیریت هنوز ثبت نشده است."}</p>
        <ol>
          {review.nextWeekFocus.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {!review.nextWeekFocus.length && (
          <Empty>۱ تا ۵ موضوع برای تمرکز هفته بعد انتخاب کنید.</Empty>
        )}
      </Panel>
      <Panel
        title="دفتر تصمیم‌های مدیریت"
        action={
          <Button
            secondary
            disabled={readOnly}
            onClick={() => setDecision(true)}
          >
            افزودن تصمیم
          </Button>
        }
      >
        {decisions.length ? (
          decisions.map((d) => (
            <article key={d.id} className="wk-initiative">
              <h3>{d.title}</h3>
              <p>{d.description}</p>
              <small>
                {roleName(d.ownerRoleId, roles)} ·{" "}
                {dateLabel(d.createdAt.slice(0, 10))}
              </small>
            </article>
          ))
        ) : (
          <Empty>هنوز تصمیمی ثبت نشده است؛ این دفتر، سامانه وظایف نیست.</Empty>
        )}
      </Panel>
      <details className="wk-history-panel">
        <summary>تاریخچه هفتگی این دوره</summary>
        <WeeklyHistory cycleId={cycle.id} />
      </details>
      {review.status === "completed" && (
        <Panel title="تصویر هفتگی اهداف">
          {store.objectiveWeeklySnapshots
            ?.filter((s) => s.reviewId === review.id)
            .map((s) => (
              <p key={s.objectiveId}>
                {s.title}: پیشرفت {n(s.progress)}٪ · اطمینان {n(s.confidence)} ·{" "}
                {objectiveHealthLabels[s.health]} · پوشش {n(s.checkedIn)}/
                {n(s.total)}
              </p>
            ))}
        </Panel>
      )}
      {confirmComplete && (
        <Drawer
          open
          onClose={() => setConfirmComplete(false)}
          title="تایید تکمیل مرور"
          description="هشدارها و پوشش ثبت را پیش از قفل کردن مرور بررسی کنید."
        >
          <div className="st-form">
            {error && (
              <p role="alert" className="st-notice">
                {error}
              </p>
            )}
            <ul>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p>
              تصویر وضعیت فعلی، پوشش ثبت و زمینه اقدامات ذخیره و مرور قفل
              می‌شود.
            </p>
            {warnings.length > 0 && (
              <label className="wk-check">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                کمبودها را بررسی کردم و تکمیل مرور را تایید می‌کنم
              </label>
            )}
            <div className="st-actions">
              <Button
                disabled={warnings.length > 0 && !ack}
                onClick={() =>
                  act(() => {
                    commit(
                      completeWeeklyReview(
                        store,
                        review.id,
                        roles,
                        ack,
                        today,
                        new Date().toISOString(),
                      ),
                    );
                    setConfirmComplete(false);
                  })
                }
              >
                ثبت نهایی مرور
              </Button>
              <Button secondary onClick={() => setConfirmComplete(false)}>
                انصراف از تکمیل
              </Button>
            </div>
          </div>
        </Drawer>
      )}
      {confirmReopen && (
        <Drawer
          open
          onClose={() => setConfirmReopen(false)}
          title="بازگشایی کنترل‌شده"
          description="تغییر تاریخچه تنها با بازگشایی و تکمیل مجدد انجام می‌شود."
        >
          <div className="st-form">
            {error && (
              <p role="alert" className="st-notice">
                {error}
              </p>
            )}
            <p>
              تصویر قبلی تا تکمیل مجدد حفظ می‌شود. تکمیل مجدد آن را صریح با
              وضعیت جدید جایگزین و شماره نسخه را افزایش می‌دهد. فقط آخرین هفته
              قابل بازگشایی است.
            </p>
            <Button
              onClick={() =>
                act(() => {
                  commit(
                    reopenWeeklyReview(
                      store,
                      review.id,
                      today,
                      new Date().toISOString(),
                    ),
                  );
                  setConfirmReopen(false);
                })
              }
            >
              تایید بازگشایی
            </Button>
            <Button secondary onClick={() => setConfirmReopen(false)}>
              انصراف
            </Button>
          </div>
        </Drawer>
      )}
      {editingKR && (
        <CheckInEditor
          kr={editingKR}
          review={review}
          onClose={() => setEditingKR(null)}
        />
      )}{" "}
      {notes && (
        <ReviewNotesEditor review={review} onClose={() => setNotes(false)} />
      )}{" "}
      {decision && (
        <DecisionEditor review={review} onClose={() => setDecision(false)} />
      )}
    </>
  );
}
