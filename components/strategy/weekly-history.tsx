"use client";
import { useState } from "react";
import Link from "next/link";
import { Field, Panel, Empty } from "@/components/system/ui";
import { useStrategy } from "./provider";
import { dateLabel, roleName, todayTehran } from "@/lib/strategy/model";
import { krStatuses, objectiveHealthLabels } from "@/lib/strategy/kr/types";
import { movementLabels } from "@/lib/strategy/weekly/types";
import {
  getCycleWeek,
  activeWeeklyKRs,
  weeklyCheckInCompletion,
  calculateConfidenceDelta,
} from "@/lib/strategy/weekly/calculations";
import { initiativeNumber as n } from "./initiative-summary";
export function WeeklyHistory({
  keyResultId,
  cycleId,
}: {
  keyResultId?: string;
  cycleId?: string;
}) {
  const { store, roles } = useStrategy(),
    [objective, setObjective] = useState(""),
    [kr, setKR] = useState(""),
    [owner, setOwner] = useState(""),
    [status, setStatus] = useState(""),
    [week, setWeek] = useState("");
  const records = (store.krCheckIns ?? [])
    .filter(
      (i) =>
        (!cycleId || i.cycleId === cycleId) &&
        (!keyResultId || i.keyResultId === keyResultId) &&
        (!objective || i.objectiveId === objective) &&
        (!kr || i.keyResultId === kr) &&
        (!owner || i.ownerRoleId === owner) &&
        (!status || i.status === status) &&
        (!week || String(i.weekNumber) === week),
    )
    .sort(
      (a, b) =>
        b.weekNumber - a.weekNumber ||
        a.krSnapshot.code.localeCompare(b.krSnapshot.code),
    );
  return (
    <div>
      {!keyResultId && (
        <div className="kr-filters">
          <Field label="هدف تاریخچه">
            <select
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value);
                setKR("");
              }}
            >
              <option value="">همه اهداف</option>
              {store.objectives
                .filter((o) => !cycleId || o.cycleId === cycleId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} · {o.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="KR تاریخچه">
            <select value={kr} onChange={(e) => setKR(e.target.value)}>
              <option value="">همه نتایج</option>
              {(store.keyResults ?? [])
                .filter(
                  (k) =>
                    (!cycleId || k.cycleId === cycleId) &&
                    (!objective || k.objectiveId === objective),
                )
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} · {k.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="مالک تاریخچه">
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">همه نقش‌ها</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="وضعیت تاریخچه">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(krStatuses).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="هفته تاریخچه">
            <select value={week} onChange={(e) => setWeek(e.target.value)}>
              <option value="">همه هفته‌ها</option>
              {[
                ...new Set(
                  (store.krCheckIns ?? [])
                    .filter((i) => !cycleId || i.cycleId === cycleId)
                    .map((i) => i.weekNumber),
                ),
              ]
                .sort((a, b) => a - b)
                .map((w) => (
                  <option key={w} value={w}>
                    هفته {n(w)}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      )}
      {!records.length ? (
        <Empty>
          هنوز ثبت هفتگی وجود ندارد؛ تاریخچه از اولین ثبت واقعی آغاز می‌شود.
        </Empty>
      ) : (
        <div
          className="wk-history"
          role="region"
          aria-label="جدول تاریخچه هفتگی"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {[
                  "هفته / نتیجه",
                  "قبلی ← فعلی",
                  "تغییر",
                  "پیشرفت",
                  "اطمینان قبلی ← فعلی",
                  "وضعیت / حرکت",
                  "برد / مانع / قدم بعدی",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={"/strategy/weekly-review/" + i.reviewId}>
                      هفته {n(i.weekNumber)}
                    </Link>
                    <br />
                    {i.krSnapshot.code} · {i.krSnapshot.title}
                    <br />
                    <small>
                      {dateLabel(i.periodStart)} — {dateLabel(i.periodEnd)} ·{" "}
                      {roleName(i.ownerRoleId, roles)}
                    </small>
                  </td>
                  <td>
                    {i.krSnapshot.type === "milestone"
                      ? `${n(i.previousProgress)}٪ ← ${n(i.progress)}٪`
                      : `${n(i.previousValue)} ← ${n(i.currentValue)} ${i.krSnapshot.unit}`}
                  </td>
                  <td dir="ltr">
                    {n(i.delta)}{" "}
                    {i.krSnapshot.type === "milestone"
                      ? "واحد درصد"
                      : i.krSnapshot.unit}
                  </td>
                  <td>{n(i.progress)}٪</td>
                  <td>
                    {n(i.previousConfidence)} ← {n(i.confidence)}
                    <br />
                    <small>تغییر {n(i.confidenceDelta)}</small>
                  </td>
                  <td>
                    {i.status ? krStatuses[i.status] : "داده کافی نیست"}
                    <br />
                    {movementLabels[i.movement]}
                  </td>
                  <td>
                    <p>برد: {i.win || "—"}</p>
                    <p>مانع: {i.blocker || "—"}</p>
                    <p>قدم بعدی: {i.nextAction || "—"}</p>
                    {i.comment && <p>{i.comment}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export function KRWeeklyHistory({ keyResultId }: { keyResultId: string }) {
  return (
    <details className="in-kr-links">
      <summary>آخرین ثبت و تاریخچه هفتگی</summary>
      <WeeklyHistory keyResultId={keyResultId} />
    </details>
  );
}
export function ObjectiveWeeklyHistory({
  objectiveId,
}: {
  objectiveId: string;
}) {
  const { store } = useStrategy(),
    rows = (store.objectiveWeeklySnapshots ?? [])
      .filter((s) => s.objectiveId === objectiveId)
      .sort((a, b) => b.weekNumber - a.weekNumber)
      .slice(0, 4),
    latest = (store.krCheckIns ?? [])
      .filter((c) => c.objectiveId === objectiveId && c.blocker)
      .sort((a, b) => b.weekNumber - a.weekNumber);
  return (
    <Panel
      title="روند هفتگی هدف"
      caption="تصویر ذخیره‌شده هنگام تکمیل مرور؛ مقادیر گذشته از وضعیت امروز بازسازی نمی‌شوند."
    >
      {rows.length ? (
        rows.map((s) => (
          <p key={s.reviewId}>
            <Link href={"/strategy/weekly-review/" + s.reviewId}>
              هفته {n(s.weekNumber)}
            </Link>{" "}
            · نتیجه {n(s.progress)}٪ · اطمینان {n(s.confidence)} ·{" "}
            {objectiveHealthLabels[s.health]} · پوشش {n(s.checkedIn)}/
            {n(s.total)}
          </p>
        ))
      ) : (
        <Empty>هنوز مرور تکمیل‌شده‌ای برای این هدف وجود ندارد.</Empty>
      )}
      {latest.slice(0, 2).map((c) => (
        <p key={c.id}>
          مانع ثبت هفته {n(c.weekNumber)}: {c.blocker}
        </p>
      ))}
    </Panel>
  );
}
export function WeeklyLanding() {
  const { store } = useStrategy(),
    cycle = store.cycles.find((c) => c.status === "active");
  if (!cycle) return null;
  const week = getCycleWeek(cycle, todayTehran()),
    reviews = (store.weeklyReviews ?? [])
      .filter((r) => r.cycleId === cycle.id && r.status === "completed")
      .sort((a, b) => b.weekNumber - a.weekNumber),
    last = reviews[0],
    snap = store.strategyWeeklySnapshots?.find((s) => s.reviewId === last?.id),
    previous = store.strategyWeeklySnapshots?.find(
      (s) => s.reviewId === reviews[1]?.id,
    ),
    krs = activeWeeklyKRs(store, cycle.id),
    completion = week.weekNumber
      ? weeklyCheckInCompletion(krs, store.krCheckIns ?? [], week.weekNumber)
      : null,
    known = krs.filter((k) => k.confidence !== null),
    confidence = known.length
      ? known.reduce((a, k) => a + k.confidence!, 0) / known.length
      : null;
  return (
    <Panel
      title="ریتم هفتگی استراتژی"
      action={<Link href="/strategy/weekly-review">ثبت و مرور هفته</Link>}
    >
      <p>
        {week.weekNumber
          ? `هفته ${n(week.weekNumber)} از ${n(week.totalWeeks)}`
          : week.phase === "before"
            ? "دوره هنوز آغاز نشده"
            : "دوره پایان یافته است"}
      </p>
      <div className="st-metrics">
        <div>
          <span>پوشش ثبت هفته جاری</span>
          <strong>
            {completion
              ? `${n(completion.checkedIn)}/${n(completion.total)}`
              : "—"}
          </strong>
        </div>
        <div>
          <span>به‌روزرسانی‌نشده</span>
          <strong>{completion ? n(completion.stale.length) : "—"}</strong>
        </div>
        <div>
          <span>اطمینان فعلی</span>
          <strong>{n(confidence)}</strong>
        </div>
        <div>
          <span>تغییر اطمینان دو مرور آخر</span>
          <strong>
            {n(
              snap && previous
                ? calculateConfidenceDelta(
                    snap.averageConfidence,
                    previous.averageConfidence,
                  )
                : null,
            )}
          </strong>
        </div>
      </div>
      <p>
        آخرین مرور تکمیل‌شده:{" "}
        {last ? (
          <Link href={"/strategy/weekly-review/" + last.id}>
            هفته {n(last.weekNumber)}
          </Link>
        ) : (
          "هنوز وجود ندارد"
        )}
      </p>
      <p>مانع در آخرین مرور: {snap?.blockers[0]?.text ?? "ثبت نشده"}</p>
      <small>پوشش ثبت، انضباط مرور است؛ عملکرد استراتژی نیست.</small>
    </Panel>
  );
}
