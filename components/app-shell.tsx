"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ScanLine,
  Network,
  Target,
  TrendingUp,
  ListChecks,
  ChartNoAxesCombined,
  Settings,
  ChevronsUpDown,
  Building2,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  ArrowUpLeft,
  Command,
} from "lucide-react";
import { navigation } from "@/lib/mock-data";
const icons: Record<string, typeof Home> = {
  home: Home,
  assessment: ScanLine,
  system: Network,
  strategy: Target,
  scale: TrendingUp,
  execution: ListChecks,
  dashboard: ChartNoAxesCombined,
};
export function Brand() {
  return (
    <div className="brand" dir="ltr">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <div>
        <strong>Growth Engine</strong>
        <small>by 1 Minute Manager</small>
      </div>
    </div>
  );
}
export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const path = usePathname();
  return (
    <>
      <button
        className={`sidebar-overlay ${open ? "visible" : ""}`}
        aria-label="بستن منو"
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Brand />
        <label className="company-selector">
          <Building2 size={19} />
          <select aria-label="انتخاب شرکت">
            <option>شرکت نمونه آریا</option>
          </select>
          <ChevronsUpDown size={14} />
        </label>
        <div className="nav-caption">فضای مدیریت</div>
        <nav aria-label="ناوبری اصلی">
          {navigation.map((n, i) => {
            const Icon = icons[n.icon];
            const activePath = n.icon === 'system' ? '/system' : n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onClose}
                aria-current={
                  path === activePath || path.startsWith(`${activePath}/`)
                    ? "page"
                    : undefined
                }
                className={`nav-item ${path === activePath || path.startsWith(`${activePath}/`) ? "active" : ""} ${i === 2 ? "nav-divider" : ""}`}
              >
                <Icon size={19} />
                <span>{n.label}</span>
                {n.step && <small>{n.step}</small>}
                {(path === activePath || path.startsWith(`${activePath}/`)) && (
                  <i className="active-dot" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="method-card">
            <span dir="ltr">THE 3S METHODOLOGY</span>
            <p>
              سیستم <span>←</span> استراتژی <span>←</span> اسکیل
            </p>
            <small>ساختار امروز، رشد فردا.</small>
          </div>
          <Link
            href="/settings"
            onClick={onClose}
            className={`nav-item ${path === "/settings" ? "active" : ""}`}
          >
            <Settings size={18} />
            تنظیمات
          </Link>
          <div className="sidebar-version">
            <span className="live-dot" />
            فضای مدیریت کسب‌وکار
          </div>
        </div>
      </aside>
    </>
  );
}
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const [panel, setPanel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const path = usePathname();
  useEffect(() => {
    setPanel(null);
  }, [path]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPanel("search");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  return (
    <>
      <header className="topbar">
        <div className="topbar-context">
          <button
            className="icon-button mobile-menu"
            onClick={onMenu}
            aria-label="باز کردن منو"
          >
            <Menu size={21} />
          </button>
          <span className="company-name">شرکت نمونه آریا</span>
          <span className="top-divider" />
          <span className="cycle">
            <span className="live-dot" />
            فصل سوم ۱۴۰۵
            <ChevronDown size={13} />
          </span>
        </div>
        <div className="topbar-actions">
          <button
            className="search-trigger"
            onClick={() => setPanel("search")}
            aria-label="جست‌وجو"
          >
            <Search size={17} />
            <span>جست‌وجو در فضای کار</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            className="icon-button notification-button"
            onClick={() =>
              setPanel(panel === "notifications" ? null : "notifications")
            }
            aria-label="اعلان‌ها"
          >
            <Bell size={19} />
            <i />
          </button>
          <span className="top-divider" />
          <button
            className="profile-button"
            onClick={() => setPanel(panel === "profile" ? null : "profile")}
            aria-label="پروفایل علی"
          >
            <span className="avatar">ع ر</span>
            <span className="profile-name">
              علی رضایی<small>مدیرعامل</small>
            </span>
            <ChevronDown size={13} />
          </button>
        </div>
      </header>
      {panel && (
        <div className="dialog-backdrop" onClick={() => setPanel(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "search"
                ? "جست‌وجو"
                : panel === "profile"
                  ? "پروفایل"
                  : "اعلان‌ها"
            }
            className="dialog"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                "button, a[href], input",
              );
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus={panel !== "search"}
              className="dialog-close icon-button"
              onClick={() => setPanel(null)}
              aria-label="بستن"
            >
              <X size={20} />
            </button>
            {panel === "search" ? (
              <>
                <h2>
                  <Command size={20} /> جست‌وجو در فضای کار
                </h2>
                <input
                  autoFocus
                  placeholder="نام بخش موردنظر را بنویسید…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="search-results">
                  {navigation
                    .filter((n) => n.label.includes(query))
                    .map((n) => (
                      <Link
                        key={n.href}
                        href={n.href}
                        onClick={() => setPanel(null)}
                      >
                        {n.label}
                        <ArrowUpLeft size={16} />
                      </Link>
                    ))}
                  {!navigation.some((n) => n.label.includes(query)) && (
                    <p>بخشی با این نام پیدا نشد.</p>
                  )}
                </div>
              </>
            ) : panel === "profile" ? (
              <>
                <span className="avatar">ع ر</span>
                <h2>علی رضایی</h2>
                <p>مدیرعامل · شرکت نمونه آریا</p>
                <p className="muted">پروفایل نمونه برای بررسی تجربه کاربری</p>
                <Link className="button" href="/settings">
                  تنظیمات فضای کاری
                </Link>
              </>
            ) : (
              <>
                <h2>اعلان‌ها</h2>
                <p className="muted">پیش‌نمایش · اعلان زنده متصل نیست</p>
                <div className="notice-row">
                  مرور هفتگی تیم فروش<span>فردا، ساعت ۱۰:۰۰</span>
                </div>
                <div className="notice-row">
                  ۲ گزارش پیشرفت در انتظار تکمیل<span>هفته هشتم</span>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      <AppSidebar open={open} onClose={() => setOpen(false)} />
      <div className="workspace">
        <TopBar onMenu={() => setOpen(true)} />
        <main id="main-content">{children}</main>
        <footer className="workspace-footer">
          <span>با تمرکز مدیریت کنید. با اطمینان رشد کنید.</span>
          <span dir="ltr">
            Growth Engine <i /> by 1 Minute Manager
          </span>
        </footer>
      </div>
    </div>
  );
}
