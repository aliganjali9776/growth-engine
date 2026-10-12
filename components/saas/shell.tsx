"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/app-shell";
import { navigation } from "@/lib/mock-data";
import {
  flushWorkspace,
  bindWorkspaceStorage,
  createWorkspaceStorage,
  lockWorkspaceStorage,
} from "@/lib/saas/workspace-storage";
import { roleLabels } from "@/lib/saas/roles";
import { permissionForPage } from "@/lib/server/permissions";
export interface CompanyChoice {
  id: string;
  name: string;
  roles: string[];
}
export interface SaaSView {
  accessTier?: "assessment_only" | "full_access";
  platformAdmin?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    locale?: string;
    timezone?: string;
    avatarUrl?: string | null;
  };
  organizations: CompanyChoice[];
  current: CompanyChoice | null;
  permissions: readonly string[];
}
const Context = createContext<SaaSView | null>(null);
export function useSaaS() {
  return useContext(Context);
}
export async function saasRequest(body: unknown, organizationId?: string) {
  const response = await fetch("/api/saas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(organizationId ? { "x-organization-id": organizationId } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(
      response.status === 409
        ? "این تغییر با وضعیت فعلی سازگار نیست؛ آخرین مالک قابل حذف یا تنزل نیست."
        : response.status === 401
          ? "نشست پایان یافته است؛ دوباره وارد شوید."
          : response.status === 403
            ? "اجازه انجام این کار را ندارید."
            : "انجام درخواست ممکن نشد. اطلاعات را بررسی و دوباره تلاش کنید.",
    );
  return result;
}
export async function enterCompany(id: string, returnTo = "/") {
  await flushWorkspace();
  await saasRequest({ operation: "switch", organizationId: id });
  window.location.assign(returnTo);
}
export function SaaSShell({
  view,
  children,
}: {
  view: SaaSView;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    // A full request re-resolves the server session and remounts tenant providers.
    // This also covers selector/onboarding/profile, which have no WorkspaceBridge.
    const navigate = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !target ||
        target.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.button !== 0
      )
        return;
      const href = new URL(target.href, location.href);
      if (
        href.origin !== location.origin ||
        (href.pathname === location.pathname &&
          href.search === location.search &&
          href.hash)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void flushWorkspace()
        .then(() => location.assign(href.href))
        .catch(() => {});
    };
    document.addEventListener("click", navigate, true);
    return () => document.removeEventListener("click", navigate, true);
  }, []);
  async function logout() {
    setBusy(true);
    try {
      // Failed draft persistence must never prevent session revocation.
      try {
        await flushWorkspace();
      } catch {
        /* draft error is already visible */
      }
      const r = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw Error();
      lockWorkspaceStorage();
      window.location.assign("/login");
    } catch {
      setError("خروج انجام نشد. وضعیت ذخیره را بررسی کنید.");
      setBusy(false);
    }
  }
  return (
    <Context.Provider value={view}>
      <div className="saas-shell">
        <a className="skip-link" href="#saas-main">
          رفتن به محتوای اصلی
        </a>
        <aside className={open ? "saas-nav open" : "saas-nav"}>
          <Brand />
          <label className="saas-switcher">
            شرکت فعال
            <select
              value={view.current?.id ?? ""}
              aria-label="انتخاب شرکت"
              disabled={busy}
              onChange={async (e) => {
                setBusy(true);
                try {
                  await enterCompany(e.target.value);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "تعویض شرکت ممکن نشد.",
                  );
                  setBusy(false);
                }
              }}
            >
              <option value="" disabled>
                انتخاب شرکت
              </option>
              {view.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.roles.map((r) => roleLabels[r] ?? r).join("، ")}
                </option>
              ))}
            </select>
          </label>
          <Link className="saas-create-link" href="/onboarding/company">
            + ایجاد شرکت جدید
          </Link>
          <nav aria-label="ناوبری اصلی">
            {navigation
              .filter((n) =>
                view.permissions.includes(permissionForPage(n.href)) || view.accessTier === "assessment_only",
              )
              .map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={
                    path === n.href ||
                    (n.href !== "/" && path.startsWith(n.href + "/"))
                      ? "page"
                      : undefined
                  }
                >
                  {n.label}{view.accessTier === "assessment_only" && /^\/(system|strategy|scale|advisor|agent)(\/|$)/.test(n.href) ? " 🔒" : ""}
                </Link>
              ))}
          </nav>
          <nav aria-label="مدیریت حساب و شرکت">
            {view.platformAdmin && <Link href="/admin">مدیریت پلتفرم</Link>}
            {view.permissions.includes("organization.view") && (
              <Link href="/settings/company">تنظیمات شرکت</Link>
            )}
            {view.permissions.includes("members.view") && (
              <Link href="/settings/members">اعضا و دعوت‌نامه‌ها</Link>
            )}
            {view.permissions.includes("roles.view") && (
              <Link href="/settings/access">ماتریس دسترسی</Link>
            )}
            {view.permissions.includes("organization.update") && (
              <Link href="/settings/data-migration">انتقال و پشتیبان داده</Link>
            )}
            {view.permissions.includes("agent.view") && (
              <Link href="/advisor/authorized-actions">
                تأیید اقدامات شرکتی
              </Link>
            )}
            <Link href="/settings/profile">حساب من</Link>
            <Link href="/organizations">شرکت‌های من</Link>
          </nav>
        </aside>
        {open && (
          <button
            className="saas-overlay"
            aria-label="بستن منو"
            onClick={() => setOpen(false)}
          />
        )}
        <div className="saas-main-wrap">
          <header className="saas-top">
            <button
              className="saas-menu"
              aria-expanded={open}
              aria-label="منوی اصلی"
              onClick={() => setOpen(!open)}
            >
              ☰
            </button>
            <div>
              <strong>{view.current?.name ?? "فضای شرکت‌های شما"}</strong>
              <small>
                {view.current?.roles.map((r) => roleLabels[r] ?? r).join("، ")}
              </small>
            </div>
            <div>
              <Link href="/settings/profile">{view.user.name}</Link>
              <button disabled={busy} onClick={logout}>
                خروج
              </button>
            </div>
          </header>
          {error && (
            <p className="saas-error" role="alert">
              {error}
            </p>
          )}
          <main id="saas-main" tabIndex={-1}>
            {children}
          </main>
          <footer className="saas-footer">
            Growth Engine by 1 Minute Manager
          </footer>
        </div>
      </div>
    </Context.Provider>
  );
}
export function WorkspaceBridge({
  view,
  initial,
  children,
}: {
  view: SaaSView;
  initial: Parameters<typeof createWorkspaceStorage>[0];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const readOnly =
    pathname === "/assessment" ? !(view.permissions.includes("organization.update") || view.permissions.includes("system.edit")) :
    /^\/(system|strategy|scale)(\/|$)/.test(pathname) &&
    !view.permissions.includes(`${pathname.split("/")[1]}.edit`);
  const [ready, setReady] = useState(false),
    [status, setStatus] = useState("saved"),
    [error, setError] = useState("");
  const statusRef = useRef("saved");
  useEffect(() => {
    const storage = createWorkspaceStorage(initial, (s, e) => {
      setStatus(s);
      statusRef.current = s;
      if (e) setError(e);
    });
    bindWorkspaceStorage(storage);
    setReady(true);
    const timer = setInterval(async () => {
      try {
        const r = await fetch("/api/saas");
        if (!r.ok) {
          setReady(false);
          lockWorkspaceStorage();
          window.location.assign("/login");
          return;
        }
        const ctx = await r.json();
        if (ctx.current?.organization?.id !== initial.organizationId) {
          setReady(false);
          lockWorkspaceStorage();
          window.location.assign("/organizations");
          return;
        }
        if (
          JSON.stringify([...(ctx.current?.permissions ?? [])].sort()) !==
          JSON.stringify([...view.permissions].sort())
        ) {
          setReady(false);
          lockWorkspaceStorage();
          window.location.reload();
        }
      } catch {
        /* save attempts also fail closed */
      }
    }, 10000);
    const leave = (event: BeforeUnloadEvent) => {
      if (statusRef.current === "pending") {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      clearInterval(timer);
      storage.dispose();
      lockWorkspaceStorage();
      window.removeEventListener("beforeunload", leave);
    };
  }, [initial.organizationId, view.user.id]);
  return (
    <SaaSShell view={view}>
      <div className="saas-persistence" role="status">
        {status === "pending"
          ? "در حال ذخیره در فضای شرکت…"
          : status === "error"
            ? error
            : "فضای شرکت متصل است"}
        {status === "error" && (
          <button onClick={() => window.location.reload()}>
            تازه‌سازی و خواندن نسخه ذخیره‌شده
          </button>
        )}
      </div>
      {ready && status !== "error" ? (
        readOnly ? (
          <>
            <p role="status" className="saas-persistence">
              دسترسی شما فقط برای مشاهده است؛ ایجاد و ویرایش مجاز نیست.
            </p>
            <fieldset
              disabled
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              {children}
            </fieldset>
          </>
        ) : (
          children
        )
      ) : (
        <section className="saas-card">
          <p>
            {status === "error"
              ? "برای جلوگیری از تغییر نادرست، فضای کار متوقف شد."
              : "در حال آماده‌سازی فضای امن شرکت…"}
          </p>
        </section>
      )}
    </SaaSShell>
  );
}
