"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Drawer, Panel } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, fa } from "./shared";
import { levels } from "@/lib/scale/model";
import * as E from "@/lib/scale/experiments/model";
import {
  suggestExperimentResult,
  scaleCapacitySignals,
} from "@/lib/scale/experiments/logic";
import {
  completeExperiment,
  reviewIdea,
} from "@/lib/scale/experiments/mutations";
export function CapacityContext({
  experiment: e,
}: {
  experiment: E.GrowthExperiment;
}) {
  const { store, sources } = useScale(),
    c = store.constraints.find((c) => c.id === e.constraintId),
    processId = e.snapshot?.systemProcessId ?? c?.linkedSystemProcessId ?? "",
    signals = scaleCapacitySignals(sources.capacity, processId),
    objectiveId =
      e.snapshot?.strategyObjectiveId ?? c?.linkedStrategyObjectiveId,
    objective = sources.objectives.find((o) => o.id === objectiveId),
    krId = e.snapshot?.strategyKRId ?? c?.linkedStrategyKRId,
    kr = sources.keyResults.find((k) => k.id === krId);
  return (
    <div className="scale-notice">
      <h3>آمادگی عملیاتی برای رشد</h3>
      <p>
        {signals.known
          ? "شواهد خواندنی سیستم؛ بررسی ظرفیت جایگزین تصمیم مدیریت نیست."
          : "اطلاعات ظرفیت مرتبط در دسترس نیست؛ ناشناخته به معنی آمادگی نیست."}
      </p>
      {signals.risks.map((p) => (
        <p key={p.id}>
          <Link href={`/system/processes/${p.id}`}>{p.title}</Link> ·{" "}
          {p.reasons.join("؛ ")}
        </p>
      ))}
      {signals.known && !signals.risks.length && (
        <p>در قواعد فعلی هشدار ثبت نشده؛ ظرفیت افزایش حجم تضمین نشده است.</p>
      )}
      <Link href="/system/independence">بررسی منبع سیستم ←</Link>
      <h3>هم‌راستایی استراتژی</h3>
      <p>
        {objective ? (
          <Link
            href={`/strategy/cycles/${objective.cycleId}/objectives/${objective.id}${kr ? "#kr-" + kr.id : ""}`}
          >
            {objective.title} {kr ? "· " + kr.title : ""} ·{" "}
            {sources.cycleLabels[objective.cycleId]}
          </Link>
        ) : (
          "هدف استراتژیک مرتبط موجود نیست؛ هم‌راستایی را صریح بررسی کنید."
        )}
      </p>
      <p>آیا این جهت رشد هنوز با استراتژی فعلی هم‌راستا است؟</p>
    </div>
  );
}
export function CompletionEditor({
  experiment: e,
  close,
}: {
  experiment: E.GrowthExperiment;
  close: () => void;
}) {
  const { store, commit, sources } = useScale(),
    suggestion = suggestExperimentResult(store, e),
    [result, setResult] = useState(""),
    [reason, setReason] = useState(""),
    [learning, setLearning] = useState(""),
    [evidence, setEvidence] = useState(""),
    [insight, setInsight] = useState(""),
    [decision, setDecision] = useState(""),
    [rationale, setRationale] = useState(""),
    [confidence, setConfidence] = useState(""),
    [capacity, setCapacity] = useState(false),
    [alignment, setAlignment] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={close}
      title="نتیجه، یادگیری و تصمیم"
      description="این ثبت نهایی ثابت می‌ماند؛ ادامه کار با نسخه جدید آزمایش انجام می‌شود."
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          try {
            if (!result || !decision)
              throw Error("نتیجه و تصمیم نهایی را انتخاب کنید.");
            const c = store.constraints.find((c) => c.id === e.constraintId);
            const processId =
              e.snapshot?.systemProcessId ?? c?.linkedSystemProcessId;
            const objectiveId =
              e.snapshot?.strategyObjectiveId ?? c?.linkedStrategyObjectiveId;
            const krId = e.snapshot?.strategyKRId ?? c?.linkedStrategyKRId;
            const context = JSON.stringify({
              capacity: sources.capacity.filter(
                (p) => !processId || p.id === processId,
              ),
              strategyObjective:
                sources.objectives.find((o) => o.id === objectiveId)?.title ??
                null,
              strategyKR:
                sources.keyResults.find((k) => k.id === krId)?.title ?? null,
            });
            commit(
              completeExperiment(store, e.id, {
                result: result as NonNullable<
                  E.GrowthExperiment["resultStatus"]
                >,
                resultRationale: reason,
                confidenceAfter:
                  (confidence as E.GrowthExperiment["confidenceAfter"]) || null,
                learning,
                evidence,
                insight,
                decision: decision as E.ExperimentDecision["decision"],
                rationale,
                capacityReviewed: capacity,
                alignmentReviewed: alignment,
                context,
                confirmed,
              }),
            );
            close();
          } catch (x) {
            setError(x instanceof Error ? x.message : "ثبت نشد");
          }
        }}
      >
        <p>
          خط مبنا {fa(e.baselineValue)} · آخرین مشاهده {fa(suggestion.actual)} ·
          حداقل {fa(e.minimumSuccessThreshold)} · هدف {fa(e.targetValue)}
        </p>
        <h3>نتیجه پیشنهادی سیستم: {E.results[suggestion.status]}</h3>
        <p>{suggestion.reason}</p>
        <p>
          این پیشنهاد از آخرین مشاهده می‌آید؛ نتیجه قطعی، انتساب علّی یا
          معنی‌داری آماری نیست. شاخص‌های محافظ را نیز بررسی کنید.
        </p>
        <Select
          label="نتیجه نهایی مدیریت"
          value={result}
          empty="انتخاب صریح نتیجه"
          items={E.results}
          onChange={setResult}
        />
        <Text
          required
          area
          label="دلیل طبقه‌بندی نهایی / اختلاف با پیشنهاد"
          value={reason}
          onChange={setReason}
        />
        <Select
          label="اطمینان پس از آزمایش"
          value={confidence}
          empty="نامشخص"
          items={levels}
          onChange={setConfidence}
        />
        <Text
          required
          area
          label="از این آزمایش چه یاد گرفتیم؟"
          value={learning}
          onChange={setLearning}
        />
        <Text
          area
          label="شواهد یادگیری"
          value={evidence}
          onChange={setEvidence}
        />
        <Text
          area
          label="بینش قابل استفاده مجدد"
          value={insight}
          onChange={setInsight}
        />
        <Select
          label="تصمیم بعد از آزمایش"
          value={decision}
          empty="انتخاب تصمیم"
          items={E.decisions}
          onChange={setDecision}
        />
        <Text
          required
          area
          label="دلیل تصمیم"
          value={rationale}
          onChange={setRationale}
        />
        <CapacityContext experiment={e} />
        {decision === "scale" && (
          <>
            <label className="scale-check">
              <input
                type="checkbox"
                checked={capacity}
                onChange={(ev) => setCapacity(ev.target.checked)}
              />
              شواهد ظرفیت و ریسک‌های عملیاتی، از جمله موارد ناشناخته را بررسی
              کردم.
            </label>
            <label className="scale-check">
              <input
                type="checkbox"
                checked={alignment}
                onChange={(ev) => setAlignment(ev.target.checked)}
              />
              هم‌راستایی با استراتژی فعلی را بررسی کردم.
            </label>
            <p>
              این تصمیم صرفاً ثبت مدیریت است؛ هیچ فرآیند یا هدفی به‌صورت خودکار
              تغییر نمی‌کند.
            </p>
          </>
        )}
        <label className="scale-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(ev) => setConfirmed(ev.target.checked)}
          />
          نتیجه نهایی، یادگیری و تصمیم را برای ثبت ثابت تأیید می‌کنم.
        </label>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">تکمیل و ثبت نهایی آزمایش</Button>
      </form>
    </Drawer>
  );
}
export function IdeaDecision({ ideaId }: { ideaId: string }) {
  const { store, commit } = useScale(),
    [experimentId, setExperimentId] = useState(""),
    [status, setStatus] = useState("review"),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const completed = E.experimentData(store).experiments.filter(
    (e) => e.ideaId === ideaId && e.status === "completed",
  );
  if (!completed.length) return null;
  return (
    <Panel
      title="تصمیم کنترل‌شده درباره ایده"
      caption="یک آزمایش موفق، ایده را خودکار تأیید نمی‌کند."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(
              reviewIdea(
                store,
                ideaId,
                experimentId,
                status as E.IdeaReview["status"],
                reason,
              ),
            );
            setError("تصمیم ثبت شد.");
          } catch (x) {
            setError(String(x));
          }
        }}
      >
        <Select
          label="آزمایش مبنای تصمیم ایده"
          value={experimentId}
          empty="انتخاب آزمایش تکمیل‌شده"
          items={Object.fromEntries(
            completed.map((e) => [e.id, `${e.code} · ${e.title}`]),
          )}
          onChange={setExperimentId}
        />
        <Select
          label="وضعیت نهایی ایده"
          value={status}
          items={{
            review: "در حال بررسی",
            validated: "تأییدشده",
            rejected: "ردشده",
          }}
          onChange={setStatus}
        />
        <Text
          required
          area
          label="دلیل تصمیم ایده"
          value={reason}
          onChange={setReason}
        />
        <Button type="submit">ثبت تصمیم ایده</Button>
        {error && <p role="status">{error}</p>}
      </form>
    </Panel>
  );
}
