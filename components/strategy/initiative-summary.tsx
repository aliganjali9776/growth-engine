"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel, Empty } from "@/components/system/ui";
import { useStrategy } from "./provider";
import { todayTehran, roleName } from "@/lib/strategy/model";
import {
  initiativeStatuses,
  effectivenessLabels,
} from "@/lib/strategy/initiatives/types";
import {
  portfolioSummary,
  initiativeNeedsAttention,
  objectiveExecution,
  isInitiativeActive,
  ownerInitiativeLoad,
} from "@/lib/strategy/initiatives/report";
export const initiativeNumber = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
export function InitiativeAttention({
  cycleId,
  objectiveId,
}: {
  cycleId?: string;
  objectiveId?: string;
}) {
  const { store, roles } = useStrategy(),
    [all, setAll] = useState(false);
  const id = cycleId ?? store.cycles.find((c) => c.status === "active")?.id,
    items = (store.initiatives ?? []).filter(
      (i) =>
        i.cycleId === id && (!objectiveId || i.objectiveId === objectiveId),
    ),
    findings = initiativeNeedsAttention(items, store, roles, todayTehran());
  return (
    <Panel
      title="نیازمند توجه · اقدامات"
      caption="ریسک اجرا، ظرفیت و اثربخشی؛ موارد مهم‌تر در ابتدا"
    >
      {findings.length ? (
        <>
          <ul className="st-findings">
            {findings.slice(0, all ? undefined : 5).map((f) => (
              <li key={f.id}>
                <Link href={f.href}>{f.text}</Link>
              </li>
            ))}
          </ul>
          {findings.length > 5 && (
            <Button secondary onClick={() => setAll(!all)}>
              {all
                ? "نمایش کمتر"
                : `نمایش همه ${initiativeNumber(findings.length)} مورد`}
            </Button>
          )}
        </>
      ) : (
        <Empty>
          در اقدامات این نما هشدار ثبت نشده است؛ این به معنی تضمین اثربخشی نیست.
        </Empty>
      )}
    </Panel>
  );
}
export function InitiativeSummary({
  cycleId,
  objectiveId,
}: {
  cycleId?: string;
  objectiveId?: string;
}) {
  const { store, roles } = useStrategy(),
    id = cycleId ?? store.cycles.find((c) => c.status === "active")?.id,
    items = (store.initiatives ?? []).filter(
      (i) =>
        i.cycleId === id && (!objectiveId || i.objectiveId === objectiveId),
    ),
    s = portfolioSummary(items, todayTehran()),
    comparison = objectiveId
      ? objectiveExecution(store, objectiveId, todayTehran())
      : null;
  return (
    <>
      <Panel
        title={objectiveId ? "اجرا در کنار نتیجه" : "اجرای اقدامات استراتژیک"}
        caption="پیشرفت اجرا از نتیجه جداست؛ درصد اجرا وارد فرمول پیشرفت KR یا هدف نمی‌شود."
        action={
          <Link
            href={`/strategy/initiatives?cycle=${id ?? ""}${objectiveId ? "&objective=" + objectiveId : ""}`}
          >
            سبد اقدامات
          </Link>
        }
      >
        <div className="st-metrics">
          {[
            ["فعال هم‌زمان", s.active],
            ["متوقف‌شده", s.blocked],
            ["عقب‌افتاده", s.overdue],
            ["تکمیل‌شده بدون ارزیابی", s.needsEvaluation],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{initiativeNumber(value as number)}</strong>
            </div>
          ))}
        </div>
        <div className="in-execution-result">
          <div>
            <span>پیشرفت اجرا</span>
            <strong>
              {initiativeNumber(s.execution)}
              {s.execution === null ? "" : "٪"}
            </strong>
          </div>
          {comparison && (
            <>
              <div>
                <span>پیشرفت نتیجه</span>
                <strong>
                  {initiativeNumber(comparison.result)}
                  {comparison.result === null ? "" : "٪"}
                </strong>
              </div>
              <div>
                <span>شکاف اجرا و نتیجه</span>
                <strong>
                  {initiativeNumber(comparison.gap)} <small>واحد درصد</small>
                </strong>
              </div>
            </>
          )}
        </div>
        <small>
          میانگین برابر اقدامات در حال اجرا، متوقف و تکمیل‌شده؛ پیشنهادها،
          برنامه‌ریزی‌شده‌ها و لغوشده‌ها کنار گذاشته می‌شوند.
        </small>
        {comparison && (
          <p className={comparison.needsReview ? "st-notice" : "st-muted"}>
            {comparison.text}
          </p>
        )}
        {!items.length && (
          <Empty>هنوز برای نتایج کلیدی این دوره اقدامی تعریف نشده است.</Empty>
        )}
        <details>
          <summary>اقدامات و بار نقش‌ها</summary>
          <ul>
            {items.map((i) => (
              <li key={i.id}>
                <Link href={"/strategy/initiatives/" + i.id}>
                  {i.code} · {i.title}
                </Link>{" "}
                · {initiativeStatuses[i.status]} ·{" "}
                {effectivenessLabels[i.effectiveness]}
              </li>
            ))}
          </ul>
          {ownerInitiativeLoad(items).map((o) => (
            <p key={o.ownerRoleId}>
              {roleName(o.ownerRoleId, roles)}: {initiativeNumber(o.count)}{" "}
              اقدام فعال {o.overloaded ? "· تمرکز اجرا بالاست" : ""}
            </p>
          ))}
        </details>
      </Panel>
      <InitiativeAttention cycleId={id} objectiveId={objectiveId} />
    </>
  );
}
export function KRInitiativeLinks({ keyResultId }: { keyResultId: string }) {
  const { store } = useStrategy(),
    items = (store.initiatives ?? []).filter(
      (i) => i.keyResultId === keyResultId && i.status !== "cancelled",
    ),
    kr = store.keyResults?.find((k) => k.id === keyResultId);
  if (!kr) return null;
  return (
    <details className="in-kr-links">
      <summary>
        اقدامات مرتبط: {initiativeNumber(items.length)} · فعال{" "}
        {initiativeNumber(items.filter(isInitiativeActive).length)}
      </summary>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <Link href={"/strategy/initiatives/" + i.id}>{i.title}</Link> ·{" "}
            {initiativeStatuses[i.status]}
          </li>
        ))}
      </ul>
      <Link
        href={`/strategy/initiatives?cycle=${kr.cycleId}&objective=${kr.objectiveId}&kr=${kr.id}`}
      >
        مشاهده یا تعریف اقدام برای این نتیجه
      </Link>
    </details>
  );
}
