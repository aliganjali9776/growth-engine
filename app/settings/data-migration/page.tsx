"use client";
import { useEffect, useState } from "react";
import { useSaaS } from "@/components/saas/shell";
import { exportLocalWorkspace } from "@/lib/persistence/export";
import {
  businessExportFromLocal,
  validateBusinessExport,
  type BusinessOSExport,
} from "@/lib/persistence/business-export";
import type { previewDataMigration } from "@/lib/server/services/data-migration";
type Preview = Awaited<ReturnType<typeof previewDataMigration>>;
const countLabels: Record<string, string> = {
  latest: "ارزیابی",
  departments: "واحد",
  roles: "نقش",
  people: "فرد",
  processes: "فرآیند",
  cycles: "دوره",
  objectives: "هدف",
  priorities: "اولویت",
  contexts: "زمینه دوره",
  choices: "انتخاب",
  keyResults: "نتیجه کلیدی",
  initiatives: "ابتکار",
  krCheckIns: "گزارش نتیجه کلیدی",
  weeklyReviews: "مرور هفتگی",
  constraints: "گلوگاه",
  ideas: "ایده",
  levers: "اهرم",
  experiments: "آزمایش",
  measurements: "اندازه‌گیری",
  learnings: "یادگیری",
  decisions: "تصمیم",
  ideaReviews: "مرور ایده",
};
function BackupDownload({ value }: { value: unknown }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [value]);
  return url ? <a className="saas-primary" href={url} download={`growth-engine-backup-${new Date().toISOString().slice(0, 10)}.json`}>دانلود پشتیبان قبل از انتقال</a> : null;
}
export default function DataMigrationPage() {
  const view = useSaaS(),
    [backup, setBackup] = useState<unknown>(null),
    [value, setValue] = useState<BusinessOSExport | null>(null),
    [report, setReport] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const company = view?.current;
  const allowed =
    !!company && !!view?.permissions.includes("organization.update");
  async function execute() {
    if (!company || !value || !report?.eligible || report.organizationId !== company.id) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/saas?operation=executeDataMigration", {
        method: "POST", headers: { "Content-Type": "application/json", "x-organization-id": company.id },
        body: JSON.stringify({ operation: "executeDataMigration", organizationId: company.id, migrationId: report.migrationId, checksum: report.checksum, package: value }),
      });
      const result = await response.json();
      if (!response.ok || result.status !== "Succeeded") throw Error(result.status === "Failed" ? "انتقال ناموفق بود؛ تمام تغییرات انتقال برگشت داده شد. داده‌های محلی محفوظ‌اند." : "انتقال انجام نشد. شرکت مقصد، دسترسی و نسخهٔ پیش‌نمایش را بررسی کنید.");
      window.location.assign("/system");
    } catch (e) { setError(e instanceof Error ? e.message : "انتقال انجام نشد؛ اتصال را بررسی کنید."); }
    finally { setBusy(false); }
  }
  function accept(raw: unknown) {
    setBackup(raw);
    setValue(null);
    setReport(null);
    setConfirmed(false);
    const data = raw as { schemaVersion?: unknown };
    setValue(
      data?.schemaVersion === 1
        ? businessExportFromLocal(raw)
        : validateBusinessExport(raw),
    );
  }
  function local() {
    setError("");
    // This intentionally reads browser data only after a user's explicit click.
    // It never uses the bound SaaS businessStorage provider and never uploads here.
    try {
      const local = exportLocalWorkspace(
        window.localStorage,
        "browser-origin-local",
      );
      if (Object.values(local.stores).every((raw) => raw === null)) {
        setBackup(null);
        setValue(null);
        setReport(null);
        setConfirmed(false);
        setError(
          "داده کسب‌وکار محلی در این مرورگر پیدا نشد؛ می‌توانید فایل پشتیبان انتخاب کنید.",
        );
      } else accept(local);
    } catch {
      setError(
        "داده محلی معتبر نیست. پشتیبان خام را دانلود کنید؛ داده قبلی حفظ شده است.",
      );
    }
  }
  async function preview() {
    if (!value || !company || !confirmed) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/saas?operation=previewDataMigration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": company.id,
        },
        body: JSON.stringify({
          operation: "previewDataMigration",
          organizationId: company.id,
          package: value,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          response.status === 403
            ? "اجازه انتقال داده ندارید."
            : response.status === 409
              ? "شرکت یا نشست تغییر کرده است. صفحه را تازه کنید."
              : "پیش‌نمایش ممکن نشد. فایل و اتصال را بررسی کنید.",
        );
      setReport(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "اتصال برقرار نشد؛ دوباره تلاش کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="saas-card" aria-labelledby="migration-title">
      <h1 id="migration-title">انتقال داده‌های کسب‌وکار</h1>
      <p>
        مقصد: <strong>{company?.name ?? "شرکتی انتخاب نشده"}</strong>
      </p>
      <p>
        حالت فعلی: پایگاه داده شرکت. داده‌های محلی فقط با انتخاب شما بررسی و
        برای پیش‌نمایش ارسال می‌شوند.
      </p>
      <p role="note">
        انتقال کامل فقط به شرکت خالی و پس از پیش‌نمایش انجام می‌شود. داده‌های
        محلی مرورگر حذف یا تغییر نمی‌کنند. قبل از انتقال پشتیبان را نگه دارید.
      </p>
      {!allowed && (
        <p role="alert">برای انتقال داده، دسترسی مالک یا مدیر لازم است.</p>
      )}
      {allowed && company && <p><a className="saas-primary" href={`/api/business-backup?organizationId=${encodeURIComponent(company.id)}`}>دانلود پشتیبان پایگاه دادهٔ شرکت</a></p>}
      <button type="button" onClick={local} disabled={busy || !allowed}>
        بررسی داده محلی این مرورگر
      </button>
      <label className="saas-field">
        یا انتخاب فایل پشتیبان
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy || !allowed}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setError("");
            setValue(null);
            setReport(null);
            setBackup(null);
            setConfirmed(false);
            if (file.size > 8 * 1024 * 1024) {
              setError("حجم فایل باید کمتر از ۸ مگابایت باشد.");
              return;
            }
            try {
              accept(JSON.parse(await file.text()));
            } catch {
              setError("فایل معتبر نیست. داده‌های فعلی تغییری نکرده‌اند.");
            }
          }}
        />
      </label>
      {backup !== null && (
        <BackupDownload value={backup} />
      )}
      {value && (
        <>
          <p>پشتیبان بررسی شد. ابتدا فایل را دانلود و نگهداری کنید.</p>
          <label className="saas-migration-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            تأیید می‌کنم داده‌های این فایل برای بررسی به سرورِ شرکت «
            {company?.name}» ارسال شوند.
          </label>
          <button
            type="button"
            className="saas-primary"
            disabled={!confirmed || busy || !allowed}
            onClick={preview}
          >
            {busy ? "در حال بررسی…" : "پیش‌نمایش انتقال"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite" aria-busy={busy}>
        {report && (
          <>
            <h2>گزارش پیش‌نمایش برای {report.organizationName}</h2>
            <p>
              {report.eligible
                ? "بررسی اولیه بدون تعارض انجام شد. شرکت مقصد و پشتیبان را بررسی کنید."
                : "انتقال به دلیل خطا یا تعارض مجاز نیست."}
            </p>
            {report.eligible && report.executionEnabled && <button type="button" className="saas-primary" disabled={busy || !confirmed || !allowed} onClick={execute}>انتقال کامل به شرکت «{report.organizationName}»</button>}
            <dl className="saas-migration-counts">
              {Object.entries(report.counts).map(([module, counts]) => (
                <div key={module}>
                  <dt>
                    {
                      (
                        {
                          assessment: "ارزیابی",
                          system: "سیستم",
                          strategy: "استراتژی",
                          scale: "رشد",
                          agent: "دستیار",
                        } as Record<string, string>
                      )[module]
                    }
                  </dt>
                  <dd>
                    {Object.entries(counts)
                      .filter(([, n]) => n > 0)
                      .map(([key, n]) => `${countLabels[key] ?? "سابقه"}: ${n}`)
                      .join(" · ") || "داده‌ای ثبت نشده"}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              روابط بررسی‌شده: {report.criticalReferences} · خطاها:{" "}
              {report.errors.length}
            </p>
            {report.conflicts.some(
              (c) => c.code === "NonEmptyOrganization",
            ) && (
              <p role="alert">
                شرکت مقصد داده دارد؛ انتقال کامل مسدود است. ابتدا پشتیبان بگیرید
                یا شرکت جدید بسازید.
              </p>
            )}
            {report.conflicts.some((c) => c.code === "ProfileConflict") && (
              <p role="alert">
                صنعت شرکت با ارزیابی واردشده متفاوت است؛ نیاز به رفع تعارض دارد.
              </p>
            )}
            {report.errors.length > 0 && (
              <ul>
                {report.errors.slice(0, 40).map((issue, i) => (
                  <li key={i}>
                    <bdi>{issue.path}</bdi>: رابطه نامعتبر{" "}
                    {issue.targetId && <bdi>{issue.targetId}</bdi>}
                  </li>
                ))}
              </ul>
            )}
            {report.warnings.some((w) => w.code === "LegacyLocalActors") && (
              <p>
                عامل سوابق محلی به‌عنوان کاربر محلی تاریخی حفظ خواهد شد؛ این
                سوابق به واردکننده نسبت داده نمی‌شوند.
              </p>
            )}
            {report.warnings.some(
              (w) => w.code === "TargetCompanyNameRetained",
            ) && <p>نام شرکت مقصد حفظ می‌شود؛ نام ارزیابی متفاوت است.</p>}
          </>
        )}
      </div>
    </section>
  );
}
