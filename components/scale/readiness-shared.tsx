"use client";
import Link from "next/link";
import { Panel } from "@/components/system/ui";
import { useScale } from "./provider";
import * as M from "@/lib/scale/readiness/model";
import {
  scaleReadiness,
  preparationProgress,
} from "@/lib/scale/readiness/logic";
export function ReadinessEntry({
  type = "management",
  id = "",
}: {
  type?: M.ScaleCandidate["sourceType"];
  id?: string;
}) {
  return (
    <p>
      <Link
        href={`/scale/readiness?source=${type}&sourceId=${encodeURIComponent(id)}`}
      >
        بررسی آمادگی مقیاس‌دهی و ظرفیت ←
      </Link>
    </p>
  );
}
export function ReadinessSummary() {
  const { store, sources } = useScale(),
    d = M.readinessData(store),
    rows = d.candidates
      .filter((c) => c.status !== "archived")
      .map((c) => ({
        c,
        a: scaleReadiness(
          store,
          c,
          sources,
          d.scenarios.filter((x) => x.candidateId === c.id).at(-1) ?? null,
        ),
      })),
    p = preparationProgress(d.preparation);
  return (
    <Panel
      title="دروازه مقیاس‌دهی"
      caption="رشد تکرارشونده در کنار ظرفیت سازمان؛ تصمیم نهایی با مدیریت است."
    >
      <div className="scale-grid">
        <p>کاندیدها: {rows.length}</p>
        <p>
          آماده بررسی تصمیم: {rows.filter((r) => r.a.gate === "ready").length}
        </p>
        <p>
          ابتدا آماده‌سازی: {rows.filter((r) => r.a.gate === "prepare").length}
        </p>
        <p>
          آماده‌سازی تکمیل‌شده: {p.completed} از {p.total}
        </p>
      </div>
      {rows
        .filter((r) => r.a.primary)
        .slice(0, 3)
        .map(({ c, a }) => (
          <p key={c.id}>
            <Link href={`/scale/readiness/${c.id}`}>{c.name}</Link>: ریسک اصلی{" "}
            {a.primary?.area} · محدودیت بعدی احتمالی {a.next?.area ?? "نامشخص"}
          </p>
        ))}
      <div className="scale-actions">
        <Link href="/scale/readiness">کاندیدها و آمادگی</Link>
        <Link href="/scale/capacity">برنامه ظرفیت</Link>
        <Link href="/scale/scale-decisions">تصمیم‌ها و تاریخچه</Link>
      </div>
    </Panel>
  );
}
