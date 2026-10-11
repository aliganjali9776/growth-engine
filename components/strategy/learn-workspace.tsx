"use client";
import { reviewDate } from "@/lib/strategy/adapt/definition";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStrategy } from "./provider";
import { Button, Panel, Field, Empty } from "../system/ui";
import { Owner, Options } from "./editors";
import {
  Text,
  Lines,
  Check,
  ChangeHistory,
  RelatedFields,
} from "./adapt-workspace";
import {
  newCycleReview,
  saveCycleReview,
  completeCycleReview,
  closeCycle,
} from "@/lib/strategy/adapt/mutations";
import {
  evidenceSnapshot,
  cycleReviewReadiness,
} from "@/lib/strategy/adapt/report";
import { resetCycle } from "@/lib/strategy/adapt/reset";
import {
  outcomeLabels,
  learningCategories,
  assumptionStatuses,
  hypothesisResults,
  type StrategyCycleReview,
  type CarryForwardSelection,
} from "@/lib/strategy/adapt/types";
import { calculateKRProgress } from "@/lib/strategy/kr/calculations";
const now = () => new Date().toISOString();
export function LearnWorkspace({ cycleId }: { cycleId: string }) {
  const { store, commit } = useStrategy(),
    [error, setError] = useState("");
  const cycle = store.cycles.find((c) => c.id === cycleId),
    review = store.cycleReviews?.find((r) => r.cycleId === cycleId);
  if (!cycle)
    return (
      <Empty>
        دوره پیدا نشد. <Link href="/strategy/cycles">دوره‌ها</Link>
      </Empty>
    );
  if (review) return <LearnDetail key={review.id} review={review} />;
  return (
    <Panel
      title={"یادگیری پایان دوره · " + cycle.name}
      caption="نتیجه اهداف را طبقه‌بندی کنید، فرضیه‌ها را ارزیابی کنید و درس‌ها را به دوره بعد ببرید."
    >
      {error && <p role="alert">{error}</p>}
      <Button
        disabled={["completed", "archived"].includes(cycle.status)}
        onClick={() => {
          try {
            commit(saveCycleReview(store, newCycleReview(store, cycle.id)));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        شروع مرور پایان دوره
      </Button>
    </Panel>
  );
}
function LearnDetail({ review }: { review: StrategyCycleReview }) {
  const { store, roles, commit } = useStrategy(),
    router = useRouter(),
    [r, setR] = useState(review),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [closeReason, setCloseReason] = useState(""),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [selection, setSelection] = useState<CarryForwardSelection>({
      priorityIds: [],
      objectiveIds: [],
      krIds: [],
      initiativeIds: [],
      learningIds: [],
      assumptionIds: [],
    }),
    [targets, setTargets] = useState<Record<string, number>>({});
  const cycle = store.cycles.find((c) => c.id === r.cycleId)!,
    locked = review.status === "completed",
    closed = ["completed", "archived"].includes(cycle.status),
    snapshot =
      review.snapshot ??
      evidenceSnapshot(store, r.cycleId, roles, reviewDate(now()), now()),
    patch = (v: Partial<StrategyCycleReview>) => setR({ ...r, ...v });
  const run = (fn: () => void) => {
    try {
      setError("");
      fn();
      setMessage("ذخیره شد.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const lessons =
      store.strategyLearnings?.filter((l) => l.cycleId === r.cycleId) ?? [],
    assumptions =
      store.strategicAssumptions?.filter((a) => a.cycleId === r.cycleId) ?? [];
  return (
    <>
      <Panel
        title={"یادگیری پایان دوره · " + cycle.name}
        caption={
          locked
            ? "مرور تکمیل‌شده و شواهد آن ثابت است."
            : "تحقق عددی، قضاوت مدیریتی و یادگیری را جداگانه ثبت کنید."
        }
      >
        <p role="status">{message}</p>
        {error && <p role="alert">{error}</p>}
        <p>
          پیشرفت نهایی:{" "}
          {snapshot.overallProgress?.toLocaleString("fa-IR", {
            maximumFractionDigits: 1,
          }) ?? "—"}
          ٪ · اطمینان:{" "}
          {snapshot.averageConfidence?.toLocaleString("fa-IR", {
            maximumFractionDigits: 1,
          }) ?? "—"}
        </p>
        <fieldset disabled={locked || closed} className="ad-fields">
          <Owner
            roleList={locked ? snapshot.roles : undefined}
            value={r.reviewedByRoleId}
            onChange={(v) => patch({ reviewedByRoleId: v })}
          />
          <h3>نتیجه اهداف و KRها</h3>
          {snapshot.objectives.map((o) => (
            <div className="ad-card" key={o.id}>
              <h4>
                {o.code} · {o.title}
              </h4>
              <p>
                پیشرفت{" "}
                {snapshot.objectiveOutcomes
                  .find((x) => x.id === o.id)
                  ?.progress?.toLocaleString("fa-IR", {
                    maximumFractionDigits: 1,
                  }) ?? "—"}
                ٪ · اطمینان{" "}
                {snapshot.objectiveOutcomes
                  .find((x) => x.id === o.id)
                  ?.confidence?.toLocaleString("fa-IR", {
                    maximumFractionDigits: 1,
                  }) ?? "—"}{" "}
                ·{" "}
                {
                  snapshot.objectiveOutcomes.find((x) => x.id === o.id)
                    ?.achievedKRs
                }{" "}
                KR محقق‌شده
              </p>
              <Field label={"نتیجه هدف " + o.code}>
                <select
                  value={r.objectiveClassifications[o.id] ?? ""}
                  onChange={(e) =>
                    patch({
                      objectiveClassifications: {
                        ...r.objectiveClassifications,
                        [o.id]: e.target.value as keyof typeof outcomeLabels,
                      },
                    })
                  }
                >
                  <option value="">طبقه‌بندی مدیریتی</option>
                  <Options items={outcomeLabels} />
                </select>
              </Field>
              {snapshot.keyResults
                .filter((k) => k.objectiveId === o.id)
                .map((k) => (
                  <div key={k.id}>
                    <p>
                      {k.code} · {k.title} · شروع {k.startValue ?? "—"} · هدف{" "}
                      {k.targetValue ?? "—"} · پایان {k.currentValue ?? "—"} ·{" "}
                      {calculateKRProgress(k)?.toLocaleString("fa-IR", {
                        maximumFractionDigits: 1,
                      }) ?? "—"}
                      ٪ · اطمینان {k.confidence ?? "—"}
                    </p>
                    <Field label={"نتیجه " + k.code}>
                      <select
                        value={r.krClassifications[k.id] ?? ""}
                        onChange={(e) =>
                          patch({
                            krClassifications: {
                              ...r.krClassifications,
                              [k.id]: e.target
                                .value as keyof typeof outcomeLabels,
                            },
                          })
                        }
                      >
                        <option value="">طبقه‌بندی مدیریتی</option>
                        <Options items={outcomeLabels} />
                      </select>
                    </Field>
                    <details>
                      <summary>تاریخچه هفتگی این نتیجه</summary>
                      {snapshot.checkIns
                        .filter((c) => c.keyResultId === k.id)
                        .map((c) => (
                          <p key={c.id}>
                            هفته {c.weekNumber} · مقدار {c.currentValue ?? "—"}{" "}
                            · پیشرفت {c.progress ?? "—"}٪ · اطمینان{" "}
                            {c.confidence ?? "—"} ·{" "}
                            {c.blocker || "بدون مانع ثبت‌شده"}
                          </p>
                        ))}
                    </details>
                  </div>
                ))}
            </div>
          ))}
          <h3>یادگیری از اقدامات</h3>
          {snapshot.initiatives.map((i) => {
            const l = r.initiativeLearnings.find(
              (x) => x.initiativeId === i.id,
            );
            const update = (v: Partial<NonNullable<typeof l>>) =>
              patch({
                initiativeLearnings: l
                  ? r.initiativeLearnings.map((x) =>
                      x.initiativeId === i.id ? { ...x, ...v } : x,
                    )
                  : [
                      ...r.initiativeLearnings,
                      {
                        initiativeId: i.id,
                        hypothesisResult: "inconclusive",
                        lesson: "",
                        repeatDecision: "reconsider",
                        ...v,
                      },
                    ],
              });
            return (
              <div className="ad-card" key={i.id}>
                <h4>{i.title}</h4>
                <p>
                  فرضیه: {i.hypothesis} · اثر مورد انتظار: {i.expectedImpact} ·
                  اثر مشاهده‌شده: {i.actualImpact || "ثبت نشده"}
                </p>
                <Field label="نتیجه فرضیه اقدام">
                  <select
                    value={l?.hypothesisResult ?? "inconclusive"}
                    onChange={(e) =>
                      update({
                        hypothesisResult: e.target.value as NonNullable<
                          typeof l
                        >["hypothesisResult"],
                      })
                    }
                  >
                    <Options items={hypothesisResults} />
                  </select>
                </Field>
                <Text
                  label="درس این اقدام"
                  value={l?.lesson ?? ""}
                  onChange={(v) => update({ lesson: v })}
                  multi
                />
                <Field label="آیا تکرار شود؟">
                  <select
                    value={l?.repeatDecision ?? "reconsider"}
                    onChange={(e) =>
                      update({
                        repeatDecision: e.target.value as NonNullable<
                          typeof l
                        >["repeatDecision"],
                      })
                    }
                  >
                    <Options
                      items={{
                        repeat: "تکرار",
                        stop: "تکرار نشود",
                        reconsider: "بازنگری",
                      }}
                    />
                  </select>
                </Field>
              </div>
            );
          })}
          <div className="ad-grid">
            <Lines
              label="موفقیت‌های کلیدی"
              value={r.keyWins}
              onChange={(v) => patch({ keyWins: v })}
            />
            <Lines
              label="ناکامی‌های کلیدی"
              value={r.keyMisses}
              onChange={(v) => patch({ keyMisses: v })}
            />
            <Lines
              label="تغییر مسیر استراتژیک"
              value={r.strategicChanges}
              onChange={(v) => patch({ strategicChanges: v })}
            />
          </div>
          <Text
            label="جمع‌بندی مدیریتی پایان دوره"
            value={r.executiveConclusion}
            onChange={(v) => patch({ executiveConclusion: v })}
            multi
          />
          <Text
            label="دلیل تکمیل با موارد باز"
            value={r.overrideReason}
            onChange={(v) => patch({ overrideReason: v })}
          />
          {!locked &&
            cycleReviewReadiness(store, r).map((w) => <p key={w}>{w}</p>)}
          <div className="ad-actions">
            <Button
              onClick={() => run(() => commit(saveCycleReview(store, r)))}
            >
              ذخیره مرور پایان دوره
            </Button>
            <Button
              secondary
              onClick={() =>
                run(() => {
                  const next = completeCycleReview(
                    saveCycleReview(store, r),
                    r.id,
                    roles,
                    r.overrideReason,
                  );
                  commit(next);
                  setR(next.cycleReviews!.find((x) => x.id === r.id)!);
                })
              }
            >
              تکمیل و تثبیت یادگیری
            </Button>
          </div>
        </fieldset>
      </Panel>
      <LearningRecords
        cycleId={r.cycleId}
        locked={locked || closed}
        snapshot={review.snapshot}
      />
      <Panel title="بستن دوره">
        <p>
          دوره بسته فقط خواندنی است. اهداف و KRهای حل‌نشده و اقدامات
          ارزیابی‌نشده در مرور بالا باقی می‌مانند؛ بستن دوره آن‌ها را موفق اعلام
          نمی‌کند.
        </p>
        {!closed && (
          <>
            <Text
              label="دلیل بستن دوره و پذیرش موارد باز"
              value={closeReason}
              onChange={setCloseReason}
            />
            <Check
              label="بستن دوره را با حفظ سابقه تأیید می‌کنم"
              value={confirmed}
              onChange={setConfirmed}
            />
            {cycle.status !== "review" ? (
              <Button
                onClick={() =>
                  run(() => {
                    if (!confirmed) throw Error("تأیید لازم است.");
                    commit({
                      ...store,
                      cycles: store.cycles.map((c) =>
                        c.id === cycle.id
                          ? { ...c, status: "review", updatedAt: now() }
                          : c,
                      ),
                    });
                    setConfirmed(false);
                  })
                }
              >
                انتقال دوره به بازبینی
              </Button>
            ) : (
              <Button
                disabled={!locked}
                onClick={() =>
                  run(() => {
                    commit(closeCycle(store, cycle.id, closeReason, confirmed));
                    setConfirmed(false);
                  })
                }
              >
                بستن نهایی دوره
              </Button>
            )}
          </>
        )}
        {closed && <p>این دوره بسته شده است.</p>}
      </Panel>
      {locked && (
        <Panel
          title="آماده‌سازی دوره بعد"
          caption="انتخاب‌ها صریح‌اند. اهداف، KRها و اقدامات با شناسه جدید ساخته می‌شوند؛ هیچ ثبت عملکرد هفتگی منتقل نمی‌شود."
        >
          <Text label="نام دوره جدید" value={title} onChange={setTitle} />
          <div className="ad-grid">
            <Text
              label="شروع دوره جدید"
              type="date"
              value={start}
              onChange={setStart}
            />
            <Text
              label="پایان دوره جدید"
              type="date"
              value={end}
              onChange={setEnd}
            />
          </div>
          {(
            [
              {
                key: "priorityIds",
                label: "اولویت‌ها",
                rows: snapshot.priorities,
              },
              {
                key: "objectiveIds",
                label: "اهداف",
                rows: snapshot.objectives,
              },
              { key: "krIds", label: "نتایج کلیدی", rows: snapshot.keyResults },
              {
                key: "initiativeIds",
                label: "اقدامات ناتمام",
                rows: snapshot.initiatives.filter(
                  (i) => !["completed", "cancelled"].includes(i.status),
                ),
              },
              {
                key: "learningIds",
                label: "درس‌آموخته‌ها",
                rows: lessons.map((l) => ({ ...l, title: l.statement })),
              },
              {
                key: "assumptionIds",
                label: "فرض‌های استراتژیک",
                rows: assumptions.map((a) => ({ ...a, title: a.statement })),
              },
            ] as const
          ).map((group) => (
            <div className="ad-card" key={group.key}>
              <h3>{group.label}</h3>
              {group.rows.map((x) => (
                <div key={x.id}>
                  <Check
                    label={x.title}
                    value={selection[group.key].includes(x.id)}
                    onChange={(v) =>
                      setSelection({
                        ...selection,
                        [group.key]: v
                          ? [...selection[group.key], x.id]
                          : selection[group.key].filter((id) => id !== x.id),
                      })
                    }
                  />
                  {group.key === "krIds" &&
                    selection.krIds.includes(x.id) &&
                    snapshot.keyResults.some(
                      (k) =>
                        k.id === x.id &&
                        ["increase", "decrease"].includes(k.type),
                    ) && (
                      <Text
                        label={"هدف جدید " + x.title}
                        type="number"
                        value={targets[x.id]?.toString() ?? ""}
                        onChange={(v) =>
                          setTargets({ ...targets, [x.id]: Number(v) })
                        }
                      />
                    )}
                </div>
              ))}
            </div>
          ))}
          <p>
            برای KR، هدف مرتبط و برای هدف، اولویت مرتبط را هم انتخاب کنید. مبنای
            KR عددی مقدار نهایی این دوره است؛ هدف جدید را مشخص کنید.
          </p>
          <Check
            label="انتخاب‌ها و ساخت پیش‌نویس دوره جدید را تأیید می‌کنم"
            value={confirmed}
            onChange={setConfirmed}
          />
          <Button
            onClick={() =>
              run(() => {
                const id = crypto.randomUUID(),
                  stamp = now();
                const next = resetCycle(
                  store,
                  cycle.id,
                  {
                    id,
                    name: title,
                    description: "",
                    startDate: start,
                    endDate: end,
                    status: "draft",
                    ownerRoleId: cycle.ownerRoleId,
                    cycleType: cycle.cycleType,
                    strategicTheme: cycle.strategicTheme,
                    createdAt: stamp,
                    updatedAt: stamp,
                  },
                  selection,
                  targets,
                  confirmed,
                );
                commit(next);
                router.push("/strategy/cycles/" + id);
              })
            }
          >
            ساخت دوره بعد با انتخاب‌ها
          </Button>
          {store.cycleResets
            ?.filter((x) => x.sourceCycleId === cycle.id)
            .map((x) => (
              <p key={x.id}>
                <Link href={"/strategy/cycles/" + x.newCycleId}>
                  دوره ساخته‌شده · {x.mappings.length} رکورد منتقل‌شده
                </Link>
              </p>
            ))}
        </Panel>
      )}
      <ChangeHistory cycleId={r.cycleId} />
    </>
  );
}
function LearningRecords({
  cycleId,
  locked,
  snapshot,
}: {
  cycleId: string;
  locked: boolean;
  snapshot?: import("@/lib/strategy/adapt/types").EvidenceSnapshot;
}) {
  const [links, setLinks] = useState({
    relatedObjectiveId: "",
    relatedKRId: "",
    relatedInitiativeId: "",
  });
  const { store, commit } = useStrategy(),
    [statement, setStatement] = useState(""),
    [evidence, setEvidence] = useState(""),
    [category, setCategory] =
      useState<keyof typeof learningCategories>("strategy"),
    [assumption, setAssumption] = useState(""),
    [error, setError] = useState("");
  const run = (fn: () => void) => {
    try {
      setError("");
      fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (locked && snapshot)
    return (
      <Panel title="درس‌آموخته‌ها و فرض‌های ثبت‌شده در پایان دوره">
        {snapshot.learnings.map((l) => (
          <div className="ad-card" key={l.id}>
            <strong>
              {learningCategories[l.category]} · {l.statement}
            </strong>
            <p>{l.evidence}</p>
          </div>
        ))}
        {snapshot.assumptions.map((a) => (
          <div className="ad-card" key={a.id}>
            <strong>{a.statement}</strong>
            <p>
              {assumptionStatuses[a.status]} · {a.evidence}
            </p>
          </div>
        ))}
      </Panel>
    );
  return (
    <Panel
      title="درس‌آموخته‌ها و فرض‌های استراتژیک"
      caption="فرض استراتژیک درباره مسیر کسب‌وکار است؛ با فرضیه اثر یک اقدام تفاوت دارد."
    >
      {error && <p role="alert">{error}</p>}
      {(store.strategyLearnings ?? [])
        .filter((l) => l.cycleId === cycleId)
        .map((l) => (
          <div className="ad-card" key={l.id}>
            <strong>
              {learningCategories[l.category]} · {l.statement}
            </strong>
            <p>{l.evidence}</p>
          </div>
        ))}
      <fieldset disabled={locked} className="ad-fields">
        <Text
          label="درس‌آموخته جدید"
          value={statement}
          onChange={setStatement}
          multi
        />
        <RelatedFields
          cycleId={cycleId}
          value={links}
          onChange={(v) => setLinks({ ...links, ...v })}
        />
        <Text
          label="شاهد درس‌آموخته"
          value={evidence}
          onChange={setEvidence}
          multi
        />
        <Field label="دسته یادگیری">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <Options items={learningCategories} />
          </select>
        </Field>
        <Button
          secondary
          onClick={() =>
            run(() => {
              if (!statement.trim() || !evidence.trim())
                throw Error("درس‌آموخته و شاهد آن لازم است.");
              commit({
                ...store,
                strategyLearnings: [
                  ...(store.strategyLearnings ?? []),
                  {
                    id: crypto.randomUUID(),
                    cycleId,
                    category,
                    statement,
                    evidence,
                    ...links,
                    createdAt: now(),
                  },
                ],
              });
              setStatement("");
              setEvidence("");
            })
          }
        >
          ثبت درس‌آموخته
        </Button>
        <h3>فرض‌های استراتژیک</h3>
        {(store.strategicAssumptions ?? [])
          .filter((a) => a.cycleId === cycleId)
          .map((a) => (
            <AssumptionRow key={a.id} id={a.id} />
          ))}
        <Text
          label="فرض استراتژیک جدید"
          value={assumption}
          onChange={setAssumption}
        />
        <Button
          secondary
          onClick={() =>
            run(() => {
              if (!assumption.trim()) throw Error("متن فرض لازم است.");
              commit({
                ...store,
                strategicAssumptions: [
                  ...(store.strategicAssumptions ?? []),
                  {
                    id: crypto.randomUUID(),
                    cycleId,
                    statement: assumption,
                    status: "untested",
                    evidence: "",
                    relatedPriorityId: "",
                    createdAt: now(),
                    updatedAt: now(),
                  },
                ],
              });
              setAssumption("");
            })
          }
        >
          ثبت فرض استراتژیک
        </Button>
      </fieldset>
    </Panel>
  );
}
function AssumptionRow({ id }: { id: string }) {
  const { store, commit } = useStrategy(),
    a = store.strategicAssumptions!.find((x) => x.id === id)!,
    [status, setStatus] = useState(a.status),
    [evidence, setEvidence] = useState(a.evidence),
    [error, setError] = useState("");
  return (
    <div className="ad-card">
      <h4>{a.statement}</h4>
      <Field label="وضعیت فرض">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <Options items={assumptionStatuses} />
        </select>
      </Field>
      <Text label="شاهد ارزیابی فرض" value={evidence} onChange={setEvidence} />
      <Button
        secondary
        onClick={() => {
          try {
            if (status !== "untested" && !evidence.trim())
              throw Error("شاهد ارزیابی لازم است.");
            commit({
              ...store,
              strategicAssumptions: store.strategicAssumptions!.map((x) =>
                x.id === id ? { ...x, status, evidence, updatedAt: now() } : x,
              ),
            });
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        ذخیره ارزیابی فرض
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
