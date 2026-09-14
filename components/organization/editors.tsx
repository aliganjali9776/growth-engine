"use client";
import { useState } from "react";
import type { Department, Role, Person } from "@/lib/system/types";
import { saveEntity, deleteEntity } from "@/lib/system/actions";
import { useSystem } from "@/components/system/provider";
import { Drawer, Field, Button } from "@/components/system/ui";
export function EditorActions({
  error,
  onDelete,
}: {
  error: string;
  onDelete?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <p className="sys-form-error" role="alert">
        {error}
      </p>
      <div className="sys-form-actions">
        <Button type="submit">ذخیره تغییرات</Button>
        {onDelete && (
          <Button secondary onClick={() => setConfirm(!confirm)}>
            حذف
          </Button>
        )}
      </div>
      {confirm && (
        <div className="sys-delete-confirm">
          <p>
            این مورد حذف می‌شود. موارد دارای ارتباط ابتدا باید از نقش‌ها و
            فرآیندها جدا شوند.
          </p>
          <Button secondary onClick={onDelete}>
            تأیید حذف
          </Button>
          <Button secondary onClick={() => setConfirm(false)}>
            انصراف
          </Button>
        </div>
      )}
    </>
  );
}
export function DepartmentEditor({
  initial,
  onClose,
}: {
  initial?: Department;
  onClose: () => void;
}) {
  const { data, commit } = useSystem();
  const [d, set] = useState<Department>(
    () =>
      initial ?? {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        status: "active",
      },
  );
  const [error, setError] = useState("");
  function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      commit(saveEntity(data, "departments", { ...d, name: d.name.trim() }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Drawer
      open
      onClose={onClose}
      title={initial ? "ویرایش واحد سازمانی" : "واحد سازمانی جدید"}
      description="واحد، محدوده مسئولیت و جایگاه آن را در ساختار مشخص می‌کند."
    >
      <form onSubmit={save} className="sys-form">
        <Field label="نام واحد">
          <input
            required
            maxLength={150}
            value={d.name}
            onChange={(e) => set({ ...d, name: e.target.value })}
          />
        </Field>
        <Field label="شرح واحد">
          <textarea
            value={d.description}
            maxLength={3000}
            onChange={(e) => set({ ...d, description: e.target.value })}
          />
        </Field>
        <Field label="واحد مادر">
          <select
            value={d.parentDepartmentId ?? ""}
            onChange={(e) =>
              set({ ...d, parentDepartmentId: e.target.value || undefined })
            }
          >
            <option value="">بدون واحد مادر</option>
            {data.departments
              .filter((x) => x.id !== d.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.status === "archived" ? " (بایگانی)" : ""}
                </option>
              ))}
          </select>
        </Field>
        <Field label="نقش مدیر واحد">
          <select
            value={d.managerRoleId ?? ""}
            onChange={(e) =>
              set({ ...d, managerRoleId: e.target.value || undefined })
            }
          >
            <option value="">تعیین نشده</option>
            {data.roles.map((r) => (
              <option value={r.id} key={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وضعیت واحد">
          <select
            value={d.status}
            onChange={(e) =>
              set({ ...d, status: e.target.value as Department["status"] })
            }
          >
            <option value="active">فعال</option>
            <option value="archived">بایگانی</option>
          </select>
        </Field>
        <p className="sys-hint">
          بایگانی، ارتباط‌های قبلی با نقش‌ها و فرآیندها را حفظ می‌کند.
        </p>
        <EditorActions
          error={error}
          onDelete={
            initial
              ? () => {
                  try {
                    commit(deleteEntity(data, "departments", d.id));
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              : undefined
          }
        />
      </form>
    </Drawer>
  );
}
export function RoleEditor({
  initial,
  onClose,
}: {
  initial?: Role;
  onClose: () => void;
}) {
  const { data, commit } = useSystem();
  const [r, set] = useState<Role>(
    () =>
      initial ?? {
        id: crypto.randomUUID(),
        title: "",
        departmentId: "",
        purpose: "",
        responsibilities: [],
        isKeyRole: false,
        isFounderRole: false,
      },
  );
  const [responsibilities, setResponsibilities] = useState(
    r.responsibilities.join("\n"),
  );
  const [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title={initial ? "ویرایش نقش" : "نقش جدید"}
      description="نقش مستقل از فرد است و می‌تواند بدون متصدی باقی بماند."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(
              saveEntity(data, "roles", {
                ...r,
                title: r.title.trim(),
                responsibilities: responsibilities
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
              }),
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="عنوان نقش">
          <input
            required
            maxLength={150}
            value={r.title}
            onChange={(e) => set({ ...r, title: e.target.value })}
          />
        </Field>
        <Field label="واحد سازمانی">
          <select
            required
            value={r.departmentId}
            onChange={(e) => set({ ...r, departmentId: e.target.value })}
          >
            <option value="">انتخاب واحد</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.status === "archived" ? " (بایگانی)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="گزارش‌دهی به">
          <select
            value={r.reportsToRoleId ?? ""}
            onChange={(e) =>
              set({ ...r, reportsToRoleId: e.target.value || undefined })
            }
          >
            <option value="">بالاترین سطح / بدون مدیر</option>
            {data.roles
              .filter((x) => x.id !== r.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="فرد مسئول">
          <select
            value={r.personId ?? ""}
            onChange={(e) =>
              set({ ...r, personId: e.target.value || undefined })
            }
          >
            <option value="">نقش خالی</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === "archived" ? " (غیرفعال)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="هدف نقش">
          <textarea
            maxLength={3000}
            value={r.purpose}
            onChange={(e) => set({ ...r, purpose: e.target.value })}
          />
        </Field>
        <Field label="مسئولیت‌های اصلی؛ هر مورد در یک خط">
          <textarea
            maxLength={4000}
            rows={4}
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
          />
        </Field>
        <label className="sys-checkbox">
          <input
            type="checkbox"
            checked={r.isKeyRole}
            onChange={(e) => set({ ...r, isKeyRole: e.target.checked })}
          />
          نقش کلیدی
        </label>
        <label className="sys-checkbox">
          <input
            type="checkbox"
            checked={r.isFounderRole}
            onChange={(e) => set({ ...r, isFounderRole: e.target.checked })}
          />
          نقش بنیان‌گذار / مدیرعامل
        </label>
        <p className="sys-hint">
          مالکیت فرآیند توسط نقش بنیان‌گذار، وابستگی مؤثر آن را بحرانی نشان
          می‌دهد.
        </p>
        <EditorActions
          error={error}
          onDelete={
            initial
              ? () => {
                  try {
                    commit(deleteEntity(data, "roles", r.id));
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              : undefined
          }
        />
      </form>
    </Drawer>
  );
}
export function PersonEditor({
  initial,
  onClose,
}: {
  initial?: Person;
  onClose: () => void;
}) {
  const { data, commit } = useSystem();
  const [p, set] = useState<Person>(
    () =>
      initial ?? {
        id: crypto.randomUUID(),
        name: "",
        jobTitle: "",
        status: "active",
      },
  );
  const [selected, setSelected] = useState(
    data.roles.filter((r) => r.personId === p.id).map((r) => r.id),
  );
  const [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title={initial ? "ویرایش فرد" : "فرد جدید"}
      description="واحد و مدیر مستقیم از نقش‌های انتخاب‌شده مشخص می‌شوند."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const next = saveEntity(data, "people", {
              ...p,
              name: p.name.trim(),
            });
            next.roles = next.roles.map((r) =>
              selected.includes(r.id)
                ? { ...r, personId: p.id }
                : r.personId === p.id
                  ? { ...r, personId: undefined }
                  : r,
            );
            commit(next);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="نام و نام خانوادگی">
          <input
            required
            maxLength={150}
            value={p.name}
            onChange={(e) => set({ ...p, name: e.target.value })}
          />
        </Field>
        <Field label="عنوان شغلی">
          <input
            maxLength={150}
            value={p.jobTitle}
            onChange={(e) => set({ ...p, jobTitle: e.target.value })}
          />
        </Field>
        <Field label="ایمیل؛ اختیاری">
          <input
            type="email"
            dir="ltr"
            maxLength={200}
            value={p.email ?? ""}
            onChange={(e) => set({ ...p, email: e.target.value })}
          />
        </Field>
        <Field label="وضعیت فرد">
          <select
            value={p.status}
            onChange={(e) =>
              set({ ...p, status: e.target.value as Person["status"] })
            }
          >
            <option value="active">فعال</option>
            <option value="archived">بایگانی / غیرفعال</option>
          </select>
        </Field>
        <fieldset className="sys-role-assign">
          <legend>تخصیص نقش</legend>
          {data.roles.map((r) => (
            <label className="sys-checkbox" key={r.id}>
              <input
                type="checkbox"
                checked={selected.includes(r.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, r.id]
                      : selected.filter((x) => x !== r.id),
                  )
                }
              />
              <span>
                {r.title}
                <small>
                  {data.departments.find((d) => d.id === r.departmentId)?.name}{" "}
                  · مدیر:{" "}
                  {data.roles.find((x) => x.id === r.reportsToRoleId)?.title ??
                    "ندارد"}
                  {r.personId && r.personId !== p.id
                    ? ` · جایگزین ${data.people.find((x) => x.id === r.personId)?.name}`
                    : ""}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <EditorActions
          error={error}
          onDelete={
            initial
              ? () => {
                  try {
                    commit(deleteEntity(data, "people", p.id));
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              : undefined
          }
        />
      </form>
    </Drawer>
  );
}
