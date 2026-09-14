export interface StorageWrite {
  key: string;
  expected: string | null;
  value: string;
}
export function writeTogether(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  writes: StorageWrite[],
) {
  if (new Set(writes.map((w) => w.key)).size !== writes.length)
    throw new Error("کلید تکراری ذخیره‌سازی");
  for (const w of writes)
    if (storage.getItem(w.key) !== w.expected)
      throw new Error(
        "اطلاعات در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.",
      );
  const done: StorageWrite[] = [];
  try {
    for (const w of writes) {
      storage.setItem(w.key, w.value);
      done.push(w);
    }
  } catch {
    let restored = true;
    for (const w of done.reverse())
      try {
        if (w.expected === null) storage.removeItem(w.key);
        else storage.setItem(w.key, w.expected);
      } catch {
        restored = false;
      }
    throw new Error(
      restored
        ? "ذخیره ممکن نشد؛ تغییرات برگردانده شدند."
        : "ذخیره ناقص است؛ صفحه را تازه کرده و وضعیت تأیید و مرحله را بررسی کنید.",
    );
  }
}
