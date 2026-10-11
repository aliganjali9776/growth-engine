"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useState, useRef } from "react";
import { writeTogether } from "@/lib/system/storage-transaction";
import { Button } from "./ui";
// Recovery never replaces source data. Export first, then restore validated JSON.
export function StorageRecovery({
  storageKey,
  label,
  validate,
}: {
  storageKey: string;
  label: string;
  validate: (raw: string) => unknown;
}) {
  const [message, setMessage] = useState(""),
    [backup, setBackup] = useState(false),
    [raw, setRaw] = useState("");
  const original = useRef<string | null>(null);
  return (
    <section className="sys-panel">
      <h2>بازیابی {label}</h2>
      <p>
        داده قبلی حفظ شده است. ابتدا نسخه خام را دریافت کنید؛ سپس محتوای نسخه
        سالم همین بخش را وارد کنید. بخش‌های دیگر تغییر نمی‌کنند.
      </p>
      <Button
        secondary
        onClick={() => {
          try {
            const value = businessStorage.getItem(storageKey);
            if (value === null) throw Error();
            original.current = value;
            const url = URL.createObjectURL(
                new Blob([value], { type: "application/json" }),
              ),
              a = document.createElement("a");
            a.href = url;
            a.download = `${storageKey}.backup.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setBackup(true);
            setMessage(
              "نسخه خام برای دریافت آماده شد. از ذخیره شدن فایل اطمینان حاصل کنید.",
            );
          } catch {
            setMessage(
              "دریافت داده ممکن نشد؛ دسترسی به حافظه مرورگر را بررسی کنید.",
            );
          }
        }}
      >
        دریافت نسخه خام
      </Button>
      <label className="sys-field">
        محتوای نسخه سالم
        <textarea
          dir="ltr"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
      </label>
      <Button
        disabled={!backup || !raw.trim()}
        onClick={() => {
          try {
            validate(raw);
            writeTogether(businessStorage, [
              { key: storageKey, expected: original.current, value: raw },
            ]);
            window.location.reload();
          } catch {
            setMessage(
              "نسخه واردشده معتبر نیست، داده در زبانه دیگری تغییر کرده یا ذخیره ممکن نشد؛ داده قبلی حفظ شده است.",
            );
          }
        }}
      >
        جایگزینی همین بخش با نسخه سالم
      </Button>
      <p role="status">{message}</p>
    </section>
  );
}
