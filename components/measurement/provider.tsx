"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { StorageRecovery } from "../system/recovery";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSystem } from "@/components/system/provider";
import { useMaps } from "@/components/process-map/provider";
import { useStandards } from "@/components/process-standards/provider";
import {
  MEASUREMENT_KEY,
  parseMeasurement,
  validateMeasurement,
} from "@/lib/system/measurement/persistence";
import {
  emptyMeasurement,
  type MeasurementStore,
  type MeasurementRecord,
} from "@/lib/system/measurement/model";
import { confirmMeasurement } from "@/lib/system/measurement/readiness";
import type { ProcessEvidence } from "@/lib/system/measurement/health";
import { persistMeasurement } from "@/lib/system/measurement/commands";
type Value = {
  store: MeasurementStore | null;
  error: string;
  status: string;
  record: (id: string) => MeasurementRecord;
  evidence: (id: string) => ProcessEvidence;
  save: (r: MeasurementRecord) => void;
  confirm: (id: string, kind: "measured" | "improving") => void;
};
const Context = createContext<Value | null>(null);
export function useMeasurement() {
  const c = useContext(Context);
  if (!c) throw new Error("Measurement provider missing");
  return c;
}
export function MeasurementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, commit } = useSystem(),
    maps = useMaps(),
    standards = useStandards(),
    [store, setStore] = useState<MeasurementStore | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("در حال بازیابی…"),
    current = useRef<MeasurementStore | null>(null),
    last = useRef<string | null>(null),
    blocked = useRef(false);
  useEffect(() => {
    try {
      const raw = businessStorage.getItem(MEASUREMENT_KEY),
        next = raw
          ? parseMeasurement(raw)
          : { version: 1 as const, records: [] };
      last.current = raw;
      current.current = next;
      setStore(next);
      setStatus("داده‌های محلی آماده‌اند");
    } catch (e) {
      blocked.current = true;
      setError(e instanceof Error ? e.message : "بازیابی ممکن نشد.");
    }
  }, []);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === MEASUREMENT_KEY || e.key === null) {
        blocked.current = true;
        setError("داده در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const record = (id: string) =>
    current.current?.records.find((r) => r.processId === id) ??
    emptyMeasurement(id);
  const evidence = (id: string): ProcessEvidence => ({
    system: data,
    asis: maps.store?.maps.find((m) => m.processId === id),
    source: standards.source(id),
    standard: standards.store?.records.find((r) => r.processId === id),
  });
  function save(r: MeasurementRecord, nextSystem?: typeof data) {
    try {
      if (blocked.current || !current.current)
        throw new Error("ذخیره آماده نیست؛ صفحه را تازه کنید.");
      if (!data.processes.some((p) => p.id === r.processId))
        throw new Error("فرآیند وجود ندارد.");
      const next = validateMeasurement({
          ...current.current,
          records: [
            ...current.current.records.filter(
              (x) => x.processId !== r.processId,
            ),
            r,
          ],
        }),
        raw = JSON.stringify(next),
        write = { key: MEASUREMENT_KEY, value: raw, expected: last.current };
      if (nextSystem) commit(nextSystem, write);
      else persistMeasurement(businessStorage, next, last.current);
      last.current = raw;
      current.current = next;
      setStore(next);
      setError("");
      setStatus(
        businessStorage.serverExecutionDisabled
          ? "وضعیت ذخیره در بالای صفحه نمایش داده می‌شود"
          : "تغییرات در این مرورگر ذخیره شد",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد.");
      throw e;
    }
  }
  function confirm(id: string, kind: "measured" | "improving") {
    if (maps.error || standards.error)
      throw new Error("ابتدا خطای منبع نقشه یا استاندارد را رفع کنید.");
    const result = confirmMeasurement(record(id), evidence(id), kind);
    save(result.record, result.system);
  }
  return (
    <Context.Provider
      value={{ store, error, status, record, evidence, save, confirm }}
    >
      {!store && error && (
        <StorageRecovery
          storageKey={MEASUREMENT_KEY}
          label="اندازه‌گیری و بهبود"
          validate={parseMeasurement}
        />
      )}
      {children}
    </Context.Provider>
  );
}
