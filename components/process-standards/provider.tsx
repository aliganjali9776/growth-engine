"use client";
import { StorageRecovery } from "../system/recovery";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSystem } from "@/components/system/provider";
import { useMaps } from "@/components/process-map/provider";
import { useAnalysis } from "@/components/process-analysis/provider";
import {
  STANDARDS_KEY,
  parseStandards,
  replaceStandard,
} from "@/lib/system/standards/persistence";
import {
  emptyRecord,
  type StandardRecord,
  type StandardsStore,
} from "@/lib/system/standards/model";
import {
  approveSOP,
  confirmStandardization,
  confirmImplementation,
  confirmGoLive,
  type StandardSource,
} from "@/lib/system/standards/logic";
import { writeTogether } from "@/lib/system/storage-transaction";
type Value = {
  store: StandardsStore | null;
  error: string;
  status: string;
  save: (r: StandardRecord) => void;
  source: (id: string) => StandardSource | undefined;
  confirm: (
    id: string,
    action: "sop" | "standardize" | "live" | "implement",
    roleId?: string,
  ) => void;
};
const Context = createContext<Value | null>(null);
export function useStandards() {
  const c = useContext(Context);
  if (!c) throw new Error("Standards provider missing");
  return c;
}
export function StandardsProvider({ children }: { children: React.ReactNode }) {
  const { data, commit } = useSystem(),
    maps = useMaps(),
    analysis = useAnalysis(),
    [store, setStore] = useState<StandardsStore | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("در حال بازیابی…"),
    current = useRef<StandardsStore | null>(null),
    last = useRef<string | null>(null),
    blocked = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STANDARDS_KEY),
        next = raw ? parseStandards(raw) : { version: 1 as const, records: [] };
      last.current = raw;
      current.current = next;
      setStore(next);
      setStatus("فضای محلی آماده است");
    } catch {
      blocked.current = true;
      setError(
        "داده استاندارد یا اجرا قابل بازیابی نیست؛ داده قبلی حفظ شده است.",
      );
    }
  }, []);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === STANDARDS_KEY || e.key === null) {
        blocked.current = true;
        setError("اطلاعات در زبانه دیگری تغییر کرده؛ صفحه را تازه کنید.");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function source(id: string) {
    const asis = maps.store?.maps.find((m) => m.processId === id),
      a = analysis.store?.records.find((r) => r.processId === id);
    return asis && a ? { asis, analysis: a, system: data } : undefined;
  }
  function save(record: StandardRecord, nextSystem?: typeof data) {
    try {
      if (blocked.current || !current.current)
        throw new Error("ابتدا صفحه را تازه کنید.");
      const next = replaceStandard(current.current, record),
        raw = JSON.stringify(next),
        write = { key: STANDARDS_KEY, expected: last.current, value: raw };
      if (nextSystem) commit(nextSystem, write);
      else writeTogether(localStorage, [write]);
      last.current = raw;
      current.current = next;
      setStore(next);
      setError("");
      setStatus("تغییرات در این مرورگر ذخیره شد");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ممکن نشد.");
      throw e;
    }
  }
  function confirm(
    id: string,
    action: "sop" | "standardize" | "live" | "implement",
    roleId = "",
  ) {
    const src = source(id),
      r =
        current.current?.records.find((r) => r.processId === id) ??
        emptyRecord(id);
    if (!src || maps.error || analysis.error)
      throw new Error(
        "منبع تأییدشده قابل بررسی نیست؛ ابتدا نقشه و تحلیل را بررسی کنید.",
      );
    if (action === "sop") save(approveSOP(r, src, roleId));
    else if (action === "live") save(confirmGoLive(r, src));
    else {
      const result =
        action === "standardize"
          ? confirmStandardization(r, src)
          : confirmImplementation(r, src);
      save(result.record, result.system);
    }
  }
  return (
    <Context.Provider value={{ store, error, status, save, source, confirm }}>
      {!store && error && (
        <StorageRecovery
          storageKey={STANDARDS_KEY}
          label="استانداردها و اجرا"
          validate={parseStandards}
        />
      )}
      {children}
    </Context.Provider>
  );
}
