import {
  accessRoleNames,
  defaultRolePermissions,
  permissionKeys,
} from "@/lib/server/permissions";
import { roleLabels } from "@/lib/saas/roles";
const groups: Record<string, string> = {
  organization: "شرکت",
  members: "اعضا",
  roles: "نقش‌های دسترسی",
  audit: "گزارش فعالیت",
  system: "سیستم",
  strategy: "استراتژی",
  scale: "اسکیل",
  agent: "مشاور",
};
const operations: Record<string, string> = {
  view: "مشاهده",
  update: "به‌روزرسانی",
  archive: "آرشیو",
  invite: "دعوت",
  change_role: "تغییر نقش",
  suspend: "تعلیق و بازگردانی",
  remove: "حذف عضویت",
  manage: "مدیریت",
  edit: "ویرایش",
  create: "ایجاد",
  approve: "تأیید",
  ask: "پرسش",
  diagnose: "تشخیص",
  recommend: "پیشنهاد",
  prepare: "آماده‌سازی",
  execute: "اجرا",
  target_change: "تغییر هدف",
};
export default function AccessPage() {
  return (
    <section className="panel">
      <h1>ماتریس دسترسی</h1>
      <p>
        مجوزهای پیش‌فرض نقش‌ها؛ کنترل نهایی هر عملیات در سرور انجام می‌شود. نقش
        شغلی مجوز نرم‌افزار ایجاد نمی‌کند.
      </p>
      <div
        style={{ overflowX: "auto" }}
        tabIndex={0}
        aria-label="جدول قابل پیمایش مجوزها"
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption>شش نقش دسترسی شرکت</caption>
          <thead>
            <tr>
              <th scope="col">مجوز</th>
              <th scope="col">ریسک</th>
              {accessRoleNames.map((role) => (
                <th scope="col" key={role}>
                  {roleLabels[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionKeys.map((key) => {
              const parts = key.split("."),
                op = parts.at(-1)!;
              const high = [
                "approve",
                "execute",
                "archive",
                "manage",
                "change_role",
                "target_change",
              ].includes(op);
              return (
                <tr key={key}>
                  <th scope="row" style={{ textAlign: "start", padding: 8 }}>
                    {groups[parts[0]]} — {operations[op] ?? op}
                    <br />
                    <small dir="ltr">{key}</small>
                  </th>
                  <td>{high ? "بالا" : "عادی"}</td>
                  {accessRoleNames.map((role) => (
                    <td key={role} style={{ textAlign: "center" }}>
                      {defaultRolePermissions[role].includes(key)
                        ? "مجاز"
                        : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        اجرای سروری Agent در این مرحله فعال نیست؛ حتی مالک باید تأیید معتبر و
        اجرای صریح داشته باشد.
      </p>
    </section>
  );
}
