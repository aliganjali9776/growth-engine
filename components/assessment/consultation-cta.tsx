"use client";
import { useState } from "react";
import { ArrowLeft, FileSearch, X } from "lucide-react";
export function ConsultationCTA({
  copy,
  onRoadmap,
}: {
  copy: string;
  onRoadmap: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="consultation-cta">
      <div>
        <span className="eyebrow">FROM FINDINGS TO EXPERT PRIORITIES</span>
        <h2>از شناخت شکاف‌ها تا انتخاب اقدام درست</h2>
        <p>{copy}</p>
        <p>
          در جلسه تحلیل تخصصی 3S، نتایج این ارزیابی به‌صورت عمیق بررسی می‌شوند و
          اولویت‌های اصلاح و توسعه مشخص خواهند شد.
        </p>
      </div>
      <div className="consultation-actions">
        <button
          className="assessment-primary"
          aria-expanded={open}
          aria-controls="consultation-preview"
          onClick={() => setOpen(!open)}
        >
          دریافت تحلیل تخصصی 3S
          <ArrowLeft size={16} />
        </button>
        <button className="assessment-secondary" onClick={onRoadmap}>
          مشاهده نقشه بهبود
        </button>
      </div>
      {open && (
        <div
          id="consultation-preview"
          className="consultation-preview"
          role="status"
        >
          <FileSearch size={24} />
          <div>
            <h3>پیش‌نمایش تحلیل تخصصی 3S</h3>
            <p>
              در این مرحله، امکان رزرو یا ارسال درخواست فعال نیست و اطلاعات شما
              ارسال نمی‌شود.
            </p>
            <ul>
              <li>بررسی شواهد پشت پاسخ‌ها و شکاف‌های هر محور</li>
              <li>تفکیک ریشه مسئله از نشانه‌ها و پیامدها</li>
              <li>توافق بر اولویت‌های اصلاح و توسعه</li>
            </ul>
          </div>
          <button
            className="icon-button"
            aria-label="بستن پیش‌نمایش تحلیل"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
