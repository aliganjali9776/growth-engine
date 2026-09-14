"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, CheckCircle2, AlertTriangle } from "lucide-react";
import type { SystemData } from "@/lib/system/types";
import { createSystemSeed } from "@/lib/system/seed";
import {
  parseSystem,
  SYSTEM_STORAGE_KEY,
  validateSystem,
} from "@/lib/system/persistence";
import "./system.css";
import { MAP_STORAGE_KEY, parseMaps } from "@/lib/system/maps/persistence";
import { seedMaps } from "@/lib/system/maps/seed";
import {
  writeTogether,
  type StorageWrite,
} from "@/lib/system/storage-transaction";
import { ANALYSIS_KEY, parseAnalysis } from "@/lib/system/analysis/persistence";
import {
  STANDARDS_KEY,
  parseStandards,
} from "@/lib/system/standards/persistence";
import { guardStage, referencedRoles } from "@/lib/system/standards/guards";
import {
  MEASUREMENT_KEY,
  parseMeasurement,
} from "@/lib/system/measurement/persistence";
import { guardMeasurementStage } from "@/lib/system/measurement/readiness";
import { guardEarlyStage } from "@/lib/system/lifecycle";
import { StorageRecovery } from "./recovery";
type Context = {
  data: SystemData;
  error: string;
  commit: (next: SystemData, companion?: StorageWrite) => void;
};
const SystemContext = createContext<Context | null>(null);
export function useSystem() {
  const c = useContext(SystemContext);
  if (!c) throw new Error("System provider missing");
  return c;
}
const links = [
  ["/system/command-center", "مرکز فرمان"],
  ["/system", "نمای کلی"],
  ["/system/organization", "ساختار سازمانی"],
  ["/system/people", "افراد و نقش‌ها"],
  ["/system/processes", "فرآیندها"],
  ["/system/pipeline", "پایپ‌لاین سیستم‌سازی"],
  ["/system/independence", "آزمون استقلال ۳۰ روزه"],
];
export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SystemData | null>(null),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false);
  const path = usePathname();
  const lastRaw = useRef<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SYSTEM_STORAGE_KEY);
      lastRaw.current = raw;
      setData(raw ? parseSystem(raw) : createSystemSeed());
      setSaved(!!raw);
    } catch {
      setBlocked(true);
      setError(
        "داده‌های ذخیره‌شده قابل بازیابی نیستند یا دسترسی به حافظه مرورگر محدود است. داده قبلی بازنویسی نشده است.",
      );
    }
  }, []);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (
        (e.key === SYSTEM_STORAGE_KEY || e.key === null) &&
        e.newValue !== lastRaw.current
      ) {
        setBlocked(true);
        setError(
          "اطلاعات در زبانه دیگری تغییر کرده است. برای جلوگیری از بازنویسی، صفحه را تازه کنید.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function commit(next: SystemData, companion?: StorageWrite) {
    if (blocked) throw new Error(error);
    const valid = validateSystem(next);
    for (const p of valid.processes) {
      if (
        data?.processes.find((x) => x.id === p.id)?.systemizationStage !==
          p.systemizationStage &&
        [
          "mapped",
          "analyzed",
          "redesigned",
          "standardized",
          "implemented",
          "measured",
          "improving",
        ].includes(p.systemizationStage)
      ) {
        const rawStandards =
            companion?.key === STANDARDS_KEY
              ? companion.value
              : localStorage.getItem(STANDARDS_KEY),
          record = rawStandards
            ? parseStandards(rawStandards).records.find(
                (r) => r.processId === p.id,
              )
            : undefined,
          rawMaps = localStorage.getItem(MAP_STORAGE_KEY),
          asis = (rawMaps ? parseMaps(rawMaps) : seedMaps(data!)).maps.find(
            (m) => m.processId === p.id,
          ),
          rawAnalysis =
            companion?.key === ANALYSIS_KEY
              ? companion.value
              : localStorage.getItem(ANALYSIS_KEY),
          analysis = rawAnalysis
            ? parseAnalysis(rawAnalysis).records.find(
                (r) => r.processId === p.id,
              )
            : undefined;
        guardEarlyStage(p.systemizationStage, valid, asis, analysis);
        if (["measured", "improving"].includes(p.systemizationStage)) {
          const raw =
            companion?.key === MEASUREMENT_KEY
              ? companion.value
              : localStorage.getItem(MEASUREMENT_KEY);
          guardMeasurementStage(
            p.systemizationStage,
            raw
              ? parseMeasurement(raw).records.find((r) => r.processId === p.id)
              : undefined,
            {
              system: valid,
              asis,
              standard: record,
              source:
                asis && analysis
                  ? { asis, analysis, system: valid }
                  : undefined,
            },
          );
        } else
          guardStage(
            p.systemizationStage,
            record,
            asis && analysis ? { asis, analysis, system: valid } : undefined,
          );
      }
    }
    const removedProcesses =
      data?.processes.filter(
        (p) => !valid.processes.some((n) => n.id === p.id),
      ) ?? [];
    if (removedProcesses.length) {
      const mapRaw = localStorage.getItem(MAP_STORAGE_KEY);
      const used = new Set(
        (mapRaw ? parseMaps(mapRaw) : seedMaps(data!)).maps.map(
          (m) => m.processId,
        ),
      );
      for (const [key, parse] of [
        [ANALYSIS_KEY, parseAnalysis],
        [STANDARDS_KEY, parseStandards],
        [MEASUREMENT_KEY, parseMeasurement],
      ] as const) {
        const raw = localStorage.getItem(key);
        if (raw)
          for (const record of parse(raw).records) used.add(record.processId);
      }
      if (removedProcesses.some((p) => used.has(p.id)))
        throw new Error(
          "این فرآیند دارای نقشه یا سابقه اجرایی است؛ برای حفظ ارتباط‌ها، وضعیت آن را بایگانی کنید.",
        );
    }
    const removedRoles =
      data?.roles.filter((r) => !valid.roles.some((n) => n.id === r.id)) ?? [];
    if (removedRoles.length) {
      let usedRoles: (string | undefined)[];
      try {
        const mapRaw = localStorage.getItem(MAP_STORAGE_KEY);
        usedRoles = (mapRaw ? parseMaps(mapRaw) : seedMaps(data!)).maps.flatMap(
          (m) => m.steps.map((s) => s.ownerRoleId),
        );
      } catch {
        throw new Error(
          "ارتباط نقش با نقشه‌ها قابل بررسی نیست؛ ابتدا مشکل حافظه نقشه را برطرف کنید.",
        );
      }
      const analysisRaw = localStorage.getItem(ANALYSIS_KEY);
      if (analysisRaw)
        usedRoles.push(
          ...parseAnalysis(analysisRaw).records.flatMap(
            (r) => r.toBe?.steps.map((s) => s.ownerRoleId) ?? [],
          ),
        );
      const standardsRaw = localStorage.getItem(STANDARDS_KEY);
      const measurementRaw = localStorage.getItem(MEASUREMENT_KEY);
      if (measurementRaw)
        usedRoles.push(
          ...parseMeasurement(measurementRaw).records.flatMap((r) => [
            ...r.kpis.map((k) => k.ownerRoleId),
            ...r.improvements.map((x) => x.ownerRoleId),
            ...r.reviews.map((x) => x.reviewedByRoleId),
          ]),
        );
      if (standardsRaw)
        usedRoles.push(
          ...parseStandards(standardsRaw).records.flatMap(referencedRoles),
        );
      if (removedRoles.some((r) => usedRoles.includes(r.id)))
        throw new Error(
          "این نقش در نقشه، استاندارد یا سابقه عملکرد استفاده شده است؛ ابتدا ارتباط‌های مربوط را بررسی کنید.",
        );
    }
    const raw = JSON.stringify(valid);
    try {
      if (localStorage.getItem(SYSTEM_STORAGE_KEY) !== lastRaw.current)
        throw new Error(
          "اطلاعات در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.",
        );
      writeTogether(localStorage, [
        { key: SYSTEM_STORAGE_KEY, expected: lastRaw.current, value: raw },
        ...(companion ? [companion] : []),
      ]);
      lastRaw.current = raw;
    } catch (e) {
      throw new Error(
        e instanceof Error
          ? e.message
          : "ذخیره ممکن نشد. تغییری ثبت نشده است؛ فضای حافظه و دسترسی مرورگر را بررسی کنید.",
      );
    }
    setData(valid);
    setSaved(true);
  }
  return (
    <div className="system-app">
      <header className="system-heading">
        <div>
          <span className="eyebrow">THE FOUNDATION OF A SCALABLE BUSINESS</span>
          <h1>
            <Network size={28} />
            سیستم؛ ساختاری برای رشد مستقل
          </h1>
          <p>
            افراد، نقش‌ها و فرآیندها را به یک مسیر روشن سیستم‌سازی متصل کنید.
          </p>
        </div>
        <span className="system-local">
          <CheckCircle2 size={14} />
          {saved
            ? "تغییرات در این مرورگر ذخیره شد"
            : "فضای محلی · شروع با داده نمونه"}
        </span>
      </header>
      <nav className="system-nav" aria-label="بخش‌های سیستم">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              (href === "/system" ? path === href : path.startsWith(href))
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {error && (
        <div className="sys-alert" role="alert">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {data ? (
        <SystemContext.Provider value={{ data, commit, error }}>
          {children}
        </SystemContext.Provider>
      ) : !blocked ? (
        <p role="status">در حال آماده‌سازی سیستم…</p>
      ) : (
        <StorageRecovery
          storageKey={SYSTEM_STORAGE_KEY}
          label="ساختار سیستم"
          validate={parseSystem}
        />
      )}
    </div>
  );
}
