"use client";
import { useState } from "react";
import Link from "next/link";
import { Users, UserRound, Plus, ArrowUpLeft } from "lucide-react";
import { useSystem } from "@/components/system/provider";
import { PageTitle, Button, Empty } from "@/components/system/ui";
import { RoleEditor, PersonEditor } from "./editors";
import { ownershipCounts, activeProcesses } from "@/lib/system/selectors";
import { faNumber as fa } from "@/lib/system/config";
import type { Role, Person } from "@/lib/system/types";
export function PeoplePage() {
  const { data } = useSystem();
  const [tab, setTab] = useState<"roles" | "people">("roles"),
    [editor, setEditor] = useState<
      | { kind: "roles"; value?: Role }
      | { kind: "people"; value?: Person }
      | null
    >(null);
  return (
    <>
      <PageTitle
        title="افراد و نقش‌ها"
        description="نقش‌ها مالک مسئولیت هستند؛ افراد آن‌ها را اجرا می‌کنند."
        onAdd={() => setEditor({ kind: tab })}
        addLabel={tab === "roles" ? "نقش جدید" : "فرد جدید"}
      />
      <div
        className="sys-segment"
        role="group"
        aria-label="نمای افراد و نقش‌ها"
      >
        <Button
          secondary
          aria-pressed={tab === "roles"}
          onClick={() => setTab("roles")}
        >
          <Users size={16} />
          نقش‌ها ({fa(data.roles.length)})
        </Button>
        <Button
          secondary
          aria-pressed={tab === "people"}
          onClick={() => setTab("people")}
        >
          <UserRound size={16} />
          افراد ({fa(data.people.length)})
        </Button>
      </div>
      {tab === "roles" ? (
        <div className="sys-card-grid">
          {ownershipCounts(data).map(({ role: r, total, critical }) => (
            <article className="sys-entity-card" key={r.id}>
              <div className="sys-card-top">
                <span className="sys-avatar">
                  <Users size={20} />
                </span>
                <span className="sys-tag">
                  {data.departments.find((d) => d.id === r.departmentId)?.name}
                </span>
              </div>
              <h3>{r.title}</h3>
              <p>
                {data.people.find((p) => p.id === r.personId)?.name ??
                  "نقش خالی · نیازمند متصدی"}
              </p>
              <div className="sys-tags">
                {r.isFounderRole && (
                  <span className="sys-badge high">بنیان‌گذار</span>
                )}
                {r.isKeyRole && <span className="sys-tag">نقش کلیدی</span>}
              </div>
              <p className="sys-purpose">
                {r.purpose || "هدف نقش هنوز ثبت نشده است."}
              </p>
              <ul>
                {r.responsibilities.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              <small>
                گزارش‌دهی به:{" "}
                {data.roles.find((x) => x.id === r.reportsToRoleId)?.title ??
                  "بالاترین سطح"}
              </small>
              <Link
                className="sys-ownership"
                href={`/system/processes?owner=${r.id}`}
              >
                {fa(total)} فرآیند · {fa(critical)} بحرانی{" "}
                {total >= 4 ? "· تمرکز بالا" : ""}
                <ArrowUpLeft size={14} />
              </Link>
              <Button
                secondary
                onClick={() => setEditor({ kind: "roles", value: r })}
              >
                ویرایش نقش
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="sys-card-grid">
          {data.people.map((p) => {
            const roles = data.roles.filter((r) => r.personId === p.id),
              owned = activeProcesses(data).filter((x) =>
                roles.some((r) => r.id === x.ownerRoleId),
              );
            return (
              <article key={p.id} className="sys-entity-card">
                <div className="sys-card-top">
                  <span className="sys-avatar">{p.name.slice(0, 1)}</span>
                  <span className="sys-tag">
                    {p.status === "active" ? "فعال" : "بایگانی"}
                  </span>
                </div>
                <h3>{p.name}</h3>
                <p>{p.jobTitle}</p>
                {roles.length ? (
                  roles.map((r) => (
                    <div className="sys-person-role" key={r.id}>
                      <strong>{r.title}</strong>
                      <small>
                        {
                          data.departments.find((d) => d.id === r.departmentId)
                            ?.name
                        }{" "}
                        · مدیر:{" "}
                        {data.roles.find((x) => x.id === r.reportsToRoleId)
                          ?.title ?? "ندارد"}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="sys-hint">هنوز نقشی تخصیص داده نشده است.</p>
                )}
                <p className="sys-ownership">
                  {fa(owned.length)} فرآیند تحت مالکیت{" "}
                  {owned.length >= 4 ? "· نیازمند مرور ظرفیت" : ""}
                </p>
                <Button
                  secondary
                  onClick={() => setEditor({ kind: "people", value: p })}
                >
                  ویرایش فرد
                </Button>
              </article>
            );
          })}
        </div>
      )}
      {!(tab === "roles" ? data.roles : data.people).length && <Empty />}
      {editor?.kind === "roles" && (
        <RoleEditor initial={editor.value} onClose={() => setEditor(null)} />
      )}{" "}
      {editor?.kind === "people" && (
        <PersonEditor initial={editor.value} onClose={() => setEditor(null)} />
      )}
    </>
  );
}
