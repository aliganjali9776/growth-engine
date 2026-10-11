"use client";
import { useState } from "react";
import { Field } from "@/components/system/ui";
import { useStrategy } from "./provider";
import { EditorFrame, Owner } from "./editors";
import { todayTehran } from "@/lib/strategy/model";
import type { KeyResult } from "@/lib/strategy/kr/types";
import { calculateKRProgress } from "@/lib/strategy/kr/calculations";
import type {
  StrategyWeeklyReview,
  StrategyDecision,
} from "@/lib/strategy/weekly/types";
import {
  saveCheckIn,
  saveReviewNotes,
  saveStrategyDecision,
} from "@/lib/strategy/weekly/mutations";
import { getPreviousCheckIn } from "@/lib/strategy/weekly/calculations";
import { initiativeNumber as n } from "./initiative-summary";
export function CheckInEditor({
  kr,
  review,
  onClose,
}: {
  kr: KeyResult;
  review: StrategyWeeklyReview;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy(),
    old = store.krCheckIns?.find(
      (c) => c.reviewId === review.id && c.keyResultId === kr.id,
    ),
    previous = getPreviousCheckIn(
      store.krCheckIns ?? [],
      kr.id,
      review.weekNumber,
    ),
    [value, setValue] = useState(old?.currentValue ?? kr.currentValue),
    [confidence, setConfidence] = useState(old?.confidence ?? kr.confidence),
    [milestones, setMilestones] = useState(
      (old?.krSnapshot ?? kr).milestones
        .filter((m) => m.completed)
        .map((m) => m.id),
    ),
    [win, setWin] = useState(old?.win ?? ""),
    [blocker, setBlocker] = useState(old?.blocker ?? ""),
    [next, setNext] = useState(old?.nextAction ?? ""),
    [comment, setComment] = useState(old?.comment ?? "");
  return (
    <EditorFrame
      title={`${old ? "اصلاح ثبت" : "ثبت هفتگی"} ${kr.code}`}
      onClose={onClose}
      onSave={() =>
        commit(
          saveCheckIn(
            store,
            review.id,
            {
              keyResultId: kr.id,
              currentValue: value,
              confidence,
              completedMilestoneIds: milestones,
              win,
              blocker,
              nextAction: next,
              comment,
            },
            crypto.randomUUID(),
            todayTehran(),
            new Date().toISOString(),
          ),
        )
      }
    >
      <p>{kr.title}</p>
      <p>
        مبنای قبلی:{" "}
        {n(
          kr.type === "milestone"
            ? old
              ? old.previousProgress
              : previous
                ? previous.progress
                : calculateKRProgress(kr)
            : old
              ? old.previousValue
              : previous
                ? previous.currentValue
                : kr.currentValue,
        )}{" "}
        {kr.type === "milestone" ? "٪ پیشرفت مراحل" : kr.unit} · هدف{" "}
        {kr.type === "milestone" ? "۱۰۰٪" : n(kr.targetValue)}
      </p>
      {old && (
        <p className="st-notice">
          همان ثبت این هفته اصلاح می‌شود؛ ثبت تکراری ایجاد نمی‌شود و مبنای قبلی
          ثابت می‌ماند.
        </p>
      )}
      {kr.type === "milestone" ? (
        <fieldset>
          <legend>مراحل تکمیل‌شده این هفته</legend>
          {kr.milestones.map((m) => (
            <label key={m.id} className="wk-check">
              <input
                type="checkbox"
                checked={milestones.includes(m.id)}
                onChange={(e) =>
                  setMilestones(
                    e.target.checked
                      ? [...milestones, m.id]
                      : milestones.filter((id) => id !== m.id),
                  )
                }
              />
              {m.title} · {n(m.weight)}٪
            </label>
          ))}
        </fieldset>
      ) : kr.type === "binary" ? (
        <Field label="مقدار فعلی هفته">
          <select
            value={value ?? ""}
            onChange={(e) =>
              setValue(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">انتخاب کنید</option>
            <option value="0">خیر</option>
            <option value="1">بله</option>
          </select>
        </Field>
      ) : (
        <Field label="مقدار فعلی هفته">
          <input
            type="number"
            step="any"
            required
            value={value ?? ""}
            onChange={(e) =>
              setValue(e.target.value === "" ? null : Number(e.target.value))
            }
          />
          <small>{kr.unit}</small>
        </Field>
      )}
      <Field label="اطمینان این هفته">
        <input
          type="number"
          required
          min={1}
          max={10}
          value={confidence ?? ""}
          onChange={(e) =>
            setConfidence(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      </Field>
      <Field label="برد این هفته">
        <textarea
          value={win}
          onChange={(e) => setWin(e.target.value)}
          placeholder="چه چیزی خوب پیش رفت؟"
        />
      </Field>
      <Field label="مانع این هفته">
        <textarea
          value={blocker}
          onChange={(e) => setBlocker(e.target.value)}
          placeholder="چه چیزی جلوی حرکت نتیجه را گرفته؟"
        />
      </Field>
      <Field label="قدم بعدی">
        <textarea value={next} onChange={(e) => setNext(e.target.value)} />
        <small>برای نتیجه پرریسک یا دارای مانع، یک قدم روشن لازم است.</small>
      </Field>
      <Field label="توضیح ثبت">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>
    </EditorFrame>
  );
}
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
export function ReviewNotesEditor({
  review,
  onClose,
}: {
  review: StrategyWeeklyReview;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy(),
    [r, set] = useState(review),
    [wins, setWins] = useState(r.wins.join("\n")),
    [blockers, setBlockers] = useState(r.blockers.join("\n")),
    [focus, setFocus] = useState(r.nextWeekFocus.join("\n"));
  return (
    <EditorFrame
      title="جمع‌بندی مدیریت"
      onClose={onClose}
      onSave={() =>
        commit(
          saveReviewNotes(
            store,
            {
              ...r,
              wins: lines(wins),
              blockers: lines(blockers),
              nextWeekFocus: lines(focus),
            },
            todayTehran(),
            new Date().toISOString(),
          ),
        )
      }
    >
      <Owner
        value={r.reviewedByRoleId}
        onChange={(reviewedByRoleId) => set({ ...r, reviewedByRoleId })}
      />
      <Field label="جمع‌بندی اجرایی">
        <textarea
          value={r.executiveSummary}
          onChange={(e) => set({ ...r, executiveSummary: e.target.value })}
        />
      </Field>
      <Field label="بردهای مدیریت">
        <textarea value={wins} onChange={(e) => setWins(e.target.value)} />
        <small>هر مورد در یک خط؛ بردهای KR جداگانه نمایش داده می‌شوند.</small>
      </Field>
      <Field label="موانع مدیریت">
        <textarea
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
        />
      </Field>
      <Field label="تمرکز هفته بعد">
        <textarea
          rows={5}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
        />
        <small>۱ تا ۵ موضوع؛ هر موضوع در یک خط.</small>
        {lines(focus).length > 5 && (
          <p className="st-notice">
            بیش از پنج موضوع، تمرکز هفته بعد را کاهش می‌دهد.
          </p>
        )}
      </Field>
    </EditorFrame>
  );
}
export function DecisionEditor({
  review,
  onClose,
}: {
  review: StrategyWeeklyReview;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy(),
    [d, set] = useState<StrategyDecision>({
      id: crypto.randomUUID(),
      reviewId: review.id,
      title: "",
      description: "",
      ownerRoleId: "",
      relatedObjectiveId: "",
      relatedKRId: "",
      relatedInitiativeId: "",
      createdAt: new Date().toISOString(),
    });
  return (
    <EditorFrame
      title="ثبت تصمیم مدیریت"
      onClose={onClose}
      onSave={() => commit(saveStrategyDecision(store, d, todayTehran()))}
    >
      <Field label="عنوان تصمیم">
        <input
          required
          value={d.title}
          onChange={(e) => set({ ...d, title: e.target.value })}
        />
      </Field>
      <Field label="شرح تصمیم">
        <textarea
          value={d.description}
          onChange={(e) => set({ ...d, description: e.target.value })}
        />
      </Field>
      <Owner
        value={d.ownerRoleId}
        onChange={(ownerRoleId) => set({ ...d, ownerRoleId })}
      />
      <Field label="هدف مرتبط تصمیم">
        <select
          value={d.relatedObjectiveId}
          onChange={(e) =>
            set({
              ...d,
              relatedObjectiveId: e.target.value,
              relatedKRId: "",
              relatedInitiativeId: "",
            })
          }
        >
          <option value="">اختیاری</option>
          {store.objectives
            .filter((o) => o.cycleId === review.cycleId)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="KR مرتبط تصمیم">
        <select
          value={d.relatedKRId}
          onChange={(e) =>
            set({ ...d, relatedKRId: e.target.value, relatedInitiativeId: "" })
          }
        >
          <option value="">اختیاری</option>
          {store.keyResults
            ?.filter(
              (k) =>
                k.cycleId === review.cycleId &&
                (!d.relatedObjectiveId ||
                  k.objectiveId === d.relatedObjectiveId),
            )
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.code} · {k.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="اقدام مرتبط تصمیم">
        <select
          value={d.relatedInitiativeId}
          onChange={(e) => set({ ...d, relatedInitiativeId: e.target.value })}
        >
          <option value="">اختیاری</option>
          {store.initiatives
            ?.filter(
              (i) =>
                i.cycleId === review.cycleId &&
                (!d.relatedObjectiveId ||
                  i.objectiveId === d.relatedObjectiveId) &&
                (!d.relatedKRId || i.keyResultId === d.relatedKRId),
            )
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
        </select>
      </Field>
      <small>ثبت تصمیم، اجرای خودکار تغییر مالک یا توقف اقدام نیست.</small>
    </EditorFrame>
  );
}
