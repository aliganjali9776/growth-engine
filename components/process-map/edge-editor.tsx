"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import type { ProcessMap, ProcessConnection } from "@/lib/system/maps/model";
export function EdgeEditor({
  map,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  map: ProcessMap;
  initial: ProcessConnection;
  onSave: (edge: ProcessConnection) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title={onDelete ? "ویرایش اتصال" : "اتصال مرحله‌ها"}
      description="جهت حرکت و شرط عبور را مشخص کنید. شاخه‌های تصمیم می‌توانند مسیرهای متفاوت داشته باشند."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(draft);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ثبت اتصال ممکن نشد.");
          }
        }}
      >
        {(["sourceStepId", "targetStepId"] as const).map((key) => (
          <Field
            key={key}
            label={key === "sourceStepId" ? "مرحله مبدأ" : "مرحله مقصد"}
          >
            <select
              required
              disabled={!!onDelete}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            >
              <option value="">انتخاب مرحله</option>
              {map.steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field label="برچسب اتصال">
          <input
            value={draft.label}
            placeholder="مثلاً بله یا خیر"
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </Field>
        <Field label="شرط عبور">
          <textarea
            value={draft.condition}
            placeholder="مثلاً تخفیف بیش از ۱۰ درصد"
            onChange={(e) => setDraft({ ...draft, condition: e.target.value })}
          />
        </Field>
        {error && (
          <p role="alert" className="sys-alert">
            {error}
          </p>
        )}
        <Button type="submit">ثبت اتصال</Button>
        {onDelete && (
          <Button
            secondary
            onClick={() => {
              try {
                onDelete();
                onClose();
              } catch {
                setError("حذف اتصال ذخیره نشد.");
              }
            }}
          >
            حذف اتصال
          </Button>
        )}
      </form>
    </Drawer>
  );
}
