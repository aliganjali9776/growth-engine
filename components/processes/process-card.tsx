"use client";
import Link from "next/link";
import { useState } from "react";
import type { Process, SystemizationStage } from "@/lib/system/types";
import { ownerOf, effectiveFounder } from "@/lib/system/selectors";
import { changeStage } from "@/lib/system/actions";
import { faNumber as fa, stages, founderLevels } from "@/lib/system/config";
import { useSystem } from "@/components/system/provider";
import { Badge, Button } from "@/components/system/ui";
export function StageControl({ process: p }: { process: Process }) {
  const { data, commit } = useSystem();
  const [stage, setStage] = useState(p.systemizationStage),
    [error, setError] = useState("");
  return (
    <div className="sys-stage-control">
      <select
        aria-label={`مرحله ${p.code}`}
        value={stage}
        onChange={(e) => setStage(e.target.value as SystemizationStage)}
      >
        {Object.entries(stages).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Button
        secondary
        disabled={stage === p.systemizationStage}
        onClick={() => {
          try {
            commit(changeStage(data, p.id, stage));
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        ثبت مرحله
      </Button>
      {stage !== p.systemizationStage &&
        ["standardized", "implemented", "measured", "improving"].includes(
          stage,
        ) && (
          <small>
            این مرحله نیازمند تأیید آمادگی در صفحه مربوط است؛ شاخص و اندازه‌گیری
            برای «اندازه‌گیری»، مرور و اقدام دارای مالک برای «بهبود» لازم‌اند.
          </small>
        )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
export function ProcessCard({
  process: p,
  onEdit,
  stageControl = false,
}: {
  process: Process;
  onEdit: () => void;
  stageControl?: boolean;
}) {
  const { data } = useSystem();
  const { role, person } = ownerOf(data, p);
  return (
    <article className="sys-process-card">
      <div className="sys-card-top">
        <span className="sys-code">{p.code}</span>
        <Badge level={p.priorityLevel} />
      </div>
      <Link href={`/system/processes/${p.id}`}>
        <h3>{p.name}</h3>
      </Link>
      <p>
        {data.departments.find((d) => d.id === p.departmentId)?.name} ·{" "}
        {p.valueChain}
      </p>
      <div className="sys-card-owner">
        <strong>{role?.title ?? "بدون نقش مالک"}</strong>
        <small>{person?.name ?? "بدون فرد مسئول"}</small>
      </div>
      <dl className="sys-mini-details">
        <div>
          <dt>اولویت</dt>
          <dd>{fa(p.priorityScore)} / ۱۲</dd>
        </div>
        <div>
          <dt>بنیان‌گذار</dt>
          <dd>{founderLevels[effectiveFounder(data, p)]}</dd>
        </div>
        <div>
          <dt>مرحله</dt>
          <dd>{stages[p.systemizationStage]}</dd>
        </div>
        <div>
          <dt>وضعیت</dt>
          <dd>{p.status === "active" ? "فعال" : "بایگانی"}</dd>
        </div>
      </dl>
      <small>
        اثر {fa(p.impact)} · تنوع {fa(p.variation)} · وابستگی {fa(p.dependency)}{" "}
        · تکرار {fa(p.frequency)}
      </small>
      {stageControl && <StageControl key={p.systemizationStage} process={p} />}
      <div className="sys-card-actions">
        <Link href={`/system/processes/${p.id}`}>جزئیات فرآیند</Link>
        <button onClick={onEdit}>ویرایش</button>
      </div>
    </article>
  );
}
