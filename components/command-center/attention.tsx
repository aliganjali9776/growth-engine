"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/system/ui";
import type { CommandReport } from "@/lib/system/command-center/report";
import { number } from "@/components/measurement/shared";
export function AttentionFeed({ report: r }: { report: CommandReport }) {
  const [all, setAll] = useState(false);
  return (
    <Panel
      title="نیازمند توجه مدیریت"
      caption="وضعیت فعلی؛ ترتیب بر پایه شدت، اولویت فرآیند و اثر کسب‌وکار است."
    >
      <div className="command-attention">
        {r.risks.slice(0, all ? undefined : 6).map((risk, i) => (
          <article key={risk.id} className={`command-risk ${risk.severity}`}>
            <span className="command-rank">{number(i + 1)}</span>
            <div>
              <Link href={risk.href}>{risk.title}</Link>
              <p>{risk.description}</p>
              <small>
                {risk.metric} · منبع: {risk.source}
              </small>
            </div>
            <span className="command-severity">
              {
                {
                  critical: "بحرانی",
                  high: "زیاد",
                  medium: "متوسط",
                  low: "کم",
                }[risk.severity]
              }
            </span>
          </article>
        ))}
      </div>
      {!r.risks.length && (
        <p>
          ریسک ثبت‌شده‌ای با قواعد فعلی شناسایی نشد؛ پوشش داده را نیز بررسی
          کنید.
        </p>
      )}
      {r.risks.length > 6 && (
        <Button secondary onClick={() => setAll(!all)}>
          {all ? "نمایش کوتاه" : `مشاهده همه ${number(r.risks.length)} مورد`}
        </Button>
      )}
      <details className="command-nested">
        <summary>۵ ریسک اصلی سیستم و ۵ اقدام پیشنهادی مدیریت</summary>
        <div className="command-two">
          <div>
            <h3>۵ ریسک اصلی سیستم</h3>
            <ol>
              {r.risks.slice(0, 5).map((x) => (
                <li key={x.id}>
                  <Link href={x.href}>{x.title}</Link>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3>۵ اقدام پیشنهادی مدیریت</h3>
            <ol>
              {r.actions.map((x) => (
                <li key={x.id}>
                  <Link href={x.href}>{x.title}</Link>
                  <small>{x.reason}</small>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </Panel>
  );
}
