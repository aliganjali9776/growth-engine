"use client";
import "./analysis.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/system/ui";
import { useAnalysis } from "./provider";
import { useSystem } from "@/components/system/provider";
import {
  reviewCurrent,
  approvalCurrent,
  redesignReadiness,
} from "@/lib/system/analysis/redesign";
import { mapCompleteness } from "@/lib/system/maps/logic";
import type { ProcessMap } from "@/lib/system/maps/model";
export function ProcessNav({ id }: { id: string }) {
  const currentPath = usePathname();
  return (
    <nav className="analysis-nav" aria-label="ابزارهای فرآیند">
      {[
        ["", "شناسنامه"],
        ["/map", "وضعیت فعلی (AS-IS)"],
        ["/analysis", "تحلیل"],
        ["/to-be", "وضعیت مطلوب (TO-BE)"],
        ["/compare", "مقایسه"],
        ["/standardize", "استانداردسازی"],
        ["/implementation", "پیاده‌سازی"],
        ["/kpis", "شاخص‌ها"],
        ["/review", "مرور هفتگی"],
        ["/improvements", "بهبود"],
      ].map(([path, label]) => (
        <Link
          key={path}
          href={`/system/processes/${id}${path}`}
          aria-current={
            currentPath === `/system/processes/${id}${path}`
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
export function Confirmation({
  asis,
  kind,
}: {
  asis: ProcessMap;
  kind: "review" | "approval";
}) {
  const { store, confirm, error } = useAnalysis(),
    { data } = useSystem(),
    [asking, setAsking] = useState(false),
    [failure, setFailure] = useState("");
  const r = store?.records.find((r) => r.processId === asis.processId),
    p = data.processes.find((p) => p.id === asis.processId),
    current =
      kind === "review"
        ? reviewCurrent(r, asis, data)
        : approvalCurrent(r, asis, data);
  const allowed =
    kind === "review"
      ? !!p &&
        p.systemizationStage !== "identified" &&
        mapCompleteness(asis, data).ready
      : !!p &&
        [
          "analyzed",
          "redesigned",
          "standardized",
          "implemented",
          "measured",
          "improving",
        ].includes(p.systemizationStage) &&
        !!r?.toBe &&
        redesignReadiness(r.toBe, data).ready &&
        reviewCurrent(r, asis, data);
  return (
    <section className="analysis-confirm">
      <div>
        <strong>
          {kind === "review" ? "مرور تحلیل AS-IS" : "تأیید نسخه آینده"}
        </strong>
        <p>
          {current
            ? `تأیید معتبر · ${new Date((kind === "review" ? r?.review : r?.approval)!.at).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}`
            : kind === "review"
              ? "تحلیل نقشه فعلی هنوز تأیید نشده یا داده‌ها تغییر کرده‌اند."
              : "نسخه آماده، تحلیل معتبر و مرحله تحلیل لازم است. ویرایش محتوا تأیید قبلی را نامعتبر می‌کند."}
        </p>
      </div>
      <Button
        disabled={!allowed || current || !!error}
        onClick={() => setAsking(true)}
      >
        {kind === "review" ? "ثبت مرحله تحلیل" : "تأیید بازطراحی"}
      </Button>
      {asking && (
        <div className="analysis-confirm-question">
          <p>
            {kind === "review"
              ? "تحلیل این نسخه را مرور کرده‌اید؟ مرحله مدل‌سازی به تحلیل تغییر می‌کند."
              : "این طراحی آینده را تأیید می‌کنید؟ مرحله تحلیل به بازطراحی تغییر می‌کند؛ این تأیید، اثبات اجرای واقعی بهبود نیست."}
          </p>
          <Button
            onClick={() => {
              try {
                confirm(asis, kind);
                setAsking(false);
                setFailure("");
              } catch (e) {
                setFailure(e instanceof Error ? e.message : "ثبت انجام نشد.");
              }
            }}
          >
            تأیید و ثبت
          </Button>
          <Button secondary onClick={() => setAsking(false)}>
            انصراف
          </Button>
        </div>
      )}
      {failure && <p role="alert">{failure}</p>}
    </section>
  );
}
