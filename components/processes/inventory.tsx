"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Table2, LayoutGrid, Columns3, Search } from "lucide-react";
import { useSystem } from "@/components/system/provider";
import { PageTitle, Button, Field, Badge, Empty } from "@/components/system/ui";
import {
  selectProcesses,
  emptyFilters,
  ownerOf,
  effectiveFounder,
  type InventoryFilters,
} from "@/lib/system/selectors";
import {
  priorities,
  stages,
  stageKeys,
  founderLevels,
  faNumber as fa,
} from "@/lib/system/config";
import type { Process } from "@/lib/system/types";
import { ProcessEditor } from "./editor";
import { ProcessCard } from "./process-card";
export function ProcessInventory({ pipeline = false }: { pipeline?: boolean }) {
  const params = useSearchParams();
  return (
    <Inventory
      key={`${pipeline}-${params.toString()}`}
      pipeline={pipeline}
      initial={{
        ...emptyFilters,
        priority: params.get("priority") ?? "",
        department: params.get("department") ?? "",
        owner: params.get("owner") ?? "",
        stage: params.get("stage") ?? "",
        sort: params.get("sort") ?? "priority",
        bottleneck: params.get("bottleneck") === "true",
      }}
    />
  );
}
function Inventory({
  initial,
  pipeline,
}: {
  initial: InventoryFilters;
  pipeline: boolean;
}) {
  const { data } = useSystem();
  const [filters, setFilters] = useState(initial),
    [view, setView] = useState(pipeline ? "pipeline" : "table"),
    [editor, setEditor] = useState<Process | null | undefined>(undefined);
  const rows = selectProcesses(data, filters);
  const filter = (key: keyof InventoryFilters, value: string | boolean) =>
    setFilters({ ...filters, [key]: value });
  return (
    <>
      <PageTitle
        title={pipeline ? "پایپ‌لاین سیستم‌سازی" : "فهرست فرآیندها"}
        description={
          pipeline
            ? "هر فرآیند در یک مسیر هشت‌مرحله‌ای؛ تغییر مرحله با ثبت صریح انجام می‌شود."
            : "فرآیندهای تکرارشونده را شناسایی و برای سیستم‌سازی اولویت‌بندی کنید."
        }
        onAdd={() => setEditor(null)}
        addLabel="فرآیند جدید"
      />
      <div className="sys-filters">
        <Field label="جست‌وجوی فرآیند">
          <div className="sys-search">
            <Search size={16} />
            <input
              placeholder="نام یا کد فرآیند…"
              value={filters.search}
              onChange={(e) => filter("search", e.target.value)}
            />
          </div>
        </Field>
        <Field label="اولویت">
          <select
            value={filters.priority}
            onChange={(e) => filter("priority", e.target.value)}
          >
            <option value="">همه اولویت‌ها</option>
            {Object.entries(priorities).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="واحد">
          <select
            value={filters.department}
            onChange={(e) => filter("department", e.target.value)}
          >
            <option value="">همه واحدها</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="مالک">
          <select
            value={filters.owner}
            onChange={(e) => filter("owner", e.target.value)}
          >
            <option value="">همه مالکان</option>
            <option value="__missing">بدون نقش مالک</option>
            {data.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="مرحله">
          <select
            value={filters.stage}
            onChange={(e) => filter("stage", e.target.value)}
          >
            <option value="">همه مراحل</option>
            {Object.entries(stages).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وابستگی بنیان‌گذار">
          <select
            value={filters.founder}
            onChange={(e) => filter("founder", e.target.value)}
          >
            <option value="">همه سطوح</option>
            {Object.entries(founderLevels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وضعیت">
          <select
            value={filters.status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="active">فعال</option>
            <option value="archived">بایگانی</option>
            <option value="">همه</option>
          </select>
        </Field>
        <Field label="مرتب‌سازی">
          <select
            value={filters.sort}
            onChange={(e) => filter("sort", e.target.value)}
          >
            <option value="priority">اولویت؛ بیشترین امتیاز</option>
            <option value="department">واحد سازمانی</option>
            <option value="owner">مالک</option>
            <option value="stage">مرحله سیستم‌سازی</option>
            <option value="founder">وابستگی بنیان‌گذار</option>
          </select>
        </Field>
      </div>
      <div className="sys-inventory-toolbar">
        <span>
          {fa(rows.length)} فرآیند{" "}
          {filters.bottleneck && "· بحرانی و وابسته به بنیان‌گذار"}
        </span>
        <Button secondary onClick={() => setFilters({ ...emptyFilters })}>
          پاک کردن فیلترها
        </Button>
        <div className="sys-segment" aria-label="نمای فهرست">
          <Button
            secondary
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <Table2 size={15} />
            جدول
          </Button>
          <Button
            secondary
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid size={15} />
            کارت‌ها
          </Button>
          <Button
            secondary
            aria-pressed={view === "pipeline"}
            onClick={() => setView("pipeline")}
          >
            <Columns3 size={15} />
            پایپ‌لاین
          </Button>
        </div>
      </div>
      {view === "pipeline" ? (
        <>
          <p className="sys-hint">
            تعداد هر ستون، فرآیندهای مطابق فیلترهای فعلی است. مرحله به‌صورت دستی
            ثبت می‌شود.
          </p>
          <div
            className="sys-pipeline"
            tabIndex={0}
            aria-label="مراحل پایپ‌لاین؛ قابل پیمایش افقی"
          >
            {stageKeys.map((stage, i) => (
              <section className="sys-pipeline-column" key={stage}>
                <header>
                  <span>0{i + 1}</span>
                  <h3>{stages[stage]}</h3>
                  <b>
                    {fa(
                      rows.filter((p) => p.systemizationStage === stage).length,
                    )}
                  </b>
                </header>
                {rows
                  .filter((p) => p.systemizationStage === stage)
                  .map((p) => (
                    <ProcessCard
                      key={p.id}
                      process={p}
                      onEdit={() => setEditor(p)}
                      stageControl
                    />
                  ))}
                {!rows.some((p) => p.systemizationStage === stage) && (
                  <Empty>فرآیندی در این مرحله نیست.</Empty>
                )}
              </section>
            ))}
          </div>
        </>
      ) : (
        <>
          {view === "table" && (
            <div
              className="sys-table-wrap"
              tabIndex={0}
              aria-label="جدول فرآیندها؛ قابل پیمایش افقی"
            >
              <table className="sys-table">
                <thead>
                  <tr>
                    {[
                      "کد",
                      "نام فرآیند",
                      "زنجیره ارزش",
                      "واحد",
                      "نقش مالک",
                      "فرد مسئول",
                      "تکرار",
                      "اثر",
                      "تنوع",
                      "وابستگی",
                      "امتیاز",
                      "اولویت",
                      "بنیان‌گذار",
                      "مرحله",
                      "وضعیت",
                      "",
                    ].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const { role, person } = ownerOf(data, p);
                    return (
                      <tr key={p.id}>
                        <td dir="ltr">{p.code}</td>
                        <td>
                          <Link href={`/system/processes/${p.id}`}>
                            {p.name}
                          </Link>
                        </td>
                        <td>{p.valueChain}</td>
                        <td>
                          {
                            data.departments.find(
                              (d) => d.id === p.departmentId,
                            )?.name
                          }
                        </td>
                        <td>{role?.title ?? "بدون مالک"}</td>
                        <td>{person?.name ?? "نقش خالی"}</td>
                        {[
                          p.frequency,
                          p.impact,
                          p.variation,
                          p.dependency,
                          p.priorityScore,
                        ].map((n, i) => (
                          <td key={i}>{fa(n)}</td>
                        ))}
                        <td>
                          <Badge level={p.priorityLevel} />
                        </td>
                        <td>{founderLevels[effectiveFounder(data, p)]}</td>
                        <td>{stages[p.systemizationStage]}</td>
                        <td>{p.status === "active" ? "فعال" : "بایگانی"}</td>
                        <td>
                          <Button secondary onClick={() => setEditor(p)}>
                            ویرایش
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div
            className={`sys-card-grid ${view === "table" ? "sys-mobile-cards" : ""}`}
          >
            {rows.map((p) => (
              <ProcessCard key={p.id} process={p} onEdit={() => setEditor(p)} />
            ))}
          </div>
          {!rows.length && <Empty />}
        </>
      )}
      {editor !== undefined && (
        <ProcessEditor
          initial={editor ?? undefined}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
