"use client";
import { reviewDate } from "@/lib/strategy/adapt/definition";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStrategy } from "./provider";
import { Button, Panel, Field, Empty } from "../system/ui";
import { Options, Owner } from "./editors";
import {
  newAdaptReview,
  saveAdaptReview,
  completeAdaptReview,
  applyStrategyChange,
  applyInitiativeDecision,
  controlledFields,
} from "@/lib/strategy/adapt/mutations";
import {
  adaptReviewSignals,
  adaptReviewQuality,
  evidenceSnapshot,
  strategyChangeSummary,
} from "@/lib/strategy/adapt/report";
import {
  adaptationDecisions,
  priorityReviewLabels,
  resourceTypes,
  decisionTypes,
  hypothesisResults,
  type StrategyAdaptReview,
  type EntityKind,
} from "@/lib/strategy/adapt/types";
import { krTypes } from "@/lib/strategy/kr/types";
import { dateLabel } from "@/lib/strategy/model";
import { cycleStatuses } from "@/lib/strategy/model";
import { initiativeStatuses } from "@/lib/strategy/initiatives/types";
import { calculateKRProgress } from "@/lib/strategy/kr/calculations";
import { objectiveStatuses, priorityStatuses } from "@/lib/strategy/model";
const now = () => new Date().toISOString();
export function Text({
  label,
  value,
  onChange,
  multi = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multi?: boolean;
  type?: string;
}) {
  return (
    <Field label={label}>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={type}
          value={value}
          onInput={(e) => onChange(e.currentTarget.value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
export function Lines({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Text
      label={label}
      value={value.join("\n")}
      onChange={(v) => onChange(v.split("\n"))}
      multi
    />
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ad-check">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function RelatedFields({
  cycleId,
  value,
  onChange,
  evidence,
}: {
  cycleId: string;
  evidence?: import("@/lib/strategy/adapt/types").EvidenceSnapshot;
  value: {
    relatedObjectiveId: string;
    relatedKRId?: string;
    relatedInitiativeId?: string;
    relatedPriorityId?: string;
  };
  onChange: (patch: Partial<typeof value>) => void;
}) {
  const { store: liveStore } = useStrategy();
  const store = evidence ?? liveStore;
  return (
    <div className="ad-grid">
      {(
        [
          {
            key: "relatedObjectiveId",
            label: "هدف مرتبط تصمیم",
            rows: store.objectives,
          },
          {
            key: "relatedKRId",
            label: "KR مرتبط تصمیم",
            rows: store.keyResults ?? [],
          },
          {
            key: "relatedInitiativeId",
            label: "اقدام مرتبط تصمیم",
            rows: store.initiatives ?? [],
          },
          {
            key: "relatedPriorityId",
            label: "اولویت مرتبط تصمیم",
            rows: store.priorities,
          },
        ] as const
      )
        .filter((g) => g.key in value)
        .map((g) => (
          <Field key={g.key} label={g.label}>
            <select
              value={value[g.key] ?? ""}
              onChange={(e) => onChange({ [g.key]: e.target.value })}
            >
              <option value="">اختیاری</option>
              {g.rows
                .filter((x) => x.cycleId === cycleId)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
            </select>
          </Field>
        ))}
    </div>
  );
}
export function AdaptWorkspace({
  cycleId,
  reviewId,
}: {
  cycleId?: string;
  reviewId?: string;
}) {
  const { store, commit } = useStrategy(),
    router = useRouter();
  const [selected, setSelected] = useState(
      cycleId ?? store.cycles.find((c) => c.status === "active")?.id ?? "",
    ),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [error, setError] = useState("");
  const cycle = store.cycles.find((c) => c.id === selected);
  if (reviewId) {
    const review = store.adaptReviews?.find((r) => r.id === reviewId);
    return review ? (
      <AdaptDetail key={review.id} review={review} />
    ) : (
      <Empty>
        مرور پیدا نشد. <Link href="/strategy/adapt">بازگشت به مرورها</Link>
      </Empty>
    );
  }
  return (
    <>
      <Panel
        title="تطبیق ماهانه"
        caption="شواهد را مرور کنید، تصمیم بگیرید و تغییرات تأییدشده را با حفظ سابقه اعمال کنید."
      >
        <Field label="دوره">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">انتخاب دوره</option>
            {store.cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {cycle && (
          <>
            <AdaptLanding cycleId={cycle.id} />
            {!["completed", "archived"].includes(cycle.status) && (
              <div className="ad-grid">
                <Text
                  label="شروع بازه مرور"
                  type="date"
                  value={start}
                  onChange={setStart}
                />
                <Text
                  label="پایان بازه مرور"
                  type="date"
                  value={end}
                  onChange={setEnd}
                />
                <Button
                  onClick={() => {
                    try {
                      const r = newAdaptReview(store, cycle.id, start, end);
                      commit(saveAdaptReview(store, r));
                      router.push("/strategy/adapt/" + r.id);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  ساخت مرور ماهانه
                </Button>
              </div>
            )}
            <Link href={`/strategy/cycles/${cycle.id}/learn`}>
              یادگیری پایان دوره و آماده‌سازی دوره بعد ←
            </Link>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </Panel>
      <Panel title="آرشیو مرورها">
        {(store.adaptReviews ?? [])
          .filter((r) => !selected || r.cycleId === selected)
          .map((r) => (
            <p key={r.id}>
              <Link href={"/strategy/adapt/" + r.id}>{r.periodLabel}</Link> ·{" "}
              {r.status === "completed"
                ? "تکمیل‌شده · " + r.snapshot?.quality + "٪"
                : "پیش‌نویس"}
            </p>
          ))}
      </Panel>
    </>
  );
}
export function AdaptLanding({ cycleId }: { cycleId: string }) {
  const { store, roles } = useStrategy(),
    signals = adaptReviewSignals(store, cycleId, roles, reviewDate(now())),
    last = store.adaptReviews
      ?.filter((r) => r.cycleId === cycleId && r.status === "completed")
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0],
    changes = strategyChangeSummary(store, cycleId);
  return (
    <div className="ad-summary">
      <p>
        آخرین تطبیق:{" "}
        {last ? (
          <Link href={"/strategy/adapt/" + last.id}>{last.periodLabel}</Link>
        ) : (
          "هنوز انجام نشده"
        )}{" "}
        · {signals.filter((s) => s.kind === "repeated").length} مانع تکراری ·{" "}
        {signals.filter((s) => s.kind === "stalled").length} نتیجه بی‌حرکت ·{" "}
        {changes.total} تغییر ثبت‌شده
      </p>
      <Link href={`/strategy/cycles/${cycleId}/adapt`}>
        مرور تطبیقی این دوره
      </Link>
    </div>
  );
}
function AdaptDetail({ review }: { review: StrategyAdaptReview }) {
  const { store, roles, commit } = useStrategy(),
    [r, setR] = useState(review),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false),
    [initiativeConfirm, setInitiativeConfirm] = useState(""),
    [kind, setKind] = useState<EntityKind>("kr"),
    [entity, setEntity] = useState(""),
    [field, setField] = useState("targetValue"),
    [value, setValue] = useState(""),
    [reason, setReason] = useState("");
  const closed =
      review.status === "completed" ||
      ["completed", "archived"].includes(
        store.cycles.find((c) => c.id === r.cycleId)?.status ?? "",
      ),
    today = reviewDate(now()),
    signals =
      review.snapshot?.signals ??
      adaptReviewSignals(store, r.cycleId, roles, today, r.periodEnd),
    quality =
      review.snapshot?.quality ?? adaptReviewQuality(store, r, signals).score,
    snapshot =
      review.snapshot ??
      evidenceSnapshot(store, r.cycleId, roles, today, now(), r.periodEnd),
    previous = store.adaptReviews
      ?.filter(
        (x) =>
          x.cycleId === r.cycleId &&
          x.status === "completed" &&
          x.periodEnd < r.periodStart,
      )
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  const patch = (v: Partial<StrategyAdaptReview>) => setR({ ...r, ...v });
  const run = (fn: () => void) => {
    try {
      setError("");
      fn();
      setMessage("ذخیره شد.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const rows =
    kind === "kr"
      ? (store.keyResults ?? [])
      : kind === "objective"
        ? store.objectives
        : kind === "priority"
          ? store.priorities
          : (store.initiatives ?? []);
  const record = rows.find((x) => x.id === entity);
  const fieldLabels: Record<string, string> = {
    targetValue: "مقدار هدف",
    startValue: "مبنای شروع",
    type: "نوع KR",
    unit: "واحد",
    deadline: "موعد",
    dueDate: "مهلت اقدام",
    ownerRoleId: "مالک",
    rank: "رتبه",
    status: "وضعیت",
    rationale: "منطق اولویت",
    title: "عنوان",
    description: "شرح / دامنه",
    weight: "وزن",
    lifecycle: "وضعیت KR",
    relatedPriorityId: "اولویت مرتبط",
    startDate: "تاریخ شروع",
    krWeightMode: "روش وزن‌دهی KRها",
  };
  const enumValues =
    field === "krWeightMode"
      ? { equal: "برابر", custom: "سفارشی" }
      : field === "type"
        ? krTypes
        : field === "ownerRoleId"
          ? Object.fromEntries(roles.map((x) => [x.id, x.title]))
          : field === "status"
            ? kind === "objective"
              ? objectiveStatuses
              : priorityStatuses
            : field === "lifecycle"
              ? { active: "فعال", cancelled: "لغوشده" }
              : field === "relatedPriorityId"
                ? Object.fromEntries(
                    store.priorities
                      .filter((p) => p.cycleId === r.cycleId)
                      .map((p) => [p.id, p.title]),
                  )
                : null;
  return (
    <>
      <Panel
        title={
          "مرور تطبیقی · " +
          dateLabel(r.periodStart) +
          " تا " +
          dateLabel(r.periodEnd)
        }
        caption={
          closed
            ? "نسخه تکمیل‌شده ثابت است؛ شواهد در زمان تکمیل ثبت شده‌اند."
            : "ثبت تصمیم، اقدام را تغییر نمی‌دهد؛ اعمال هر تغییر تأیید جداگانه دارد."
        }
      >
        <p>
          پیشرفت:{" "}
          {snapshot.overallProgress?.toLocaleString("fa-IR", {
            maximumFractionDigits: 1,
          }) ?? "—"}
          ٪ · اطمینان:{" "}
          {snapshot.averageConfidence?.toLocaleString("fa-IR", {
            maximumFractionDigits: 1,
          }) ?? "—"}{" "}
          · کیفیت مرور: {quality}٪
        </p>
        <p>
          تغییر اطمینان نسبت به مرور قبلی:{" "}
          {previous?.snapshot?.averageConfidence != null &&
          snapshot.averageConfidence != null
            ? (
                snapshot.averageConfidence - previous.snapshot.averageConfidence
              ).toLocaleString("fa-IR", { maximumFractionDigits: 1 })
            : "داده مقایسه موجود نیست"}
        </p>
        <p>
          KR در ریسک: {snapshot.krStatuses.atRisk} · خارج مسیر:{" "}
          {snapshot.krStatuses.offTrack} · اقدام متوقف:{" "}
          {snapshot.blockedInitiatives} · کم‌اثر:{" "}
          {snapshot.ineffectiveInitiatives}
        </p>
        <p role="status">{message}</p>
        <details className="ad-card">
          <summary>شواهد اندازه‌گیری در این مرور</summary>
          <p>
            ثبت شواهد: {dateLabel(reviewDate(snapshot.recordedAt))}؛ مرورهای
            گذشته از داده امروز بازسازی نمی‌شوند.
          </p>
          {snapshot.keyResults.map((k) => (
            <p key={k.id}>
              {k.code} · {k.title} · شروع {k.startValue ?? "—"} · هدف{" "}
              {k.targetValue ?? "—"} · فعلی {k.currentValue ?? "—"} · پیشرفت{" "}
              {calculateKRProgress(k)?.toLocaleString("fa-IR", {
                maximumFractionDigits: 1,
              }) ?? "—"}
              ٪ · اطمینان {k.confidence ?? "—"}
            </p>
          ))}
        </details>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={closed} className="ad-fields">
          <Owner
            roleList={closed ? snapshot.roles : undefined}
            value={r.reviewedByRoleId}
            onChange={(v) => patch({ reviewedByRoleId: v })}
          />
          <Text
            label="جمع‌بندی پیشرفت"
            value={r.progressSummary}
            onChange={(v) => patch({ progressSummary: v })}
            multi
          />
          <div className="ad-grid">
            <Lines
              label="تغییرات بازار"
              value={r.marketChanges}
              onChange={(v) => patch({ marketChanges: v })}
            />
            <Lines
              label="تغییرات داخلی"
              value={r.internalChanges}
              onChange={(v) => patch({ internalChanges: v })}
            />
            <Lines
              label="ریسک‌های عمده"
              value={r.majorRisks}
              onChange={(v) => patch({ majorRisks: v })}
            />
          </div>
          <h3>شواهد نیازمند توجه</h3>
          {signals.length ? (
            signals.map((s) => (
              <Check
                key={s.id}
                label={s.text}
                value={r.reviewedRiskIds.includes(s.id)}
                onChange={(v) =>
                  patch({
                    reviewedRiskIds: v
                      ? [...r.reviewedRiskIds, s.id]
                      : r.reviewedRiskIds.filter((x) => x !== s.id),
                  })
                }
              />
            ))
          ) : (
            <p>سیگنال قابل اتکایی ثبت نشده است.</p>
          )}
          <h3>تصمیم‌های مدیریتی</h3>
          {r.decisions.map((d, i) => (
            <div className="ad-card" key={d.id}>
              <RelatedFields
                evidence={closed ? snapshot : undefined}
                cycleId={r.cycleId}
                value={d}
                onChange={(v) =>
                  patch({
                    decisions: r.decisions.map((x, j) =>
                      i === j ? { ...x, ...v } : x,
                    ),
                  })
                }
              />
              <Text
                label="عنوان تصمیم"
                value={d.title}
                onChange={(v) =>
                  patch({
                    decisions: r.decisions.map((x, j) =>
                      j === i ? { ...x, title: v } : x,
                    ),
                  })
                }
              />
              <Text
                label="دلیل / شرح تصمیم"
                value={d.description}
                onChange={(v) =>
                  patch({
                    decisions: r.decisions.map((x, j) =>
                      j === i ? { ...x, description: v } : x,
                    ),
                  })
                }
                multi
              />
              <Field label="نوع تصمیم">
                <select
                  value={d.decisionType}
                  onChange={(e) =>
                    patch({
                      decisions: r.decisions.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              decisionType: e.target
                                .value as typeof d.decisionType,
                            }
                          : x,
                      ),
                    })
                  }
                >
                  <Options items={decisionTypes} />
                </select>
              </Field>
              <Owner
                roleList={closed ? snapshot.roles : undefined}
                value={d.ownerRoleId}
                onChange={(v) =>
                  patch({
                    decisions: r.decisions.map((x, j) =>
                      j === i ? { ...x, ownerRoleId: v } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
          <Button
            secondary
            onClick={() =>
              patch({
                decisions: [
                  ...r.decisions,
                  {
                    id: crypto.randomUUID(),
                    reviewId: r.id,
                    title: "",
                    description: "",
                    ownerRoleId: "",
                    relatedPriorityId: "",
                    relatedObjectiveId: "",
                    relatedKRId: "",
                    relatedInitiativeId: "",
                    decisionType: "change",
                    createdAt: now(),
                  },
                ],
              })
            }
          >
            افزودن تصمیم
          </Button>
          <h3>بازبینی اقدامات</h3>
          <p>
            حمایت، کاهش دامنه و جایگزینی به‌عنوان تصمیم مدیریتی ثبت می‌شوند.
            تغییر وضعیت، مالک یا مهلت فقط با «اعمال تصمیم» انجام می‌شود.
          </p>
          {snapshot.initiatives.map((i) => {
            const d = r.initiativeChanges.find((d) => d.initiativeId === i.id);
            const change = (v: Partial<NonNullable<typeof d>>) =>
              patch({
                initiativeChanges: d
                  ? r.initiativeChanges.map((x) =>
                      x.id === d.id ? { ...x, ...v } : x,
                    )
                  : [
                      ...r.initiativeChanges,
                      {
                        id: crypto.randomUUID(),
                        initiativeId: i.id,
                        decision: "continue",
                        rationale: "",
                        effectiveDate: today,
                        ownerRoleId: i.ownerRoleId,
                        newDueDate: i.dueDate,
                        createdAt: now(),
                        ...v,
                      },
                    ],
              });
            return (
              <div className="ad-card" key={i.id}>
                <h4>
                  {i.code} · {i.title}
                </h4>
                <p>
                  پیشرفت اجرا: {i.progress}٪ · فرضیه: {i.hypothesis} · اثر
                  مشاهده‌شده: {i.actualImpact || "ثبت نشده"}
                </p>
                <fieldset disabled={!!d?.appliedAt} className="ad-fields">
                  <Field label="تصمیم اقدام">
                    <select
                      value={d?.decision ?? ""}
                      onChange={(e) =>
                        change({
                          decision: e.target.value as NonNullable<
                            typeof d
                          >["decision"],
                        })
                      }
                    >
                      <option value="">انتخاب تصمیم</option>
                      <Options items={adaptationDecisions} />
                    </select>
                  </Field>
                  <Text
                    label="دلیل تصمیم اقدام"
                    value={d?.rationale ?? ""}
                    onChange={(v) => change({ rationale: v })}
                  />
                  <Text
                    label="تاریخ اثر تصمیم"
                    type="date"
                    value={d?.effectiveDate ?? today}
                    onChange={(v) => change({ effectiveDate: v })}
                  />
                  {d?.decision === "owner" && (
                    <Owner
                      roleList={closed ? snapshot.roles : undefined}
                      value={d.ownerRoleId}
                      onChange={(v) => change({ ownerRoleId: v })}
                    />
                  )}
                  {d?.decision === "extend" && (
                    <Text
                      label="مهلت جدید"
                      type="date"
                      value={d.newDueDate}
                      onChange={(v) => change({ newDueDate: v })}
                    />
                  )}
                </fieldset>
                {d?.appliedAt ? (
                  <p>اعمال‌شده · {dateLabel(reviewDate(d.appliedAt))}</p>
                ) : (
                  d && (
                    <>
                      <Check
                        label={`اعمال تصمیم ${i.code} را با حفظ سابقه تأیید می‌کنم`}
                        value={initiativeConfirm === d.id}
                        onChange={(checked) =>
                          setInitiativeConfirm(checked ? d.id : "")
                        }
                      />
                      <Button
                        secondary
                        onClick={() =>
                          run(() => {
                            if (initiativeConfirm !== d.id)
                              throw Error(
                                "تأیید صریح اعمال تغییر را علامت بزنید.",
                              );
                            const next = applyInitiativeDecision(
                              saveAdaptReview(store, r),
                              r.id,
                              d.id,
                              true,
                            );
                            commit(next);
                            setR(
                              next.adaptReviews!.find((x) => x.id === r.id)!,
                            );
                            setInitiativeConfirm("");
                          })
                        }
                      >
                        اعمال تصمیم این اقدام
                      </Button>
                    </>
                  )
                )}
              </div>
            );
          })}
          <h3>اولویت‌های استراتژیک</h3>
          {snapshot.priorities.map((p) => {
            const d = r.priorityChanges.find((x) => x.priorityId === p.id);
            const change = (v: Partial<NonNullable<typeof d>>) =>
              patch({
                priorityChanges: d
                  ? r.priorityChanges.map((x) =>
                      x.priorityId === p.id ? { ...x, ...v } : x,
                    )
                  : [
                      ...r.priorityChanges,
                      {
                        priorityId: p.id,
                        decision: "valid",
                        rationale: "",
                        ...v,
                      },
                    ],
              });
            return (
              <div className="ad-card" key={p.id}>
                <h4>{p.title}</h4>
                <Field label="اعتبار اولویت">
                  <select
                    value={d?.decision ?? ""}
                    onChange={(e) =>
                      change({
                        decision: e.target.value as NonNullable<
                          typeof d
                        >["decision"],
                      })
                    }
                  >
                    <option value="">انتخاب ارزیابی</option>
                    <Options items={priorityReviewLabels} />
                  </select>
                </Field>
                <Text
                  label="دلیل ارزیابی اولویت"
                  value={d?.rationale ?? ""}
                  onChange={(v) => change({ rationale: v })}
                />
              </div>
            );
          })}
          <h3>جابه‌جایی منابع</h3>
          {r.resourceShifts.map((d, i) => {
            const change = (v: Partial<typeof d>) =>
              patch({
                resourceShifts: r.resourceShifts.map((x, j) =>
                  i === j ? { ...x, ...v } : x,
                ),
              });
            return (
              <div className="ad-card" key={d.id}>
                <RelatedFields
                  evidence={closed ? snapshot : undefined}
                  cycleId={r.cycleId}
                  value={d}
                  onChange={change}
                />
                <div className="ad-grid">
                  <Text
                    label="از حوزه"
                    value={d.fromArea}
                    onChange={(v) => change({ fromArea: v })}
                  />
                  <Text
                    label="به حوزه"
                    value={d.toArea}
                    onChange={(v) => change({ toArea: v })}
                  />
                  <Field label="نوع منبع">
                    <select
                      value={d.resourceType}
                      onChange={(e) =>
                        change({
                          resourceType: e.target.value as typeof d.resourceType,
                        })
                      }
                    >
                      <Options items={resourceTypes} />
                    </select>
                  </Field>
                </div>
                <Text
                  label="شرح جابه‌جایی"
                  value={d.description}
                  onChange={(v) => change({ description: v })}
                />
                <Text
                  label="دلیل جابه‌جایی"
                  value={d.rationale}
                  onChange={(v) => change({ rationale: v })}
                />
              </div>
            );
          })}
          <Button
            secondary
            onClick={() =>
              patch({
                resourceShifts: [
                  ...r.resourceShifts,
                  {
                    id: crypto.randomUUID(),
                    reviewId: r.id,
                    fromArea: "",
                    toArea: "",
                    resourceType: "attention",
                    description: "",
                    rationale: "",
                    relatedObjectiveId: "",
                    relatedInitiativeId: "",
                    createdAt: now(),
                  },
                ],
              })
            }
          >
            ثبت جابه‌جایی منابع
          </Button>
          <Check
            label="نیاز به تغییر منابع و تمرکز اولویت‌ها بررسی شد"
            value={r.resourcesReviewed}
            onChange={(v) => patch({ resourcesReviewed: v })}
          />
          <h3>تغییر کنترل‌شده</h3>
          <p>
            تغییر مبنا یا هدف پس از شروع اجرا، مقایسه پیشرفت را تغییر می‌دهد.
            اعداد و تعریف قبلی در مرورهای تکمیل‌شده حفظ می‌شوند. برای تغییر نوع،
            مقادیر سازگار را نیز مشخص کنید.
          </p>
          <div className="ad-grid">
            <Field label="نوع رکورد">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as EntityKind);
                  setEntity("");
                  setField(
                    e.target.value === "kr"
                      ? "targetValue"
                      : e.target.value === "objective"
                        ? "deadline"
                        : "rank",
                  );
                  setValue("");
                }}
              >
                <Options
                  items={{
                    kr: "نتیجه کلیدی",
                    objective: "هدف",
                    priority: "اولویت",
                  }}
                />
              </select>
            </Field>
            <Field label="رکورد مورد تغییر">
              <select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  setValue("");
                }}
              >
                <option value="">انتخاب رکورد</option>
                {rows
                  .filter((x) => x.cycleId === r.cycleId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="فیلد تغییر">
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setValue("");
                }}
              >
                {controlledFields[kind]
                  .filter((f) => f !== "milestones" && f !== "type")
                  .map((f) => (
                    <option key={f} value={f}>
                      {fieldLabels[f] ?? f}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <p>
            مقدار قبلی:{" "}
            {record
              ? String(
                  (record as unknown as Record<string, unknown>)[field] ?? "—",
                )
              : "—"}
          </p>
          {enumValues ? (
            <Field label="مقدار جدید">
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">انتخاب مقدار</option>
                <Options items={enumValues} />
              </select>
            </Field>
          ) : (
            <Text
              label="مقدار جدید"
              type={
                ["deadline", "startDate"].includes(field)
                  ? "date"
                  : ["targetValue", "startValue", "rank", "weight"].includes(
                        field,
                      )
                    ? "number"
                    : "text"
              }
              value={value}
              onChange={setValue}
            />
          )}
          <Text label="دلیل تغییر" value={reason} onChange={setReason} multi />
          <Check
            label="پیامد تغییر را بررسی کرده‌ام و اعمال آن را تأیید می‌کنم"
            value={confirm}
            onChange={setConfirm}
          />
          <Button
            secondary
            onClick={() =>
              run(() => {
                if (!value.trim()) throw Error("مقدار جدید لازم است.");
                const v = [
                  "startValue",
                  "targetValue",
                  "rank",
                  "weight",
                ].includes(field)
                  ? Number(value)
                  : value;
                const next = applyStrategyChange(
                  saveAdaptReview(store, r),
                  r.id,
                  kind,
                  entity,
                  { [field]: v },
                  reason,
                  confirm,
                );
                commit(next);
                setR(next.adaptReviews!.find((x) => x.id === r.id)!);
                setConfirm(false);
                setReason("");
              })
            }
          >
            اعمال تغییر با ثبت سابقه
          </Button>
          <Lines
            label="تمرکز ماه بعد (هر مورد یک خط)"
            value={r.nextFocus}
            onChange={(v) => patch({ nextFocus: v })}
          />
          <Text
            label="یادداشت مرور"
            value={r.notes}
            onChange={(v) => patch({ notes: v })}
            multi
          />
          <Text
            label="دلیل تکمیل با موارد باز"
            value={r.overrideReason}
            onChange={(v) => patch({ overrideReason: v })}
          />
          <div className="ad-actions">
            <Button
              onClick={() =>
                run(() => {
                  commit(saveAdaptReview(store, r));
                })
              }
            >
              ذخیره پیش‌نویس مرور
            </Button>
            <Button
              secondary
              onClick={() =>
                run(() => {
                  const next = completeAdaptReview(
                    saveAdaptReview(store, r),
                    r.id,
                    roles,
                    r.overrideReason,
                  );
                  commit(next);
                  setR(next.adaptReviews!.find((x) => x.id === r.id)!);
                })
              }
            >
              تکمیل و تثبیت مرور
            </Button>
          </div>
        </fieldset>
      </Panel>
      <ChangeHistory cycleId={r.cycleId} reviewId={r.id} />
    </>
  );
}
export function ChangeHistory({
  cycleId,
  entityId,
  reviewId,
}: {
  cycleId?: string;
  entityId?: string;
  reviewId?: string;
}) {
  const { store, roles } = useStrategy(),
    rows = (store.strategyChanges ?? []).filter(
      (c) =>
        (!cycleId || c.cycleId === cycleId) &&
        (!entityId || c.entityId === entityId) &&
        (!reviewId || c.reviewId === reviewId),
    );
  const fieldNames: Record<string, string> = {
    targetValue: "مقدار هدف",
    startValue: "مبنای شروع",
    currentValue: "مقدار فعلی",
    deadline: "موعد",
    dueDate: "مهلت اقدام",
    status: "وضعیت",
    lifecycle: "وضعیت KR",
    ownerRoleId: "مالک",
    rank: "رتبه",
    rationale: "منطق اولویت",
    title: "عنوان",
    description: "دامنه / شرح",
    type: "نوع نتیجه",
    unit: "واحد",
    weight: "وزن",
    milestones: "مراحل",
    startDate: "تاریخ شروع",
    krWeightMode: "روش وزن‌دهی",
    relatedPriorityId: "اولویت مرتبط",
  };
  const labels: Record<string, string> = {
    ...krTypes,
    ...cycleStatuses,
    ...priorityStatuses,
    ...objectiveStatuses,
    ...initiativeStatuses,
    equal: "وزن برابر",
    custom: "وزن سفارشی",
  };
  const display = (value: unknown, field: string, reviewId: string): string => {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value))
      return (
        value
          .map((x) =>
            x && typeof x === "object" && "title" in x
              ? String(x.title)
              : String(x),
          )
          .join("، ") || "بدون مرحله"
      );
    if (field === "ownerRoleId") {
      const saved = store.adaptReviews?.find((r) => r.id === reviewId)?.snapshot
        ?.roles;
      return (saved ?? roles).find((r) => r.id === value)?.title ?? "نقش قبلی";
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return dateLabel(value);
    if (field === "relatedPriorityId")
      return (
        store.priorities.find((p) => p.id === value)?.title ?? "بدون اولویت"
      );
    return labels[String(value)] ?? String(value);
  };
  return (
    <Panel title="سابقه تغییرات تصمیم‌گیری">
      {rows.length ? (
        rows.map((c) => (
          <div className="ad-card" key={c.id}>
            <p>
              {fieldNames[c.fieldChanged] ?? "تغییر"} ·{" "}
              {display(c.oldValue, c.fieldChanged, c.reviewId)} ←{" "}
              {display(c.newValue, c.fieldChanged, c.reviewId)}
            </p>
            <p>
              {c.reason} · {dateLabel(reviewDate(c.changedAt))}
            </p>
            <Link
              href={
                c.entityType === "cycle"
                  ? `/strategy/cycles/${c.cycleId}/learn`
                  : "/strategy/adapt/" + c.reviewId
              }
            >
              مرور مبدأ
            </Link>
          </div>
        ))
      ) : (
        <p>تغییری ثبت نشده است.</p>
      )}
    </Panel>
  );
}
export function InitiativeLearningHistory({ id }: { id: string }) {
  const { store } = useStrategy();
  return (
    <Panel title="یادگیری ثبت‌شده این اقدام">
      {(store.cycleReviews ?? [])
        .filter(
          (r) =>
            r.status === "completed" &&
            r.initiativeLearnings.some((l) => l.initiativeId === id),
        )
        .map((r) => {
          const l = r.initiativeLearnings.find((l) => l.initiativeId === id)!;
          return (
            <p key={r.id}>
              {hypothesisResults[l.hypothesisResult]} · {l.lesson} ·{" "}
              <Link href={`/strategy/cycles/${r.cycleId}/learn`}>
                مرور پایان دوره
              </Link>
            </p>
          );
        })}
      <p>یادگیری اقدام در مرور پایان دوره ثبت و تثبیت می‌شود.</p>
    </Panel>
  );
}
