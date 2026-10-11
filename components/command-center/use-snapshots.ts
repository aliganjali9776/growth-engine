"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useEffect, useRef, useState } from "react";
import {
  SNAPSHOT_KEY,
  parseSnapshots,
  type SnapshotStore,
  type SystemHealthSnapshot,
} from "@/lib/system/command-center/snapshots";
import { writeTogether } from "@/lib/system/storage-transaction";
export function useSnapshots() {
  const [store, set] = useState<SnapshotStore | null>(null),
    [error, setError] = useState(""),
    last = useRef<string | null>(null),
    current = useRef<SnapshotStore | null>(null),
    blocked = useRef(false);
  useEffect(() => {
    try {
      const raw = businessStorage.getItem(SNAPSHOT_KEY),
        next = raw
          ? parseSnapshots(raw)
          : { version: 1 as const, snapshots: [] };
      last.current = raw;
      current.current = next;
      set(next);
    } catch (e) {
      blocked.current = true;
      setError(e instanceof Error ? e.message : "بازیابی تاریخچه ممکن نشد.");
    }
  }, []);
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === SNAPSHOT_KEY || e.key === null) {
        blocked.current = true;
        setError("تاریخچه در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function write(snapshots: SystemHealthSnapshot[]) {
    try {
      if (blocked.current || !current.current)
        throw new Error("تاریخچه آماده ذخیره نیست؛ صفحه را تازه کنید.");
      const raw = JSON.stringify({ version: 1, snapshots }),
        next = parseSnapshots(raw);
      writeTogether(businessStorage, [
        { key: SNAPSHOT_KEY, expected: last.current, value: raw },
      ]);
      last.current = raw;
      current.current = next;
      set(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره نشد.");
      throw e;
    }
  }
  return {
    store,
    error,
    append: (snapshot: SystemHealthSnapshot) =>
      write([...(current.current?.snapshots ?? []), snapshot]),
    remove: (id: string) =>
      write((current.current?.snapshots ?? []).filter((x) => x.id !== id)),
  };
}
