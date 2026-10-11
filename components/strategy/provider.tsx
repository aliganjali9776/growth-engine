"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  STRATEGY_KEY,
  parseStrategy,
  validateStrategy,
  type StrategyRole,
  type StrategyStore,
} from "@/lib/strategy/model";
import { seedStrategy } from "@/lib/strategy/seed";
import { withSampleKRs } from "@/lib/strategy/kr/seed";
import { withSampleInitiatives } from "@/lib/strategy/initiatives/seed";
import { parseSystem, SYSTEM_STORAGE_KEY } from "@/lib/system/persistence";
import { createSystemSeed } from "@/lib/system/seed";
import { parseDraft, STORAGE_KEY } from "@/lib/assessment/persistence";
import { calculateScores, isComplete } from "@/lib/assessment/scoring";
import { StorageRecovery } from "@/components/system/recovery";
import "@/components/system/system.css";
import "./strategy.css";
import { persistStrategy } from "@/lib/domain-services/strategy-persistence";
type Evidence = ReturnType<typeof calculateScores>["scores"];
type Value = {
  store: StrategyStore;
  roles: StrategyRole[];
  evidence: Evidence | null;
  commit: (next: StrategyStore) => void;
};
const Context = createContext<Value | null>(null);
export function useStrategy() {
  const c = useContext(Context);
  if (!c) throw Error("Strategy provider missing");
  return c;
}
export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StrategyStore | null>(null),
    [roles, setRoles] = useState<StrategyRole[]>([]),
    [evidence, setEvidence] = useState<Evidence | null>(null),
    [error, setError] = useState(""),
    [sourceNotice, setSourceNotice] = useState(""),
    [saved, setSaved] = useState(false);
  const rawRef = useRef<string | null>(null),
    blocked = useRef(false),
    path = usePathname(),
    searchParams = useSearchParams();
  const ready = store !== null;
  useEffect(() => {
    if (!ready || !window.location.hash) return;
    // The requested KR is rendered only after local persistence has loaded.
    try {
      document
        .getElementById(decodeURIComponent(window.location.hash.slice(1)))
        ?.scrollIntoView();
    } catch {
      // A malformed external fragment must not interrupt the page.
    }
  }, [ready, path]);
  useEffect(() => {
    function readSources() {
      const notices: string[] = [];
      let available: StrategyRole[] = [];
      try {
        const raw = businessStorage.getItem(SYSTEM_STORAGE_KEY);
        // Match System's own unsaved initial view without creating another role store.
        const system = raw === null ? createSystemSeed() : parseSystem(raw);
        available = system.roles.map((role) => ({
          ...role,
          personName: system.people.find(
            (person) =>
              person.id === role.personId && person.status === "active",
          )?.name,
        }));
      } catch {
        notices.push(
          "داده نقش‌های سیستم قابل خواندن نیست؛ مالکیت اهداف نیازمند بررسی است.",
        );
      }
      setRoles(available);
      try {
        const raw = businessStorage.getItem(STORAGE_KEY),
          draft = raw ? parseDraft(raw) : null;
        setEvidence(
          draft?.completedAt && isComplete(draft.answers)
            ? calculateScores(draft.answers).scores
            : null,
        );
      } catch {
        setEvidence(null);
        notices.push("داده ارزیابی قابل خواندن نیست.");
      }
      setSourceNotice(notices.join(" "));
      return available;
    }
    const available = readSources();
    try {
      const raw = businessStorage.getItem(STRATEGY_KEY);
      rawRef.current = raw;
      const next =
        raw === null
          ? withSampleInitiatives(
              withSampleKRs(seedStrategy(available)),
              available,
            )
          : parseStrategy(raw);
      setStore(next);
      setSaved(raw !== null);
    } catch {
      blocked.current = true;
      setError("داده استراتژی قابل بازیابی نیست؛ داده قبلی حفظ شده است.");
    }
    function changed(e: StorageEvent) {
      if (e.key === STRATEGY_KEY || e.key === null) {
        blocked.current = true;
        setError(
          "داده در زبانه دیگری تغییر کرده است؛ قبل از ویرایش صفحه را تازه کنید.",
        );
      }
      if (
        e.key === SYSTEM_STORAGE_KEY ||
        e.key === STORAGE_KEY ||
        e.key === null
      )
        readSources();
    }
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function commit(next: StrategyStore) {
    if (blocked.current) throw Error(error);
    const valid = validateStrategy(next),
      raw = persistStrategy(businessStorage, valid, rawRef.current);
    rawRef.current = raw;
    setStore(valid);
    setSaved(true);
  }
  if (!store)
    return (
      <section className="strategy">
        <h1>استراتژی</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <StorageRecovery
              storageKey={STRATEGY_KEY}
              label="استراتژی"
              validate={parseStrategy}
            />
          </>
        ) : (
          <p role="status">در حال خواندن داده‌های استراتژی…</p>
        )}
      </section>
    );
  const cycleId =
    path.match(/^\/strategy\/cycles\/([^/]+)/)?.[1] ??
    store.adaptReviews?.find(
      (r) => r.id === path.match(/^\/strategy\/adapt\/([^/]+)/)?.[1],
    )?.cycleId ??
    store.weeklyReviews?.find(
      (r) => r.id === path.match(/^\/strategy\/weekly-review\/([^/]+)/)?.[1],
    )?.cycleId ??
    store.initiatives?.find(
      (i) => i.id === path.match(/^\/strategy\/initiatives\/([^/]+)/)?.[1],
    )?.cycleId ??
    searchParams.get("cycle") ??
    store.cycles.find((c) => c.status === "active")?.id;
  const base = cycleId ? `/strategy/cycles/${cycleId}` : "/strategy/cycles";
  const links = [
    ["/strategy", "نمای مدیریتی"],
    ["/strategy/dashboard", "داشبورد استراتژی"],
    ["/strategy/cycles", "دوره استراتژیک"],
    [
      cycleId ? base + "/priorities" : "/strategy/cycles",
      "اولویت‌های استراتژیک",
    ],
    [cycleId ? base + "/objectives" : "/strategy/cycles", "اهداف"],
    ["/strategy/key-results", "نتایج کلیدی"],
    ["/strategy/initiatives", "اقدامات استراتژیک"],
    ["/strategy/weekly-review", "مرور هفتگی"],
    ["/strategy/adapt", "تطبیق ماهانه"],
    [cycleId ? base + "/learn" : "/strategy/cycles", "یادگیری و دوره بعد"],
    ["/strategy/reports", "گزارش‌ها"],
  ];
  return (
    <Context.Provider value={{ store, roles, evidence, commit }}>
      <div
        className={
          "strategy" +
          (path.startsWith("/strategy/dashboard") ||
          path.startsWith("/strategy/reports")
            ? " st-cockpit"
            : "")
        }
      >
        <header className="st-heading">
          <span>STRATEGY · DIRECTION BEFORE EXECUTION</span>
          <h1>استراتژی؛ انتخاب مسیر رشد</h1>
          <p>
            تشخیص ← انتخاب ← هدف‌گذاری ← اجرا ← مرور هفتگی{" "}
            <span className="st-muted">
              ← تطبیق ماهانه ← یادگیری و دوره بعد
            </span>
          </p>
          <small role="status">
            {saved
              ? businessStorage.serverExecutionDisabled
                ? "وضعیت ذخیره در بالای صفحه نمایش داده می‌شود"
                : "تغییرات در این مرورگر ذخیره شد"
              : "نمونه اولیه؛ با اولین تغییر ذخیره می‌شود"}
          </small>
        </header>
        <nav className="st-nav" aria-label="بخش‌های استراتژی">
          {links.map(([href, label], i) => (
            <Link
              key={label}
              href={
                cycleId &&
                [
                  "/strategy/dashboard",
                  "/strategy/reports",
                  "/strategy/key-results",
                  "/strategy/initiatives",
                  "/strategy/weekly-review",
                  "/strategy/adapt",
                ].includes(href)
                  ? `${href}?cycle=${encodeURIComponent(cycleId)}`
                  : href
              }
              aria-current={
                (path === href ||
                  ([
                    "/strategy/initiatives",
                    "/strategy/weekly-review",
                    "/strategy/adapt",
                    "/strategy/reports",
                  ].includes(href) &&
                    path.startsWith(href + "/"))) &&
                (cycleId || i < 3 || i > 4)
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        {store.sample && (
          <p className="st-sample">
            این فضا شامل نمونه قابل ویرایش است؛ شواهد واقعی کسب‌وکار محسوب
            نمی‌شود. برای شروع مستقل، دوره جدید بسازید.
          </p>
        )}
        {sourceNotice && (
          <p role="status" className="st-notice">
            {sourceNotice}
          </p>
        )}
        {error && (
          <p role="alert" className="st-notice">
            {error}
          </p>
        )}
        {children}
      </div>
    </Context.Provider>
  );
}
