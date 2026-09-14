"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSystem } from "@/components/system/provider";
import type { ProcessMap } from "@/lib/system/maps/model";
import {
  type AnalysisStore,
  type AnalysisRecord,
  confirmAnalysis,
  confirmRedesign,
  cloneToBe,
  updateFuture,
} from "@/lib/system/analysis/redesign";
import {
  ANALYSIS_KEY,
  parseAnalysis,
  replaceRecord,
} from "@/lib/system/analysis/persistence";
import { writeTogether } from "@/lib/system/storage-transaction";
import { useMaps } from "@/components/process-map/provider";
import { StorageRecovery } from '../system/recovery';
type Value = {
  store: AnalysisStore | null;
  error: string;
  status: string;
  saveMap: (map: ProcessMap) => void;
  create: (asis: ProcessMap) => void;
  confirm: (asis: ProcessMap, kind: "review" | "approval") => void;
};
const Context = createContext<Value | null>(null);
export function useAnalysis() {
  const c = useContext(Context);
  if (!c) throw new Error("Analysis provider missing");
  return c;
}
export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const { data, commit } = useSystem();
  const maps = useMaps();
  const [store, setStore] = useState<AnalysisStore | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("در حال بازیابی…");
  const current = useRef<AnalysisStore | null>(null),
    last = useRef<string | null>(null),
    blocked = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ANALYSIS_KEY),
        next = raw ? parseAnalysis(raw) : { version: 1 as const, records: [] };
      last.current = raw;
      current.current = next;
      setStore(next);
      setStatus("داده محلی آماده است");
    } catch {
      blocked.current = true;
      setError("داده تحلیل یا TO-BE قابل بازیابی نیست؛ داده قبلی حفظ شده است.");
    }
  }, []);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === ANALYSIS_KEY || e.key === null) {
        blocked.current = true;
        setError("داده در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function persist(record: AnalysisRecord, nextSystem?: typeof data) {
    try {
      if (blocked.current || !current.current)
        throw new Error("برای ادامه صفحه را تازه کنید.");
      const next = replaceRecord(current.current, record),
        raw = JSON.stringify(next),
        write = { key: ANALYSIS_KEY, expected: last.current, value: raw };
      if (nextSystem) commit(nextSystem, write);
      else writeTogether(localStorage, [write]);
      last.current = raw;
      current.current = next;
      setStore(next);
      setError("");
      setStatus("همه تغییرات در این مرورگر ذخیره شد");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره انجام نشد.");
      throw e;
    }
  }
  const record = (id: string) =>
    current.current?.records.find((r) => r.processId === id) ?? {
      processId: id,
    };
  function saveMap(map: ProcessMap) {
    if (map.variant !== "to-be") throw new Error("نسخه نقشه صحیح نیست.");
    persist(updateFuture(record(map.processId), map, data));
  }
  function create(asis: ProcessMap) {
    if (record(asis.processId).toBe)
      throw new Error("نسخه TO-BE موجود است و بازنویسی نمی‌شود.");
    saveMap(cloneToBe(asis));
  }
  function confirm(asis: ProcessMap, kind: "review" | "approval") {
    if (maps.error)
      throw new Error(
        "نقشه AS-IS نیازمند بازیابی است؛ ابتدا صفحه را تازه کنید.",
      );
    const r = record(asis.processId),
      result =
        kind === "review"
          ? confirmAnalysis(data, asis, r)
          : confirmRedesign(data, asis, r);
    persist(result.record, result.system);
  }
  return (
    <Context.Provider
      value={{ store, error, status, saveMap, create, confirm }}
    >
      {!store && error && <StorageRecovery storageKey={ANALYSIS_KEY} label="تحلیل و طراحی" validate={parseAnalysis} />}
      {children}
    </Context.Provider>
  );
}
