"use client";
import { useState } from "react";
import { Panel, Button } from "@/components/system/ui";
import { ProcessNav } from "@/components/process-analysis/shared";
import { useMeasurement } from "./provider";
import "./measurement.css";
export const number = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "داده کافی نیست"
    : n.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
export function Workspace({
  id,
  title,
  eyebrow,
  children,
}: {
  id?: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const c = useMeasurement();
  return (
    <div className="measurement-workspace">
      {id && <ProcessNav id={id} />}
      <header className="measurement-heading">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>داده‌های محلی · ثبت و تصمیم‌گیری توسط تیم</p>
        <small role="status">{c.status}</small>
      </header>
      {c.error && (
        <p className="sys-alert" role="alert">
          {c.error}
        </p>
      )}
      {c.store ? children : <p>{c.error || "در حال بازیابی…"}</p>}
    </div>
  );
}
export function ScoreCard({
  title,
  score,
  label,
  parts,
  children,
}: {
  title: string;
  score: number | null;
  label: string;
  parts?: { label: string; weight: number; value: number | null }[];
  children?: React.ReactNode;
}) {
  return (
    <Panel title={title}>
      <div className="measurement-score">
        <strong>
          {number(score)}
          <small>/ ۱۰۰</small>
        </strong>
        <span>{label}</span>
      </div>
      {parts && (
        <div className="measurement-parts">
          {parts.map((p) => (
            <div key={p.label}>
              <span>
                {p.label} · وزن {number(p.weight)}٪
              </span>
              <b>
                {p.value === null ? "داده ناکافی" : number(p.value * p.weight)}
              </b>
              {p.value !== null && <progress
                aria-label={p.label}
                max={100}
                value={(p.value ?? 0) * 100}
              />}
            </div>
          ))}
        </div>
      )}
      {children}
    </Panel>
  );
}
export function ConfirmButton({
  label,
  onConfirm,
  disabled = false,
  description = "این اقدام با تأیید شما در همین مرورگر ثبت می‌شود.",
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  description?: string;
}) {
  const [open, set] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="measurement-confirm">
      <Button secondary disabled={disabled} onClick={() => set(true)}>
        {label}
      </Button>
      {open && (
        <div className="sys-alert">
          <p>{description}</p>
          <Button
            onClick={() => {
              try {
                onConfirm();
                set(false);
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "ثبت نشد.");
              }
            }}
          >
            تأیید و ثبت
          </Button>
          <Button secondary onClick={() => set(false)}>
            انصراف
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function StageConfirmation({
  id,
  kind,
  issues,
  current,
  allowed,
}: {
  id: string;
  kind: "measured" | "improving";
  issues: string[];
  current: boolean;
  allowed: boolean;
}) {
  const c = useMeasurement();
  return (
    <Panel
      title={
        kind === "measured" ? "تأیید مرحله اندازه‌گیری" : "ورود به چرخه بهبود"
      }
    >
      <ul>
        {issues.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p>
        {current
          ? "تأیید معتبر ثبت شده است"
          : issues.length
            ? "پیش‌نیازها را تکمیل کنید"
            : allowed
              ? "آماده تأیید"
              : "ابتدا مرحله قبلی را تأیید کنید."}
      </p>
      <ConfirmButton
        label={
          kind === "measured"
            ? "تأیید مرحله اندازه‌گیری"
            : "تأیید ورود به چرخه بهبود"
        }
        disabled={current || !allowed || !!issues.length}
        onConfirm={() => c.confirm(id, kind)}
      />
    </Panel>
  );
}
