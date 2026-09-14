"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Building2 } from "lucide-react";
import { useSystem } from "@/components/system/provider";
import { PageTitle, Panel, Button } from "@/components/system/ui";
import { DepartmentEditor, RoleEditor } from "./editors";
import type { Department, Role } from "@/lib/system/types";
const OrgChart = dynamic(() => import("./org-chart").then((m) => m.OrgChart), {
  ssr: false,
  loading: () => <p className="sys-empty">در حال آماده‌سازی چارت…</p>,
});
export function OrganizationPage() {
  const { data } = useSystem();
  const [editor, setEditor] = useState<
    | { kind: "department"; value?: Department }
    | { kind: "role"; value?: Role }
    | null
  >(null);
  return (
    <>
      <PageTitle
        title="ساختار سازمانی"
        description="مسیر گزارش‌دهی، واحدها و نقش‌های خالی را یکجا ببینید."
        onAdd={() => setEditor({ kind: "department" })}
        addLabel="واحد جدید"
      />
      <Panel
        title="چارت سازمانی"
        caption="برای تغییر ساختار، اطلاعات نقش یا واحد را ویرایش کنید."
      >
        {!data.departments.length && !data.roles.length ? (
          <p className="sys-empty">
            ساختار سازمانی هنوز ثبت نشده است. از «واحد جدید» شروع کنید، سپس
            نقش‌ها و افراد مسئول را مشخص کنید.
          </p>
        ) : (
          <OrgChart
            onEdit={(kind, id) =>
              kind === "role"
                ? setEditor({
                    kind,
                    value: data.roles.find((r) => r.id === id),
                  })
                : setEditor({
                    kind,
                    value: data.departments.find((d) => d.id === id),
                  })
            }
          />
        )}
      </Panel>
      <PageTitle
        title="واحدهای سازمانی"
        description="بایگانی واحد، ارتباط‌های قبلی آن را حفظ می‌کند."
      />
      <div className="sys-card-grid">
        {data.departments.map((d) => (
          <article className="sys-entity-card" key={d.id}>
            <div className="sys-card-top">
              <Building2 size={23} />
              <span className="sys-tag">
                {d.status === "active" ? "فعال" : "بایگانی"}
              </span>
            </div>
            <h3>{d.name}</h3>
            <p className="sys-purpose">{d.description}</p>
            <small>
              واحد مادر:{" "}
              {data.departments.find((x) => x.id === d.parentDepartmentId)
                ?.name ?? "ندارد"}
            </small>
            <small>
              مدیر:{" "}
              {data.roles.find((r) => r.id === d.managerRoleId)?.title ??
                "تعیین نشده"}
            </small>
            <Button
              secondary
              onClick={() => setEditor({ kind: "department", value: d })}
            >
              ویرایش واحد
            </Button>
          </article>
        ))}
      </div>
      {editor?.kind === "department" && (
        <DepartmentEditor
          initial={editor.value}
          onClose={() => setEditor(null)}
        />
      )}{" "}
      {editor?.kind === "role" && (
        <RoleEditor initial={editor.value} onClose={() => setEditor(null)} />
      )}
    </>
  );
}
