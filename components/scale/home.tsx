"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/system/ui";
import { useScale } from "./provider";
import { GrowthLab, ExperimentLinks } from "./experiments";
import { FunnelSummary } from "./funnel";
import { NetworkSummary } from "./network-shared";
import {ReadinessSummary} from './readiness-shared';
import { fa, Text, Select } from "./shared";
import * as M from "@/lib/scale/model";
import {
  scaleSetupReadiness,
  scaleNeedsAttention,
  ideaPriority,
  ideaReadiness,
  diagnosisSummary,
} from "@/lib/scale/logic";
export function ScaleHome() {
  const { store: s, sources } = useScale();
  const p = s.constraints.find((c) => c.id === s.primaryConstraintId),
    goal = sources.keyResults.find(
      (k) => k.id === s.profile.linkedStrategyKRId,
    ),
    capacity = sources.capacity.some(
      (p) =>
        p.health !== null ||
        p.independence !== null ||
        p.founderDependency !== "none",
    ),
    readiness = scaleSetupReadiness(s, capacity, !!goal),
    attention = scaleNeedsAttention(
      s,
      sources.capacity.some((p) => p.risk),
      !!goal,
    );
  const top = p?.leverIds
    .map((id) => ({
      lever: s.levers.find((l) => l.id === id && l.active),
      count: s.ideas.filter(
        (i) =>
          i.constraintId === p.id &&
          i.leverId === id &&
          !["archived", "rejected"].includes(i.status),
      ).length,
    }))
    .filter((x) => x.lever)
    .sort(
      (a, b) => b.count - a.count || a.lever!.id.localeCompare(b.lever!.id),
    )[0];
  return (
    <>
      <section className="scale-hero">
        <div>
          <small>محدودیت امروز، مسیر بررسی فردا</small>
          <h2>{p?.title ?? "مهم‌ترین گلوگاه رشد هنوز انتخاب نشده است."}</h2>
          <p>{diagnosisSummary(s)}</p>
          <Link href={p ? `/scale/constraints/${p.id}` : "/scale/constraints"}>
            بررسی گلوگاه اصلی ←
          </Link>
        </div>
        <div className="scale-readiness">
          <small>آمادگی برای کار رشد</small>
          <strong>
            {fa(readiness.score)}
            <small> / ۱۰۰</small>
          </strong>
          <p>کامل بودن مقدمات؛ نه سلامت یا عملکرد رشد</p>
        </div>
      </section>
      <div className="scale-stats">
        {[
          ["مرحله رشد", s.profile.stage ? M.stages[s.profile.stage] : "نامشخص"],
          [
            "گلوگاه فعال",
            fa(s.constraints.filter((c) => c.status === "active").length),
          ],
          [
            "ایده با اولویت بالا",
            fa(
              s.ideas.filter(
                (i) =>
                  !["archived", "rejected"].includes(i.status) &&
                  (ideaPriority(i).score ?? 0) >= 10,
              ).length,
            ),
          ],
          [
            "آماده آزمایش",
            fa(
              s.ideas.filter(
                (i) => i.status === "ready" && ideaReadiness(i, s).ready,
              ).length,
            ),
          ],
        ].map(([label, value]) => (
          <div className="scale-card" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="scale-grid">
        <Panel
          title="اهرم مورد توجه"
          caption="بیشترین ایده باز در اهرم‌های گلوگاه اصلی؛ رتبه اثربخشی نیست."
        >
          <h3>{top?.lever?.name ?? "هنوز مشخص نیست"}</h3>
          <Link href="/scale/levers">بررسی کتابخانه اهرم‌ها ←</Link>
        </Panel>
        <Panel title="هدف و اتصال استراتژی">
          <p>
            {s.profile.linkedStrategyKRId
              ? (goal?.title ?? "منبع هدف در دسترس نیست")
              : s.profile.growthGoal || "هدف ثبت نشده"}
          </p>
          <p>
            {goal
              ? `${fa(goal.currentValue)} ← ${fa(goal.targetValue)} ${goal.unit}`
              : s.profile.growthHorizon}
          </p>
          <Link href="/scale/diagnosis">بررسی جهت رشد ←</Link>
        </Panel>
      </div>
      <GrowthLab />
      <FunnelSummary />
      <NetworkSummary />
      <ReadinessSummary />
      <Panel title="نیازمند توجه">
        {attention.length ? (
          <ul className="scale-attention">
            {attention.map((a, i) => (
              <li key={i}>
                <Link href={a.href}>{a.text} ←</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>در قواعد فعلی موردی ثبت نشده؛ این به معنی تضمین رشد نیست.</p>
        )}
      </Panel>
      <Panel
        title="شواهد سیستم و ظرفیت"
        caption="فقط خواندنی؛ امتیازها از منطق فعلی سیستم و داده‌های موجود محاسبه می‌شوند."
      >
        {!sources.capacity.length ? (
          <p>داده سیستم موجود نیست؛ ظرفیت ناشناخته است.</p>
        ) : (
          sources.capacity.map((p) => (
            <div className="scale-row" key={p.id}>
              <Link href={`/system/processes/${p.id}`}>{p.title}</Link>
              <span>
                سلامت {fa(p.health)} · استقلال {fa(p.independence)}{" "}
                {p.risk ? `· ${p.reasons.join("؛ ")}` : ""}
              </span>
            </div>
          ))
        )}
        <Link href="/system/independence">
          بررسی استقلال و وابستگی به بنیان‌گذار ←
        </Link>
      </Panel>
      <Panel title="اجزای آمادگی رشد">
        <p>
          داده مفقود در عملکرد ناشناخته است؛ در این چک‌لیست آمادگی، امتیاز تکمیل
          نمی‌گیرد.
        </p>
        {readiness.parts.map((p) => (
          <div className="scale-row" key={p.label}>
            <span>{p.label}</span>
            <span>
              {fa(p.value * p.weight)} از {fa(p.weight)}
            </span>
          </div>
        ))}
      </Panel>
    </>
  );
}
export function Levers() {
  const { store, commit } = useScale(),
    [name, setName] = useState(""),
    [dimension, setDimension] = useState<M.Dimension>("acquisition"),
    [error, setError] = useState("");
  return (
    <>
      <h2>کتابخانه اهرم‌های رشد</h2>
      <p>
        حوزه‌های ممکن مداخله؛ پیشنهاد چارچوب بر اساس بُعد، بدون ادعای اثربخشی.
      </p>
      <form
        className="scale-card"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit({
              ...store,
              levers: [
                ...store.levers,
                {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  category: "custom",
                  description: "اهرم سفارشی مدیریت",
                  applicableDimensions: [dimension],
                  active: true,
                  custom: true,
                  createdAt: M.now(),
                },
              ],
            });
            setName("");
            setError("");
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <div className="scale-grid">
          <Text
            required
            label="نام اهرم سفارشی"
            value={name}
            onChange={setName}
          />
          <Select
            label="بُعد مرتبط اهرم"
            value={dimension}
            items={M.dimensions}
            onChange={(v) => setDimension(v as M.Dimension)}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">افزودن اهرم</Button>
      </form>
      <div className="scale-grid">
        {store.levers.map((l) => (
          <article className="scale-card" key={l.id}>
            <small>{M.categories[l.category]}</small>
            <h3>{l.name}</h3>
            <details>
              <summary>شواهد آزمایش این اهرم</summary>
              <ExperimentLinks leverId={l.id} />
            </details>
            <p>{l.description}</p>
            <p>
              {l.applicableDimensions.map((d) => M.dimensions[d]).join("، ")}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
export function FutureScale({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <p>
        این بخش در مرحله بعد ساخته می‌شود. اکنون تشخیص، گلوگاه، ایده و آزمایش در
        دسترس‌اند؛ تحلیل کامل قیف، موتورهای رشد و گزارش نهایی رشد هنوز فعال
        نیستند.
      </p>
      <Link href="/scale/ideas">بازگشت به ایده‌های رشد ←</Link>
    </Panel>
  );
}
