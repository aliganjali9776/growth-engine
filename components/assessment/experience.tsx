"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Check, TriangleAlert } from "lucide-react";
import {
  emptyDraft,
  parseDraft,
  STORAGE_KEY,
  validProfile,
} from "@/lib/assessment/persistence";
import { questions } from "@/lib/assessment/questions";
import { diagnose } from "@/lib/assessment/diagnostics";
import { isComplete } from "@/lib/assessment/scoring";
import type { AssessmentDraft } from "@/lib/assessment/types";
import {
  AssessmentIntro,
  AssessmentProgress,
  AssessmentSectionIntro,
  AssessmentQuestion,
  CompanyProfileForm,
} from "./flow";
import { AssessmentResults, ImprovementPreview } from "./results";
import "./assessment.css";

export function AssessmentExperience() {
  const [draft, setDraft] = useState<AssessmentDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [restoreNotice, setRestoreNotice] = useState("");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [validation, setValidation] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const recoveryBlocked = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDraft(parseDraft(raw));
    } catch {
      recoveryBlocked.current = true;
      setRestoreNotice(
        "پیشرفت قبلی قابل بازیابی نبود و حفظ شده است. پاسخ‌های جدید فعلاً فقط در همین صفحه می‌مانند؛ شروع دوباره با تأیید شما داده قبلی را جایگزین می‌کند.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || recoveryBlocked.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setStorageError("");
    } catch {
      setStorageError(
        "ذخیره در این مرورگر ممکن نیست؛ پاسخ‌ها تا زمانی که صفحه باز است حفظ می‌شوند.",
      );
    }
  }, [draft, ready]);
  useEffect(() => {
    if (ready) {
      contentRef.current?.focus({ preventScroll: true });
      contentRef.current
        ?.closest(".assessment-experience")
        ?.scrollIntoView({ block: "start" });
      setValidation("");
    }
  }, [draft.screen, draft.questionIndex, ready]);
  const update = (patch: Partial<AssessmentDraft>) =>
    setDraft((old) => ({ ...old, ...patch }));
  const answered = questions.filter((q) => draft.answers[q.id]).length;
  const question = questions[draft.questionIndex];
  function nextQuestion() {
    if (!draft.answers[question.id]) return;
    if (draft.questionIndex === 29) {
      if (!isComplete(draft.answers)) {
        update({
          questionIndex: questions.findIndex((q) => !draft.answers[q.id]),
          screen: "question",
        });
        return;
      }
      if (!validProfile(draft.profile)) {
        update({ screen: "profile" });
        return;
      }
      update({ screen: "results", completedAt: new Date().toISOString() });
    } else
      update({
        questionIndex: draft.questionIndex + 1,
        screen: draft.questionIndex % 10 === 9 ? "section" : "question",
      });
  }
  function backQuestion() {
    if (draft.questionIndex % 10 === 0) update({ screen: "section" });
    else update({ questionIndex: draft.questionIndex - 1 });
  }
  function closeRestart() {
    setConfirmRestart(false);
    restartRef.current?.focus();
  }
  function restart() {
    recoveryBlocked.current = false;
    const fresh = emptyDraft();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      setStorageError(
        "ذخیره در این مرورگر ممکن نیست؛ شروع مجدد فقط در همین صفحه انجام شد.",
      );
    }
    setDraft(fresh);
    setRestoreNotice("");
    setConfirmRestart(false);
  }
  if (!ready)
    return (
      <div className="assessment-loading" role="status">
        در حال آماده‌سازی ارزیابی…
      </div>
    );
  const report =
    ["results", "roadmap"].includes(draft.screen) &&
    isComplete(draft.answers) &&
    validProfile(draft.profile)
      ? diagnose(draft.answers)
      : null;
  return (
    <div className="assessment-experience">
      <div className="assessment-toolbar">
        <span>
          <i className="live-dot" />
          ارزیابی سلامت کسب‌وکار
        </span>
        {draft.screen !== "intro" && (
          <button
            ref={restartRef}
            className="restart-button"
            onClick={() => setConfirmRestart(true)}
          >
            <RotateCcw size={13} />
            شروع مجدد ارزیابی
          </button>
        )}
      </div>
      {storageError && (
        <p role="alert" className="assessment-alert">
          <TriangleAlert size={16} />
          {storageError}
        </p>
      )}
      {restoreNotice && (
        <p role="status" className="assessment-alert">
          {restoreNotice}
        </p>
      )}
      {draft.screen !== "intro" && (
        <AssessmentProgress
          screen={draft.screen}
          index={draft.questionIndex}
          answered={answered}
        />
      )}
      <div ref={contentRef} tabIndex={-1} className="assessment-content">
        {draft.screen === "intro" && (
          <AssessmentIntro onStart={() => update({ screen: "profile" })} />
        )}
        {draft.screen === "profile" && (
          <CompanyProfileForm
            profile={draft.profile}
            onChange={(profile) => update({ profile })}
            onBack={() => update({ screen: "intro" })}
            onNext={() => {
              if (validProfile(draft.profile))
                update({ screen: "section", questionIndex: 0 });
              else
                setValidation(
                  "لطفاً همه مشخصات شرکت را کامل کنید؛ نام و حوزه فعالیت نباید خالی باشد.",
                );
            }}
          />
        )}
        {draft.screen === "section" && (
          <AssessmentSectionIntro
            dimension={question.dimension}
            onNext={() => update({ screen: "question" })}
            onBack={() =>
              draft.questionIndex === 0
                ? update({ screen: "profile" })
                : update({
                    screen: "question",
                    questionIndex: draft.questionIndex - 1,
                  })
            }
          />
        )}
        {draft.screen === "question" && (
          <AssessmentQuestion
            question={question}
            index={draft.questionIndex}
            answer={draft.answers[question.id]}
            onAnswer={(answer) =>
              setDraft((old) => ({
                ...old,
                answers: { ...old.answers, [question.id]: answer },
                completedAt: null,
              }))
            }
            onBack={backQuestion}
            onNext={nextQuestion}
          />
        )}
        {draft.screen === "results" && report && (
          <AssessmentResults
            result={report}
            profile={draft.profile}
            completedAt={draft.completedAt}
            onRoadmap={() => update({ screen: "roadmap" })}
            onReview={() => update({ screen: "question", questionIndex: 0 })}
          />
        )}
        {draft.screen === "roadmap" && report && (
          <ImprovementPreview
            result={report}
            onBack={() => update({ screen: "results" })}
          />
        )}
      </div>
      {validation && (
        <p role="alert" className="assessment-alert">
          {validation}
        </p>
      )}
      {draft.screen !== "intro" && !storageError && (
        <p className="assessment-save-status">
          <Check size={13} />
          پیشرفت شما در همین مرورگر ذخیره شده است.
        </p>
      )}
      {confirmRestart && (
        <div className="dialog-backdrop" onClick={closeRestart}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="restart-title"
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeRestart();
              if (e.key === "Tab") {
                const buttons = e.currentTarget.querySelectorAll("button");
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault();
                  buttons[1].focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === buttons[1]
                ) {
                  e.preventDefault();
                  buttons[0].focus();
                }
              }
            }}
          >
            <h2 id="restart-title">ارزیابی را از ابتدا شروع می‌کنید؟</h2>
            <p className="muted">
              مشخصات شرکت، پاسخ‌ها و گزارش ذخیره‌شده این ارزیابی پاک می‌شوند.
              این کار قابل بازگشت نیست.
            </p>
            <div className="assessment-navigation">
              <button
                autoFocus
                className="assessment-secondary"
                onClick={closeRestart}
              >
                انصراف
              </button>
              <button className="assessment-primary" onClick={restart}>
                تأیید و شروع مجدد
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
