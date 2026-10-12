"use client";
import { useState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { saasRequest, useSaaS } from "./shell";
export function ProductLock() {
  const view = useSaaS(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [submitted, setSubmitted] = useState(false);
  return (
    <section
      className="saas-card"
      style={{
        maxWidth: 680,
        margin: "64px auto",
        padding: 40,
        textAlign: "center",
      }}
    >
      <LockKeyhole
        size={36}
        style={{ margin: "0 auto 24px", color: "var(--accent)" }}
      />
      <p className="eyebrow">مسیر کامل رشد</p>
      <h1>دسترسی در انتظار فعال‌سازی</h1>
      <p>
        برای فعال‌سازی مسیر کامل توسعه کسب‌وکار، دسترسی شما باید توسط تیم فعال
        شود.
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 16,
          margin: "24px 0",
        }}
      >
        {[
          ["system", "سیستم"],
          ["strategy", "استراتژی"],
          ["scale", "اسکیل"],
          ["advisor", "مشاور"],
        ].map(([path, label]) => (
          <Link className="saas-card" key={path} href={"/" + path}>
            {label} 🔒
          </Link>
        ))}
      </div>
      <button
        className="primary-button"
        disabled={busy || submitted}
        onClick={async () => {
          setBusy(true);
          try {
            await saasRequest(
              { operation: "requestAccess" },
              view?.current?.id,
            );
            setMessage("درخواست شما ثبت شد و توسط تیم بررسی می‌شود.");
            setSubmitted(true);
          } catch {
            setMessage("ثبت درخواست ممکن نشد؛ دوباره تلاش کنید.");
          } finally {
            setBusy(false);
          }
        }}
      >
        درخواست فعال‌سازی
      </button>
      <p role="status">{message}</p>
      <Link href="/assessment">ادامه ارزیابی 3S</Link>
    </section>
  );
}
