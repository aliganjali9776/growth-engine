"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/app-shell";
import { useSaaS, saasRequest, enterCompany } from "./shell";
import { roleLabels } from "@/lib/saas/roles";
import { safeReturn } from "@/lib/saas/navigation";
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "انجام درخواست ممکن نشد.";
function Field({
  name,
  label,
  type = "text",
  defaultValue = "",
  required = true,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="saas-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        dir={["email", "password", "url"].includes(type) ? "ltr" : undefined}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        maxLength={type === "password" ? 128 : 2000}
      />
    </label>
  );
}
function FormStatus({ error, message }: { error: string; message?: string }) {
  return (
    <>
      {error && (
        <p className="saas-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="saas-success" role="status">
          {message}
        </p>
      )}
    </>
  );
}
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [returnTo, setReturn] = useState("/");
  useEffect(
    () =>
      setReturn(
        safeReturn(new URLSearchParams(location.search).get("returnTo")),
      ),
    [],
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    if (signup && data.get("password") !== data.get("confirm")) {
      setError("دو رمز عبور یکسان نیستند.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        "/api/auth/" + (signup ? "sign-up/email" : "sign-in/email"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(data.get("email")).trim().toLowerCase(),
            password: data.get("password"),
            ...(signup
              ? { name: data.get("name") }
              : { rememberMe: data.get("remember") === "on" }),
          }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 429
            ? "تلاش‌های زیادی انجام شده است؛ یک دقیقه بعد امتحان کنید."
            : signup
              ? "ثبت‌نام انجام نشد؛ ایمیل یا رمز را بررسی کنید. اگر حساب دارید، وارد شوید."
              : "ایمیل یا رمز عبور درست نیست، یا حساب در دسترس نیست.",
        );
        setBusy(false);
        return;
      }
      if (returnTo.startsWith("/invite/")) {
        location.assign(returnTo);
        return;
      }
      const ctx = await (await fetch("/api/saas")).json();
      if (ctx.organizations?.length === 1) {
        await enterCompany(ctx.organizations[0].id, returnTo);
        return;
      }
      location.assign(
        ctx.organizations?.length
          ? "/organizations?returnTo=" + encodeURIComponent(returnTo)
          : "/onboarding/company",
      );
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
      setBusy(false);
    }
  }
  return (
    <div className="saas-auth">
      <section className="saas-auth-story">
        <Brand />
        <span className="saas-eyebrow">THE 3S BUSINESS OS</span>
        <h1>
          ساختار روشن.
          <br />
          تصمیم بهتر.
          <br />
          رشد پایدار.
        </h1>
        <p>فضای اختصاصی شرکت شما؛ همراه با تیم و دسترسی‌های مشخص.</p>
        <small>سیستم · استراتژی · اسکیل</small>
      </section>
      <section className="saas-auth-form">
        <div>
          <span className="saas-eyebrow">GROWTH ENGINE</span>
          <h2>{signup ? "حساب خود را بسازید" : "به فضای مدیریت برگردید"}</h2>
          <p>
            {signup
              ? "با ایمیل خود شروع کنید و شرکت بسازید یا به تیم بپیوندید."
              : "با حساب شخصی خود وارد شوید."}
          </p>
          <form onSubmit={submit} className="saas-form">
            {signup && (
              <Field
                name="name"
                label="نام و نام خانوادگی"
                autoComplete="name"
              />
            )}
            <Field
              name="email"
              label="ایمیل"
              type="email"
              autoComplete="email"
            />
            <Field
              name="password"
              label="رمز عبور"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
            />
            {signup ? (
              <>
                <small>
                  ۸ تا ۱۲۸ کاراکتر؛ استفاده از مدیر رمز عبور مجاز است.
                </small>
                <Field
                  name="confirm"
                  label="تکرار رمز عبور"
                  type="password"
                  autoComplete="new-password"
                />
              </>
            ) : (
              <label className="saas-checkbox">
                <input type="checkbox" name="remember" defaultChecked />
                مرا به خاطر بسپار
              </label>
            )}
            <FormStatus error={error} />
            <button className="saas-primary" disabled={busy}>
              {busy ? "در حال بررسی…" : signup ? "ایجاد حساب" : "ورود"}
            </button>
          </form>
          <p className="saas-auth-link">
            {signup ? "حساب دارید؟" : "حساب ندارید؟"}{" "}
            <Link
              href={
                (signup ? "/login" : "/signup") +
                "?returnTo=" +
                encodeURIComponent(returnTo)
              }
            >
              {signup ? "وارد شوید" : "ثبت‌نام کنید"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
export function CompanyOnboarding() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saasRequest({
        operation: "createCompany",
        ...Object.fromEntries(new FormData(e.currentTarget)),
      });
      location.assign("/?created=1");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }
  return (
    <section className="saas-page">
      <span className="saas-eyebrow">YOUR COMPANY, YOUR SPACE</span>
      <h1>شرکت شما از اینجا شروع می‌شود</h1>
      <p>
        یک فضای تازه برای شرکت بسازید. برای پیوستن به تیم، لینک دعوت را از مدیر
        شرکت دریافت کنید.
      </p>
      <form className="saas-card saas-form saas-two" onSubmit={submit}>
        <Field name="name" label="نام شرکت" />
        <Field name="industry" label="صنعت" />
        <label className="saas-field">
          <span>مدل کسب‌وکار</span>
          <select name="businessModel">
            <option value="service">خدماتی</option>
            <option value="saas">نرم‌افزار / SaaS</option>
            <option value="retail">فروشگاهی</option>
            <option value="manufacturing">تولیدی</option>
            <option value="other">سایر</option>
          </select>
        </label>
        <label className="saas-field">
          <span>اندازه تیم</span>
          <select name="teamSize">
            {["1–5", "6–15", "16–30", "31–50", "51–100", "100+"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <Field name="country" label="کشور" defaultValue="ایران" />
        <Field
          name="currency"
          label="واحد پول (کد سه‌حرفی)"
          defaultValue="IRR"
        />
        <Field name="timezone" label="منطقه زمانی" defaultValue="Asia/Tehran" />
        <div className="saas-full">
          <FormStatus error={error} />
          <button className="saas-primary" disabled={busy}>
            {busy ? "در حال ایجاد…" : "ایجاد شرکت و ورود"}
          </button>
        </div>
      </form>
    </section>
  );
}
export function OrganizationSelector() {
  const view = useSaaS(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (view?.organizations.length === 1 && !view.current) {
      const target = safeReturn(
        new URLSearchParams(location.search).get("returnTo"),
      );
      setBusy(true);
      void enterCompany(view.organizations[0].id, target).catch((err) => {
        setError(errorText(err));
        setBusy(false);
      });
    }
  }, [view]);
  return (
    <section className="saas-page">
      <span className="saas-eyebrow">CHOOSE YOUR WORKSPACE</span>
      <h1>در کدام شرکت کار می‌کنید؟</h1>
      <p>دسترسی و داده‌های هر شرکت جداست.</p>
      <FormStatus error={error} />
      <div className="saas-company-grid">
        {view?.organizations.map((org) => (
          <button
            className="saas-card saas-company-card"
            key={org.id}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await enterCompany(
                  org.id,
                  safeReturn(
                    new URLSearchParams(location.search).get("returnTo"),
                  ),
                );
              } catch (err) {
                setError(errorText(err));
                setBusy(false);
              }
            }}
          >
            <span className="saas-company-icon">◈</span>
            <strong>{org.name}</strong>
            <span>{org.roles.map((r) => roleLabels[r] ?? r).join("، ")}</span>
            <small>
              {view.current?.id === org.id ? "شرکت فعلی" : "ورود به شرکت ←"}
            </small>
          </button>
        ))}
        <Link
          className="saas-card saas-company-card saas-new-company"
          href="/onboarding/company"
        >
          <strong>+ ایجاد شرکت جدید</strong>
          <span>یک فضای مستقل دیگر بسازید</span>
        </Link>
      </div>
      {view?.organizations.length === 0 && (
        <p>هنوز عضو شرکتی نیستید. شرکت بسازید یا با لینک دعوت بپیوندید.</p>
      )}
    </section>
  );
}
export function CompanyHome() {
  const view = useSaaS();
  return (
    <section className="saas-page">
      <span className="saas-eyebrow">YOUR BUSINESS, IN FOCUS</span>
      <h1>
        {view?.user.name}، به {view?.current?.name ?? "فضای مدیریت"} خوش آمدید
      </h1>
      <p>
        فضای این شرکت مستقل است. داده‌های نمونه مرورگر به آن منتقل نشده‌اند.
      </p>
      <div className="saas-company-grid">
        {[
          [
            "/assessment",
            "۱",
            "شروع ارزیابی 3S",
            "تصویر امروز کسب‌وکار را مشخص کنید.",
          ],
          [
            "/settings/members",
            "۲",
            "دعوت از تیم",
            "اختیاری؛ دسترسی همکاران را تنظیم کنید.",
          ],
          [
            "/system/command-center",
            "۳",
            "ورود به فضای مدیریت",
            "سیستم، استراتژی و اسکیل شرکت.",
          ],
        ]
          .filter(([href]) =>
            href === "/settings/members"
              ? view?.permissions.includes("members.view")
              : view?.permissions.includes("system.view"),
          )
          .map(([href, n, title, text]) => (
            <Link
              key={href}
              href={href}
              className="saas-card saas-company-card"
            >
              <span className="saas-company-icon">{n}</span>
              <strong>{title}</strong>
              <span>{text}</span>
            </Link>
          ))}
      </div>
      <div className="saas-card">
        <h2>شرکت فعال</h2>
        <p>
          {view?.current?.name} ·{" "}
          {view?.current?.roles.map((r) => roleLabels[r] ?? r).join("، ")}
        </p>
        <Link href="/settings/company">تکمیل اطلاعات شرکت ←</Link>
      </div>
    </section>
  );
}
export function CompanySettings() {
  const view = useSaaS(),
    [company, setCompany] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (view?.current)
      void fetch("/api/saas?operation=company", {
        headers: { "x-organization-id": view.current.id },
      })
        .then(async (r) => {
          if (!r.ok) throw Error("خواندن شرکت ممکن نشد.");
          setCompany((await r.json()).company);
        })
        .catch((err) => setError(errorText(err)));
  }, [view?.current?.id]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saasRequest(
        {
          operation: "company",
          ...Object.fromEntries(new FormData(e.currentTarget)),
        },
        view?.current?.id,
      );
      location.reload();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }
  return (
    <section className="saas-page">
      <h1>تنظیمات شرکت</h1>
      <p>اطلاعات شرکت فعال؛ پروفایل ارزیابی بدون تأیید شما بازنویسی نمی‌شود.</p>
      <FormStatus error={error} message={message} />
      {company && (
        <form className="saas-card saas-form saas-two" onSubmit={submit}>
          <Field name="name" label="نام شرکت" defaultValue={company.name} />
          <Field
            name="industry"
            label="صنعت"
            defaultValue={company.industry ?? ""}
            required={false}
          />
          <label className="saas-field">
            <span>مدل کسب‌وکار</span>
            <select
              name="businessModel"
              defaultValue={company.businessModel ?? "other"}
            >
              <option value="service">خدماتی</option>
              <option value="saas">نرم‌افزار / SaaS</option>
              <option value="retail">فروشگاهی</option>
              <option value="manufacturing">تولیدی</option>
              <option value="other">سایر</option>
              {company.businessModel &&
                ![
                  "service",
                  "saas",
                  "retail",
                  "manufacturing",
                  "other",
                ].includes(company.businessModel) && (
                  <option value={company.businessModel}>
                    {company.businessModel}
                  </option>
                )}
            </select>
          </label>
          <Field
            name="currency"
            label="واحد پول"
            defaultValue={company.currency}
          />
          <Field
            name="timezone"
            label="منطقه زمانی"
            defaultValue={company.timezone}
          />
          <div>
            <span>وضعیت شرکت</span>
            <p>
              {company.status === "Trial"
                ? "آزمایشی"
                : company.status === "Active"
                  ? "فعال"
                  : company.status}
            </p>
          </div>
          <button
            className="saas-primary"
            disabled={
              busy || !view?.permissions.includes("organization.update")
            }
          >
            ذخیره تغییرات
          </button>
        </form>
      )}
    </section>
  );
}
export function MembersPage() {
  const view = useSaaS(),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  const id = view?.current?.id,
    canInvite = view?.permissions.includes("members.invite"),
    canManage =
      view?.permissions.includes("members.suspend") ||
      view?.permissions.includes("members.remove"),
    canChangeRole = view?.permissions.includes("members.change_role");
  async function load() {
    if (!id) return;
    const r = await fetch("/api/saas?operation=members", {
      headers: { "x-organization-id": id },
    });
    if (!r.ok) throw Error("خواندن اعضا مجاز یا ممکن نیست.");
    setData(await r.json());
  }
  useEffect(() => {
    void load().catch((err) => setError(errorText(err)));
  }, [id]);
  async function action(body: any) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saasRequest(body, id);
      await load();
      setMessage("تغییر ثبت شد.");
      return result;
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="saas-page">
      <h1>اعضا و دسترسی شرکت</h1>
      <p>
        نقش دسترسی، مجوز استفاده از سامانه است؛ نقش شغلی در بخش سیستم جداگانه
        مدیریت می‌شود.
      </p>
      <FormStatus error={error} message={message} />
      {canInvite && (
        <form
          className="saas-card saas-form saas-two"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              values = Object.fromEntries(new FormData(form)),
              result = await action({ operation: "invite", ...values });
            if (result) {
              setLink(result.url);
              form.reset();
            }
          }}
        >
          <h2 className="saas-full">دعوت همکار</h2>
          <Field name="email" label="ایمیل همکار" type="email" />
          <label className="saas-field">
            <span>نقش دسترسی اولیه</span>
            <select name="role" defaultValue="Manager">
              {Object.entries(roleLabels)
                .filter(
                  ([r]) =>
                    r !== "Owner" || view?.current?.roles.includes("Owner"),
                )
                .map(([r, label]) => (
                  <option key={r} value={r}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <button className="saas-primary" disabled={busy}>
            ایجاد لینک دعوت
          </button>
          <small>
            ارسال ایمیل متصل نیست؛ لینک را فقط با شخص دعوت‌شده به اشتراک
            بگذارید.
          </small>
        </form>
      )}
      {link && (
        <div className="saas-card">
          <h2>لینک دعوت آماده است</h2>
          <label className="saas-field">
            <span>لینک دعوت با اعتبار محدود</span>
            <input dir="ltr" value={link} readOnly />
          </label>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("لینک کپی شد.");
              } catch {
                setError("لینک را از کادر بالا کپی کنید.");
              }
            }}
          >
            کپی لینک
          </button>
        </div>
      )}
      <div className="saas-card saas-table-wrap">
        <table>
          <caption>اعضای {view?.current?.name}</caption>
          <thead>
            <tr>
              <th>عضو</th>
              <th>نقش دسترسی</th>
              <th>وضعیت / تاریخ</th>
              <th>مدیریت</th>
            </tr>
          </thead>
          <tbody>
            {data?.members.map((m: any) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                  <small dir="ltr">{m.email}</small>
                  {m.businessRoles.length > 0 && (
                    <small>نقش شغلی: {m.businessRoles.join("، ")}</small>
                  )}
                </td>
                <td>
                  {canChangeRole ? (
                    <label>
                      <span className="sr-only">نقش دسترسی {m.name}</span>
                      <select
                        aria-label={"نقش دسترسی " + m.name}
                        disabled={
                          busy ||
                          (m.roles.includes("Owner") &&
                            !view?.current?.roles.includes("Owner")) ||
                          (m.userId === view?.user.id &&
                            !view?.current?.roles.includes("Owner"))
                        }
                        value={m.roles[0] ?? "Viewer"}
                        onChange={(e) =>
                          void action({
                            operation: "changeMember",
                            membershipId: m.id,
                            version: m.version,
                            role: e.target.value,
                          })
                        }
                      >
                        {Object.entries(roleLabels)
                          .filter(
                            ([r]) =>
                              r !== "Owner" ||
                              view?.current?.roles.includes("Owner") ||
                              m.roles.includes("Owner"),
                          )
                          .map(([r, label]) => (
                            <option key={r} value={r}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : (
                    m.roles.map((r: string) => roleLabels[r] ?? r).join("، ")
                  )}
                </td>
                <td>
                  {
                    (
                      {
                        Active: "فعال",
                        Invited: "دعوت‌شده",
                        Suspended: "تعلیق‌شده",
                        Removed: "حذف‌شده",
                      } as any
                    )[m.status]
                  }
                  <small>
                    {new Date(m.joinedAt ?? m.invitedAt).toLocaleDateString(
                      "fa",
                    )}
                  </small>
                </td>
                <td>
                  {canManage && (
                    <div className="saas-row-actions">
                      {m.status === "Active" ? (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action({
                              operation: "changeMember",
                              membershipId: m.id,
                              version: m.version,
                              status: "Suspended",
                            })
                          }
                        >
                          تعلیق
                        </button>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action({
                              operation: "changeMember",
                              membershipId: m.id,
                              version: m.version,
                              status: "Active",
                            })
                          }
                        >
                          بازگردانی
                        </button>
                      )}
                      <button
                        disabled={busy || m.status === "Removed"}
                        onClick={() =>
                          void action({
                            operation: "changeMember",
                            membershipId: m.id,
                            version: m.version,
                            status: "Removed",
                          })
                        }
                      >
                        حذف عضویت
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="saas-card">
        <h2>دعوت‌نامه‌ها</h2>
        {data?.invitations.length === 0 && <p>دعوت‌نامه‌ای ثبت نشده است.</p>}
        {data?.invitations.map((i: any) => (
          <div className="saas-invitation-row" key={i.id}>
            <span dir="ltr">{i.email}</span>
            <span>
              {i.roles.map((r: string) => roleLabels[r] ?? r).join("، ")} ·{" "}
              {
                (
                  {
                    Pending: "در انتظار پذیرش",
                    Accepted: "پذیرفته‌شده",
                    Expired: "منقضی",
                    Revoked: "لغوشده",
                  } as any
                )[i.status]
              }
            </span>
            {canInvite && i.status === "Pending" && (
              <button
                disabled={busy}
                onClick={() =>
                  void action({ operation: "revokeInvite", invitationId: i.id })
                }
              >
                لغو دعوت
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
export function ProfilePage() {
  const view = useSaaS(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function profile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saasRequest({
        operation: "profile",
        ...Object.fromEntries(new FormData(e.currentTarget)),
      });
      location.reload();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }
  async function password(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    if (d.get("newPassword") !== d.get("confirm")) {
      setError("دو رمز جدید یکسان نیستند.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: d.get("currentPassword"),
          newPassword: d.get("newPassword"),
          revokeOtherSessions: true,
        }),
      });
      if (!r.ok) throw Error("رمز فعلی یا رمز جدید معتبر نیست.");
      form.reset();
      setMessage("رمز تغییر کرد و نشست‌های دیگر بسته شدند.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="saas-page">
      <h1>حساب من</h1>
      <p dir="ltr">{view?.user.email}</p>
      <FormStatus error={error} message={message} />
      {view && (
        <form className="saas-card saas-form saas-two" onSubmit={profile}>
          <Field name="name" label="نام نمایشی" defaultValue={view.user.name} />
          <Field
            name="avatarUrl"
            label="نشانی تصویر (HTTPS، اختیاری)"
            type="url"
            required={false}
            defaultValue={view.user.avatarUrl ?? ""}
          />
          <Field
            name="locale"
            label="زبان و قالب منطقه‌ای"
            defaultValue={view.user.locale ?? "fa-IR"}
          />
          <Field
            name="timezone"
            label="منطقه زمانی"
            defaultValue={view.user.timezone ?? "Asia/Tehran"}
          />
          <button className="saas-primary" disabled={busy}>
            ذخیره پروفایل
          </button>
        </form>
      )}
      <form className="saas-card saas-form" onSubmit={password}>
        <h2>تغییر رمز عبور</h2>
        <Field
          name="currentPassword"
          label="رمز فعلی"
          type="password"
          autoComplete="current-password"
        />
        <Field
          name="newPassword"
          label="رمز جدید"
          type="password"
          autoComplete="new-password"
        />
        <Field
          name="confirm"
          label="تکرار رمز جدید"
          type="password"
          autoComplete="new-password"
        />
        <button className="saas-primary" disabled={busy}>
          تغییر رمز و بستن نشست‌های دیگر
        </button>
        <small>بازیابی رمز از طریق ایمیل هنوز متصل نیست.</small>
      </form>
    </section>
  );
}
export function InvitationPage({
  token,
  invitation,
  userEmail,
}: {
  token: string;
  invitation: { companyName: string; email: string } | null;
  userEmail: string | null;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const target = "/invite/" + token;
  return (
    <div className="saas-invite">
      <Brand />
      <section className="saas-card">
        <span className="saas-eyebrow">JOIN YOUR TEAM</span>
        <h1>
          {invitation
            ? "دعوت به " + invitation.companyName
            : "این دعوت در دسترس نیست"}
        </h1>
        {invitation ? (
          <>
            <p>این دعوت برای ایمیل زیر صادر شده است:</p>
            <p dir="ltr">{invitation.email}</p>
            {!userEmail ? (
              <div className="saas-row-actions">
                <Link
                  className="saas-primary"
                  href={"/signup?returnTo=" + encodeURIComponent(target)}
                >
                  ایجاد حساب و ادامه
                </Link>
                <Link href={"/login?returnTo=" + encodeURIComponent(target)}>
                  حساب دارید؟ وارد شوید
                </Link>
              </div>
            ) : userEmail !== invitation.email ? (
              <>
                <p className="saas-error" role="alert">
                  ایمیل حساب شما با دعوت یکسان نیست. با حساب دعوت‌شده وارد شوید.
                </p>
                <Link href="/settings/profile">رفتن به حساب من</Link>
              </>
            ) : (
              <button
                className="saas-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saasRequest({ operation: "acceptInvite", token });
                    location.assign("/");
                  } catch (err) {
                    setError(errorText(err));
                    setBusy(false);
                  }
                }}
              >
                {busy ? "در حال پذیرش…" : "پذیرش دعوت و ورود به شرکت"}
              </button>
            )}
          </>
        ) : (
          <p>
            لینک نامعتبر، منقضی یا لغوشده است، یا قبلاً پذیرفته شده است. از مدیر
            شرکت دعوت تازه بخواهید.
          </p>
        )}
        <FormStatus error={error} />
      </section>
    </div>
  );
}
