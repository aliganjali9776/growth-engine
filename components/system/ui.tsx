"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { X, Plus, ArrowUpLeft } from "lucide-react";
import Link from "next/link";
import { priorities } from "@/lib/system/config";
import type { PriorityLevel } from "@/lib/system/types";
export function Button({
  children,
  secondary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`sys-button ${secondary ? "secondary" : ""} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function Panel({
  title,
  caption,
  children,
  action,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="sys-panel">
      <header>
        <div>
          <h2>{title}</h2>
          {caption && <p>{caption}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function PageTitle({
  title,
  description,
  onAdd,
  addLabel,
}: {
  title: string;
  description: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="sys-page-title">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {onAdd && (
        <Button onClick={onAdd}>
          <Plus size={16} />
          {addLabel ?? "افزودن"}
        </Button>
      )}
    </div>
  );
}
export function Badge({ level }: { level: PriorityLevel }) {
  return <span className={`sys-badge ${level}`}>{priorities[level]}</span>;
}
export function Empty({
  children = "موردی با این شرایط پیدا نشد.",
}: {
  children?: React.ReactNode;
}) {
  return <p className="sys-empty">{children}</p>;
}
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  returnFocusElement,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
  returnFocusElement?: HTMLElement | null;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sys-overlay" />
        <Dialog.Content
          className="sys-drawer"
          dir="rtl"
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusElement?.isConnected) {
              event.preventDefault();
              returnFocusElement.focus();
              return;
            }
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <header>
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="sys-close" aria-label="بستن پنل">
              <X size={20} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="sys-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Metric({
  value,
  label,
  detail,
  href,
}: {
  value: string;
  label: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>
        {detail}
        {href && <ArrowUpLeft size={14} />}
      </small>
    </>
  );
  return href ? (
    <Link className="sys-metric" href={href}>
      {content}
    </Link>
  ) : (
    <div className="sys-metric">{content}</div>
  );
}
