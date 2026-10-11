"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdvisorNavigation() {
  const path = usePathname();
  return (
    <nav className="preparation-nav" aria-label="بخش‌های مشاور">
      {[
        ["/advisor/workspace", "فضای مشاور"],
        ["/advisor/insights", "تحلیل‌ها"],
        ["/advisor/actions", "اقدامات پیشنهادی"],
        ["/advisor/history", "تاریخچه"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (href === "/advisor" ? path === href : path.startsWith(href))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
