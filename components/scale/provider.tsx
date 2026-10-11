"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SCALE_KEY, type ScaleStore } from "@/lib/scale/model";
import { seedScale } from "@/lib/scale/seed";
import { parseScale, persistScale } from "@/lib/scale/persistence";
import { readScaleSources, type ScaleSources } from "@/lib/scale/sources";
import "@/components/system/system.css";
import "./scale.css";
const Context = createContext<{
  store: ScaleStore;
  sources: ScaleSources;
  commit: (s: ScaleStore) => void;
} | null>(null);
export function useScale() {
  const c = useContext(Context);
  if (!c) throw Error("Scale provider missing");
  return c;
}
export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<ScaleStore | null>(null),
    [sources, setSources] = useState<ScaleSources | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("داده‌های محلی آماده‌اند");
  const raw = useRef<string | null>(null),
    path = usePathname();
  useEffect(() => {
    try {
      const refs = readScaleSources(businessStorage);
      setSources(refs);
      raw.current = businessStorage.getItem(SCALE_KEY);
      setStore(
        raw.current === null
          ? seedScale(undefined, refs.roles[0]?.id)
          : parseScale(raw.current),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "خواندن داده ممکن نشد.");
    }
    const handler = (e: StorageEvent) => {
      if (e.key === SCALE_KEY || e.key === null)
        setError(
          "اطلاعات در زبانه دیگری تغییر کرده است؛ پیش از ذخیره صفحه را تازه کنید.",
        );
      else setSources(readScaleSources(businessStorage));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  function commit(next: ScaleStore) {
    try {
      raw.current = persistScale(businessStorage, next, raw.current);
      setStore(next);
      setError("");
      setStatus(
        businessStorage.serverExecutionDisabled
          ? "وضعیت ذخیره در بالای صفحه نمایش داده می‌شود"
          : "تغییرات در همین مرورگر ذخیره شد",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره انجام نشد");
      throw e;
    }
  }
  return (
    <div
      className={
        "scale-shell" +
        (path.startsWith("/scale/dashboard") ||
        path.startsWith("/scale/reports")
          ? " scale-executive-shell"
          : "")
      }
    >
      <header className="scale-heading">
        <span>GROWTH LAB · SCALE FOUNDATION</span>
        <h1>رشد؛ از تشخیص تا یادگیری و تصمیم</h1>
        <p>
          تشخیص ← گلوگاه ← اهرم ← ایده ← آزمایش ← اندازه‌گیری ← یادگیری ← تصمیم
        </p>
      </header>
      <nav className="scale-nav" aria-label="بخش‌های رشد">
        {[
          ["dashboard", "داشبورد مدیریت رشد"],
          ["", "نمای مدیریتی"],
          ["diagnosis", "تشخیص رشد"],
          ["constraints", "گلوگاه‌های رشد"],
          ["levers", "اهرم‌های رشد"],
          ["ideas", "ایده‌های رشد"],
          ["experiments", "آزمایش‌ها"],
          ["funnel", "قیف رشد"],
          ["channels", "کانال‌های رشد"],
          ["loops", "حلقه‌های رشد"],
          ["readiness", "آمادگی مقیاس‌دهی"],
          ["capacity", "ظرفیت"],
          ["scale-decisions", "تصمیم مقیاس‌دهی"],
          ["reports", "گزارش رشد"],
        ].map(([slug, label]) => (
          <Link
            key={slug}
            href={"/scale" + (slug ? "/" + slug : "")}
            aria-current={
              (
                slug
                  ? path === "/scale/" + slug ||
                    path.startsWith("/scale/" + slug + "/")
                  : path === "/scale"
              )
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {error && (
        <div role="alert" className="scale-notice">
          {error}{" "}
          <button onClick={() => window.location.reload()}>
            خواندن دوباره
          </button>
          <p>
            داده قبلی پاک یا بازنویسی نشده است. برای بازیابی، نسخه ذخیره‌شده
            مرورگر را نگه دارید.
          </p>
        </div>
      )}
      {store && sources ? (
        <Context.Provider value={{ store, sources, commit }}>
          <p role="status" className="scale-muted">
            {status}
          </p>
          {store.sample && (
            <p className="scale-notice">
              این فضا با نمونه آموزشی مشاوره شروع شده است؛ داده‌ها و فرض‌های
              نمونه، شواهد واقعی شرکت شما نیستند.
            </p>
          )}
          {sources.notices.length > 0 && (
            <details>
              <summary>بعضی منابع در دسترس نیستند</summary>
              {sources.notices.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </details>
          )}
          {children}
        </Context.Provider>
      ) : (
        !error && <p role="status">در حال خواندن داده‌های رشد…</p>
      )}
    </div>
  );
}
