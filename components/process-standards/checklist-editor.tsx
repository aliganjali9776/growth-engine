"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import type { Checklist } from "@/lib/system/standards/model";
import type { ProcessMap } from "@/lib/system/maps/model";
import { RoleField } from "./shared";
export function ChecklistEditor({
  initial,
  map,
  onSave,
  onClose,
}: {
  initial: Checklist;
  map: ProcessMap;
  onSave: (c: Checklist) => void;
  onClose: () => void;
}) {
  const [c, setC] = useState(initial),
    [error, setError] = useState("");
  const items = (next: Checklist["items"]) =>
    setC({ ...c, items: next.map((x, order) => ({ ...x, order })) });
  return (
    <Drawer
      open
      onClose={onClose}
      title="چک‌لیست اجرایی"
      description="تعریف چک‌لیست قابل استفاده مجدد؛ این بخش سابقه اجرای روزانه نیست."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave({ ...c, updatedAt: new Date().toISOString() });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد.");
          }
        }}
      >
        <Field label="نام چک‌لیست">
          <input
            required
            value={c.name}
            onChange={(e) => setC({ ...c, name: e.target.value })}
          />
        </Field>
        <Field label="توضیح چک‌لیست">
          <textarea
            value={c.description}
            onChange={(e) => setC({ ...c, description: e.target.value })}
          />
        </Field>
        <Field label="زمان استفاده">
          <input
            value={c.trigger}
            onChange={(e) => setC({ ...c, trigger: e.target.value })}
          />
        </Field>
        <RoleField
          label="مالک چک‌لیست"
          value={c.ownerRoleId}
          onChange={(ownerRoleId) => setC({ ...c, ownerRoleId })}
        />
        <Field label="وضعیت چک‌لیست">
          <select
            value={c.status}
            onChange={(e) =>
              setC({ ...c, status: e.target.value as Checklist["status"] })
            }
          >
            <option value="draft">پیش‌نویس</option>
            <option value="ready">آماده</option>
          </select>
        </Field>
        {c.items.map((x, i) => (
          <section className="checklist-item-editor" key={x.id}>
            <Field label={`عنوان مورد ${i + 1}`}>
              <input
                value={x.title}
                onChange={(e) =>
                  items(
                    c.items.map((y) =>
                      y.id === x.id ? { ...y, title: e.target.value } : y,
                    ),
                  )
                }
              />
            </Field>
            <label className="sys-check">
              <input
                type="checkbox"
                checked={x.required}
                onChange={(e) =>
                  items(
                    c.items.map((y) =>
                      y.id === x.id ? { ...y, required: e.target.checked } : y,
                    ),
                  )
                }
              />
              الزامی
            </label>
            <Field label={`مرحله مرتبط ${i + 1}`}>
              <select
                value={x.relatedStepId}
                onChange={(e) =>
                  items(
                    c.items.map((y) =>
                      y.id === x.id
                        ? { ...y, relatedStepId: e.target.value }
                        : y,
                    ),
                  )
                }
              >
                <option value="">کل فرآیند</option>
                {map.steps.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`یادداشت مورد ${i + 1}`}>
              <input
                value={x.note}
                onChange={(e) =>
                  items(
                    c.items.map((y) =>
                      y.id === x.id ? { ...y, note: e.target.value } : y,
                    ),
                  )
                }
              />
            </Field>
            <div className="standard-inline">
              <Button
                secondary
                disabled={i === 0}
                onClick={() => {
                  const next = [...c.items];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  items(next);
                }}
              >
                بالاتر
              </Button>
              <Button
                secondary
                disabled={i === c.items.length - 1}
                onClick={() => {
                  const next = [...c.items];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  items(next);
                }}
              >
                پایین‌تر
              </Button>
              <Button
                secondary
                onClick={() => items(c.items.filter((y) => y.id !== x.id))}
              >
                حذف مورد
              </Button>
            </div>
          </section>
        ))}
        <Button
          secondary
          onClick={() =>
            items([
              ...c.items,
              {
                id: crypto.randomUUID(),
                title: "",
                required: true,
                order: c.items.length,
                relatedStepId: "",
                note: "",
              },
            ])
          }
        >
          افزودن مورد
        </Button>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره چک‌لیست</Button>
      </form>
    </Drawer>
  );
}
