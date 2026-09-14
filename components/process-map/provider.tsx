"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSystem } from "@/components/system/provider";
import { type MapStore, type ProcessMap } from "@/lib/system/maps/model";
import {
  MAP_STORAGE_KEY,
  parseMaps,
  replaceMap,
} from "@/lib/system/maps/persistence";
import { seedMaps } from "@/lib/system/maps/seed";
import { StorageRecovery } from '../system/recovery';
type Context = {
  store: MapStore | null;
  error: string;
  status: string;
  save: (map: ProcessMap) => void;
};
const MapContext = createContext<Context | null>(null);
export function useMaps() {
  const c = useContext(MapContext);
  if (!c) throw new Error("Map provider missing");
  return c;
}
export function ProcessMapsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data } = useSystem();
  const [store, setStore] = useState<MapStore | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("در حال بازیابی نقشه…");
  const current = useRef<MapStore | null>(null),
    last = useRef<string | null>(null),
    blocked = useRef(false),
    initial = useRef(data);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MAP_STORAGE_KEY);
      last.current = raw;
      const next = raw ? parseMaps(raw) : seedMaps(initial.current);
      current.current = next;
      setStore(next);
      setStatus(
        raw ? "نقشه از این مرورگر بازیابی شد" : "فضای محلی · نمونه قابل ویرایش",
      );
    } catch {
      blocked.current = true;
      setError(
        "نقشه ذخیره‌شده قابل بازیابی نیست یا حافظه در دسترس نیست. داده قبلی حفظ شده است.",
      );
    }
  }, []);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (
        (e.key === MAP_STORAGE_KEY || e.key === null) &&
        localStorage.getItem(MAP_STORAGE_KEY) !== last.current
      ) {
        blocked.current = true;
        setError(
          "نقشه در زبانه دیگری تغییر کرده است؛ برای ادامه صفحه را تازه کنید.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function save(map: ProcessMap) {
    try {
      if (blocked.current || !current.current)
        throw new Error("برای ادامه صفحه را تازه کنید؛ داده قبلی حفظ شده است.");
      if (localStorage.getItem(MAP_STORAGE_KEY) !== last.current) {
        blocked.current = true;
        throw new Error(
          "نقشه در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.",
        );
      }
      const next = replaceMap(current.current, map),
        raw = JSON.stringify(next);
      localStorage.setItem(MAP_STORAGE_KEY, raw);
      last.current = raw;
      current.current = next;
      setStore(next);
      setError("");
      setStatus("همه تغییرات در این مرورگر ذخیره شد");
    } catch (e) {
      const message = e instanceof Error ? e.message : "ذخیره ممکن نشد.";
      setError(`ذخیره انجام نشد: ${message}`);
      throw e;
    }
  }
  return (
    <MapContext.Provider value={{ store, error, status, save }}>
      {!store && error && <StorageRecovery storageKey={MAP_STORAGE_KEY} label="نقشه‌ها" validate={parseMaps} />}
      {children}
    </MapContext.Provider>
  );
}
