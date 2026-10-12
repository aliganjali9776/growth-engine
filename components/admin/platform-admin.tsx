"use client";
import { useState } from "react";
import Link from "next/link";
import type { platformOverview } from "@/lib/server/services/platform-admin";
import { AssessmentResults } from "@/components/assessment/results";
import "./platform-admin.css";
type Overview = Awaited<ReturnType<typeof platformOverview>>;
const date = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleString("fa-IR") : "—";
const tierLabel = (value: string) =>
  value === "full_access" ? "دسترسی کامل" : "فقط ارزیابی";
export function PlatformAdmin({
  initial,
  section,
}: {
  initial: Overview;
  section: string[];
}) {
  const [data, setData] = useState(initial),
    [search, setSearch] = useState(""),
    [tier, setTier] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [change, setChange] = useState<{
      organizationId: string;
      operation: string;
      requestId?: string;
    } | null>(null),
    [reason, setReason] = useState("");
  const page = section[0] ?? "dashboard",
    id = section[1],
    org = (orgId: string) => data.organizations.find((o) => o.id === orgId),
    user = (userId: string) => data.users.find((u) => u.id === userId),
    matches = (value: unknown) =>
      JSON.stringify(value)
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase());
  const leadCells = (a: Overview["assessments"][number]) => (
    <>
      <td>
        {user(a.userId)?.name ?? "انتساب تاریخی نامشخص"}
        <small>{user(a.userId)?.email ?? "—"}</small>
      </td>
      <td>{org(a.organizationId)?.name}</td>
      <td>
        {a.status === "completed" ? "تکمیل‌شده" : "ناتمام"}
        <small>{a.completionPercentage}%</small>
      </td>
      <td>{a.result?.overall.toFixed(1) ?? "—"}</td>
      {["system", "strategy", "scale"].map((d) => (
        <td key={d}>
          {a.result?.scores[d as "system" | "strategy" | "scale"].toFixed(1) ??
            "—"}
        </td>
      ))}
      <td>{a.result?.primaryConstraint ?? "—"}</td>
      <td>{date(a.createdAt)}</td>
      <td>{date(a.completedAt)}</td>
      <td>{date(a.updatedAt)}</td>
      <td>
        <Link href={"/admin/assessments/" + a.id}>گزارش</Link>
      </td>
    </>
  );
  const report = data.assessments.find((a) => a.id === id);
  const selected = org(id ?? "");
  async function submit() {
    if (!change) return;
    const target = org(change.organizationId);
    if (!target) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...change,
          confirmed: true,
          previousTier: target.accessTier,
          reason,
        }),
      });
      if (!r.ok) throw Error();
      const fresh = await fetch("/api/admin", { cache: "no-store" });
      if (!fresh.ok) throw Error();
      setData(await fresh.json());
      setChange(null);
      setReason("");
      setMessage("تغییر ثبت شد؛ دسترسی در درخواست بعدی کاربر اعمال می‌شود.");
    } catch {
      setMessage("تغییر انجام نشد؛ صفحه را تازه کنید و دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  const orgButtons = (organizationId: string) => (
    <button
      onClick={() =>
        setChange({
          organizationId,
          operation:
            org(organizationId)?.accessTier === "full_access"
              ? "revoke"
              : "grant",
        })
      }
    >
      {org(organizationId)?.accessTier === "full_access"
        ? "بازگشت به فقط ارزیابی"
        : "اعطای دسترسی کامل"}
    </button>
  );
  return (
    <main className="platform-admin">
      <header>
        <div>
          <p className="eyebrow">GROWTH ENGINE · PLATFORM</p>
          <h1>مرکز مدیریت پلتفرم</h1>
          <p>مشتریان، ارزیابی‌ها و فعال‌سازی دسترسی</p>
        </div>
        <a href="/">بازگشت به فضای کسب‌وکار</a>
      </header>
      <nav aria-label="مدیریت پلتفرم">
        {[
          ["", "نمای کلی"],
          ["users", "کاربران"],
          ["organizations", "شرکت‌ها"],
          ["assessments", "ارزیابی‌ها"],
          ["access-requests", "درخواست‌ها"],
          ["audit", "تاریخچه دسترسی"],
        ].map(([path, label]) => (
          <Link
            key={path}
            aria-current={page === (path || "dashboard") ? "page" : undefined}
            href={"/admin" + (path ? "/" + path : "")}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p role="status">{message}</p>
      {page === "dashboard" ? (
        <>
          <div className="admin-metrics">
            {[
              ["کاربران", data.totals.users],
              ["ثبت‌نام ۷ روز اخیر", data.totals.newUsers],
              ["شرکت‌ها", data.totals.organizations],
              ["ارزیابی کامل", data.totals.completed],
              ["ارزیابی ناتمام", data.totals.incomplete],
              ["مشتریان دسترسی کامل", data.totals.fullAccess],
              ["کاربران فقط ارزیابی", data.totals.assessmentOnly],
              ["درخواست در انتظار", data.totals.pending],
            ].map(([label, value]) => (
              <article className="saas-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <h2>ثبت‌نام‌های اخیر</h2>
          {data.users.slice(0, 8).map((u) => (
            <p key={u.id}>
              {u.name} · {u.email} · {date(u.createdAt)}
            </p>
          ))}
          <h2>تکمیل‌های اخیر</h2>
          {data.assessments
            .filter((a) => a.status === "completed")
            .sort((a, b) =>
              String(b.completedAt).localeCompare(String(a.completedAt)),
            )
            .slice(0, 8)
            .map((a) => (
              <p key={a.id}>
                <Link href={"/admin/assessments/" + a.id}>
                  {org(a.organizationId)?.name} ·{" "}
                  {user(a.userId)?.name ?? "کاربر تاریخی نامشخص"} ·{" "}
                  {a.result?.overall.toFixed(1)} · {date(a.completedAt)}
                </Link>
              </p>
            ))}
        </>
      ) : null}
      {!id && page !== "dashboard" && (
        <div className="admin-filters">
          <label>
            جستجو
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="نام، ایمیل یا شرکت"
            />
          </label>
          <label>
            سطح دسترسی
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">همه</option>
              <option value="assessment_only">فقط ارزیابی</option>
              <option value="full_access">دسترسی کامل</option>
            </select>
          </label>
          <label>
            وضعیت ارزیابی
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">همه</option>
              <option value="completed">تکمیل‌شده</option>
              <option value="incomplete">ناتمام</option>
            </select>
          </label>
        </div>
      )}
      {page === "users" && (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                {[
                  "کاربر / ایمیل",
                  "ثبت‌نام",
                  "آخرین فعالیت",
                  "شرکت / نقش",
                  "دسترسی",
                  "ارزیابی",
                  "3S / System / Strategy / Scale",
                  "مانع اصلی",
                  "تکمیل",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.users
                .filter((u) =>
                  matches([
                    u.name,
                    u.email,
                    ...data.members
                      .filter((m) => m.userId === u.id)
                      .map((m) => org(m.organizationId)?.name),
                  ]),
                )
                .map((u) => {
                  const memberships = data.members.filter(
                      (m) => m.userId === u.id && m.status === "Active",
                    ),
                    leads = data.assessments.filter((a) => a.userId === u.id),
                    access = memberships.some(
                      (m) =>
                        org(m.organizationId)?.accessTier === "full_access",
                    )
                      ? "full_access"
                      : "assessment_only",
                    a = leads[0];
                  if (
                    (tier && tier !== access) ||
                    (status && status !== (a?.status ?? "incomplete"))
                  )
                    return null;
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.name}
                        <small>{u.email}</small>
                      </td>
                      <td>{date(u.createdAt)}</td>
                      <td>{date(u.lastActivity)}</td>
                      <td>
                        {memberships.map((m, i) => (
                          <small key={i}>
                            <Link
                              href={"/admin/organizations/" + m.organizationId}
                            >
                              {org(m.organizationId)?.name}
                            </Link>{" "}
                            · {m.role}
                          </small>
                        ))}
                      </td>
                      <td>{tierLabel(access)}</td>
                      <td>{a?.status ?? "شروع نشده"}</td>
                      <td>
                        {a?.result
                          ? [
                              a.result.overall,
                              ...Object.values(a.result.scores),
                            ]
                              .map((n) => n.toFixed(1))
                              .join(" / ")
                          : "—"}
                      </td>
                      <td>{a?.result?.primaryConstraint ?? "—"}</td>
                      <td>{date(a?.completedAt)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      {page === "organizations" && !id && (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>شرکت</th>
                <th>وضعیت</th>
                <th>دسترسی</th>
                <th>مدیریت</th>
              </tr>
            </thead>
            <tbody>
              {data.organizations
                .filter(
                  (o) => matches(o.name) && (!tier || o.accessTier === tier),
                )
                .map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={"/admin/organizations/" + o.id}>
                        {o.name}
                      </Link>
                    </td>
                    <td>{o.status}</td>
                    <td>{tierLabel(o.accessTier)}</td>
                    <td>{orgButtons(o.id)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {page === "organizations" &&
        id &&
        (selected ? (
          <>
            <section className="saas-card">
              <h2>{selected.name}</h2>
              <p>
                {selected.industry} · {selected.businessModel} ·{" "}
                {selected.country} · {selected.currency} · {selected.timezone}
              </p>
              <p>{tierLabel(selected.accessTier)}</p>
              {orgButtons(selected.id)}
            </section>
            <h2>اعضا و مالک شرکت</h2>
            {data.members
              .filter((m) => m.organizationId === id)
              .map((m, i) => (
                <p key={i}>
                  {user(m.userId)?.name} · {user(m.userId)?.email} · {m.role} ·{" "}
                  {m.status}
                </p>
              ))}
            <h2>تعداد رکوردها</h2>
            {Object.entries(data.domainCounts).map(([name, counts]) => (
              <p key={name}>
                {name}:{" "}
                {counts.find((c) => c.organizationId === id)?.count ?? 0}
              </p>
            ))}
            <h2>ارزیابی</h2>
            {data.assessments
              .filter((a) => a.organizationId === id)
              .map((a) => (
                <p key={a.id}>
                  <Link href={"/admin/assessments/" + a.id}>
                    {user(a.userId)?.name ?? "تاریخی"} · {a.status} ·{" "}
                    {a.result?.overall.toFixed(1) ?? "—"}
                  </Link>
                </p>
              ))}
            <h2>درخواست‌ها</h2>
            {data.requests
              .filter((r) => r.organizationId === id)
              .map((r) => (
                <p key={r.id}>
                  {r.status} · {date(r.createdAt)}
                </p>
              ))}
            <h2>فعالیت اخیر</h2>
            {data.recentActivity
              .filter((a) => a.organizationId === id)
              .slice(0, 20)
              .map((a, i) => (
                <p key={i}>
                  {a.action} · {user(a.actorUserId ?? "")?.name ?? "سیستم"} ·{" "}
                  {date(a.createdAt)}
                </p>
              ))}
          </>
        ) : (
          <p>شرکت یافت نشد.</p>
        ))}
      {page === "assessments" && !id && (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                {[
                  "کاربر / ایمیل",
                  "شرکت",
                  "وضعیت / پیشرفت",
                  "3S",
                  "System",
                  "Strategy",
                  "Scale",
                  "مانع اصلی",
                  "شروع",
                  "تکمیل",
                  "فعالیت اخیر",
                  "گزارش",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.assessments
                .filter(
                  (a) =>
                    matches([
                      user(a.userId)?.name,
                      user(a.userId)?.email,
                      org(a.organizationId)?.name,
                    ]) &&
                    (!tier || org(a.organizationId)?.accessTier === tier) &&
                    (!status || a.status === status),
                )
                .map((a) => (
                  <tr key={a.id}>{leadCells(a)}</tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {page === "assessments" &&
        id &&
        (report?.result ? (
          <>
            <p>
              گزارش فقط‌خواندنی؛ پاسخ‌ها و امتیازها در این بخش قابل ویرایش
              نیستند.
            </p>
            <AssessmentResults
              result={report.result}
              profile={report.draft.profile}
              completedAt={report.completedAt}
              onRoadmap={() => setMessage("این گزارش فقط‌خواندنی است.")}
              onReview={() => setMessage("ویرایش پاسخ‌های مشتری مجاز نیست.")}
            />
          </>
        ) : (
          <p>ارزیابی هنوز کامل نشده یا یافت نشد.</p>
        ))}
      {page === "access-requests" && (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>شرکت</th>
                <th>کاربر</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th>تصمیم</th>
              </tr>
            </thead>
            <tbody>
              {data.requests
                .filter((r) =>
                  matches([
                    org(r.organizationId)?.name,
                    user(r.userId)?.email,
                    r.status,
                  ]),
                )
                .map((r) => (
                  <tr key={r.id}>
                    <td>{org(r.organizationId)?.name}</td>
                    <td>
                      {user(r.userId)?.name}
                      <small>{user(r.userId)?.email}</small>
                    </td>
                    <td>{r.status}</td>
                    <td>{date(r.createdAt)}</td>
                    <td>
                      {r.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              setChange({
                                organizationId: r.organizationId,
                                operation: "approve",
                                requestId: r.id,
                              })
                            }
                          >
                            تأیید و فعال‌سازی
                          </button>
                          <button
                            onClick={() =>
                              setChange({
                                organizationId: r.organizationId,
                                operation: "reject",
                                requestId: r.id,
                              })
                            }
                          >
                            رد درخواست
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {page === "audit" && (
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                {["عامل", "شرکت", "عملیات", "قبل", "بعد", "زمان", "دلیل"].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.audit
                .filter((a) =>
                  matches([
                    user(a.actorUserId ?? "")?.email,
                    org(a.organizationId)?.name,
                    a.action,
                  ]),
                )
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      {user(a.actorUserId ?? "")?.email ?? "مهاجرت سیستم"}
                    </td>
                    <td>{org(a.organizationId)?.name}</td>
                    <td>{a.action}</td>
                    <td>{a.previousTier ?? "—"}</td>
                    <td>{a.newTier ?? "—"}</td>
                    <td>{date(a.createdAt)}</td>
                    <td>{a.reason ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {change && (
        <div className="admin-modal">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-access"
            className="saas-card"
          >
            <h2 id="confirm-access">تأیید تغییر دسترسی</h2>
            <p>
              {org(change.organizationId)?.name} ·{" "}
              {change.operation === "reject"
                ? "رد درخواست"
                : change.operation === "revoke"
                  ? "بازگشت به فقط ارزیابی"
                  : "اعطای دسترسی کامل"}
            </p>
            <p>
              این تغییر ثبت می‌شود و دسترسی اعضای شرکت را تحت تأثیر قرار می‌دهد.
            </p>
            <label>
              دلیل (اختیاری)
              <textarea
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div>
              <button disabled={busy} onClick={submit}>
                تأیید تغییر
              </button>
              <button disabled={busy} onClick={() => setChange(null)}>
                انصراف
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
