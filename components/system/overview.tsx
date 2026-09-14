"use client";
import Link from "next/link";
import { ArrowLeft, GitBranch, ShieldAlert } from "lucide-react";
import { useSystem } from "./provider";
import { StandardsOverview } from "@/components/process-standards/summary";
import { MeasurementOverview } from "@/components/measurement/summary";
import { Panel, Metric, Badge, Empty } from "./ui";
import {
  systemMetrics,
  founderBottlenecks,
  missingOwners,
  ownershipCounts,
  departmentRiskCounts,
  ownerOf,
} from "@/lib/system/selectors";
import { faNumber as fa, stages } from "@/lib/system/config";
import { useStandards } from "@/components/process-standards/provider";
import { effectiveSOPStatus } from "@/lib/system/standards/logic";
export function SystemOverview() {
  const { data } = useSystem();
  const standards = useStandards(),
    documented = data.processes
      .filter((p) => p.status === "active")
      .filter((p) => {
        const r = standards.store?.records.find((r) => r.processId === p.id),
          source = standards.source(p.id);
        return r && source && effectiveSOPStatus(r, source) === "approved";
      }).length;
  const m = systemMetrics(data),
    founder = founderBottlenecks(data),
    missing = missingOwners(data);
  return (
    <>
      <Link className="sys-button" href="/system/command-center">
        باز کردن مرکز فرمان
      </Link>
      <div className="sys-hero">
        <div>
          <span className="eyebrow">SYSTEM AT A GLANCE</span>
          <h2>
            از وابستگی به افراد،
            <br />
            به قابلیت اتکای سیستم.
          </h2>
          <p>
            اولویت‌ها را روشن کنید، مالکیت را مشخص کنید و هر فرآیند را یک مرحله
            جلو ببرید.
          </p>
          <Link className="sys-text-link" href="/system/processes">
            مرور فهرست فرآیندها <ArrowLeft size={17} />
          </Link>
        </div>
        <div className="sys-hero-stat">
          <GitBranch size={34} />
          <strong>{fa(m.total)}</strong>
          <span>فرآیند در مسیر سیستم‌سازی</span>
          <small>بر مبنای فرآیندهای فعال همین فضای محلی</small>
        </div>
      </div>
      <div className="sys-metrics">
        <Metric
          label="فرآیندهای بحرانی"
          value={fa(m.critical)}
          detail="امتیاز اولویت ۱۰ تا ۱۲"
          href="/system/processes?priority=critical"
        />
        <Metric
          label="وابسته به مدیر"
          value={fa(m.founder)}
          detail="وابستگی زیاد یا بحرانی"
          href="/system/processes?sort=founder"
        />
        <Metric
          label="پوشش مالک فرآیند"
          value={`${fa(m.ownerCoverage)}٪`}
          detail="نقش دارای فرد مسئول فعال"
        />
        <Metric
          label="دستورالعمل معتبر"
          value={`${fa(documented)} از ${fa(m.total)}`}
          detail="تأیید معتبر دستورالعمل نسخه جاری"
        />
      </div>
      <div className="sys-two">
        <MeasurementOverview />
        <StandardsOverview />
        <Panel
          title="اولویت‌های فعلی سیستم‌سازی"
          caption="مرتب‌شده با مجموع اثر، تنوع، وابستگی و تکرار"
        >
          {m.priorities.length ? (
            m.priorities.map((p, i) => (
              <Link
                className="sys-priority-row"
                key={p.id}
                href={`/system/processes/${p.id}`}
              >
                <span className="sys-index">{fa(i + 1).padStart(2, "۰")}</span>
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.code} ·{" "}
                    {ownerOf(data, p).role?.title ?? "مالک تعیین نشده"}
                  </p>
                </div>
                <Badge level={p.priorityLevel} />
              </Link>
            ))
          ) : (
            <Empty />
          )}
        </Panel>
        <Link className="sys-founder" href="/system/processes?bottleneck=true">
          <ShieldAlert size={27} />
          <span>وابستگی به بنیان‌گذار</span>
          <strong>{fa(founder.length)} فرآیند بحرانی</strong>
          <p>
            هنوز به تصمیم یا حضور بنیان‌گذار وابسته‌اند. مالکیت نقش بنیان‌گذار
            نیز در این شاخص محاسبه می‌شود.
          </p>
          <b>
            بررسی فرآیندهای وابسته <ArrowLeft size={16} />
          </b>
        </Link>
      </div>
      <Panel
        title="مراحل سیستم‌سازی"
        caption="مرحله‌ها در این نسخه به‌صورت دستی ثبت می‌شوند؛ تکمیل واقعی ابزارهای هر مرحله هنوز سنجیده نمی‌شود."
      >
        <div className="sys-stage-distribution">
          {m.stages.map((s, i) => (
            <Link key={s.stage} href={`/system/processes?stage=${s.stage}`}>
              <span>0{i + 1}</span>
              <strong>{fa(s.count)}</strong>
              <p>{stages[s.stage]}</p>
              <div>
                <i
                  style={{
                    width: `${m.total ? (s.count / m.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </Link>
          ))}
        </div>
      </Panel>
      <div className="sys-two">
        <Panel
          title="تمرکز مالکیت فرآیندها"
          caption="۴ فرآیند یا بیشتر: نیازمند مرور ظرفیت؛ این شاخص اندازه‌گیری بار کاری نیست."
        >
          {ownershipCounts(data).map((x) => (
            <Link
              key={x.role.id}
              className="sys-insight-row"
              href={`/system/processes?owner=${x.role.id}`}
            >
              <div>
                <h3>{x.role.title}</h3>
                <p>
                  {fa(x.critical)} فرآیند بحرانی{" "}
                  {x.total >= 4 ? "· تمرکز مالکیت بالا" : ""}
                </p>
              </div>
              <strong>{fa(x.total)}</strong>
            </Link>
          ))}
        </Panel>
        <Panel
          title="واحدهای دارای بیشترین ریسک"
          caption="بر اساس تعداد فرآیندهای بحرانی فعال"
        >
          {departmentRiskCounts(data).map((x) => (
            <Link
              key={x.department.id}
              className="sys-insight-row"
              href={`/system/processes?department=${x.department.id}&priority=critical`}
            >
              <div>
                <h3>{x.department.name}</h3>
                <p>{fa(x.total)} فرآیند فعال</p>
              </div>
              <span className={`sys-badge ${x.critical ? "critical" : "low"}`}>
                {fa(x.critical)} بحرانی
              </span>
            </Link>
          ))}
          <Link
            className="sys-missing"
            href="/system/processes?owner=__missing"
          >
            {fa(missing.length)} فرآیند بدون نقش مالک <ArrowLeft size={15} />
          </Link>
        </Panel>
      </div>
    </>
  );
}
