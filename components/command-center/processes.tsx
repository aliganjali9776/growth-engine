import Link from "next/link";
import { Panel } from "@/components/system/ui";
import type { CommandReport } from "@/lib/system/command-center/report";
import { number } from "@/components/measurement/shared";
import { stages, priorities } from "@/lib/system/config";
export function MaturityFunnel({ report: r }: { report: CommandReport }) {
  return (
    <Panel
      title="مسیر بلوغ فرآیندها"
      caption="از همان مراحل پایپ‌لاین؛ مرحله ثبت‌شده به‌تنهایی مدرک آمادگی نیست."
    >
      <div className="command-funnel">
        {r.maturity.rows.map((x, i) => (
          <Link key={x.stage} href={`/system/processes?stage=${x.stage}`}>
            <small>{number(i + 1)}</small>
            <span>{x.label}</span>
            <strong>{number(x.count)}</strong>
            <progress aria-label={x.label} max={100} value={x.percent} />
            <small>{number(x.percent)}٪</small>
          </Link>
        ))}
      </div>
      <p>{r.maturity.insight}</p>
    </Panel>
  );
}
export function ProcessRiskMatrix({ report: r }: { report: CommandReport }) {
  const groups = [
      {
        title: "اولویت بالا · سلامت پایین",
        rows: r.rows.filter(
          (x) =>
            ["critical", "high"].includes(x.process.priorityLevel) &&
            x.health.score !== null &&
            x.health.score < 60,
        ),
      },
      {
        title: "اولویت بالا · سلامت قابل قبول",
        rows: r.rows.filter(
          (x) =>
            ["critical", "high"].includes(x.process.priorityLevel) &&
            x.health.score !== null &&
            x.health.score >= 60,
        ),
      },
      {
        title: "اولویت عادی · سلامت پایین",
        rows: r.rows.filter(
          (x) =>
            !["critical", "high"].includes(x.process.priorityLevel) &&
            x.health.score !== null &&
            x.health.score < 60,
        ),
      },
      {
        title: "اولویت عادی · سلامت قابل قبول",
        rows: r.rows.filter(
          (x) =>
            !["critical", "high"].includes(x.process.priorityLevel) &&
            x.health.score !== null &&
            x.health.score >= 60,
        ),
      },
    ],
    unknown = r.rows.filter((x) => x.health.score === null);
  return (
    <>
      <div className="command-two">
        {groups.map((g) => (
          <div className="command-quadrant" key={g.title}>
            <h3>
              {g.title} · {number(g.rows.length)}
            </h3>
            {g.rows.map((x) => (
              <p key={x.process.id}>
                <Link href={`/system/processes/${x.process.id}/kpis`}>
                  {x.process.name}
                </Link>{" "}
                · {number(x.health.score)}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p>
        سلامت نامشخص، در گروه سلامت پایین قرار نمی‌گیرد:{" "}
        {number(unknown.length)} فرآیند.
      </p>
      <details className="command-nested">
        <summary>فرآیندهای نیازمند داده سلامت</summary>
        {unknown.map((x) => (
          <p key={x.process.id}>
            <Link href={`/system/processes/${x.process.id}/kpis`}>
              {x.process.name}
            </Link>
          </p>
        ))}
      </details>
    </>
  );
}
export function CriticalProcessTable({ report: r }: { report: CommandReport }) {
  const rows = r.rows.filter((x) => x.process.priorityLevel === "critical");
  return (
    <div className="command-table">
      <table>
        <thead>
          <tr>
            {[
              "فرآیند",
              "واحد",
              "اولویت",
              "سلامت",
              "پذیرش",
              "KPI",
              "استقلال",
              "مرحله",
              "مالک",
              "بهبود بحرانی باز",
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.process.id}>
              <td>
                <Link href={`/system/processes/${x.process.id}`}>
                  {x.process.name}
                </Link>
              </td>
              <td>
                {
                  x.e.system.departments.find(
                    (d) => d.id === x.process.departmentId,
                  )?.name
                }
              </td>
              <td>{priorities[x.process.priorityLevel]}</td>
              <td>{number(x.health.score)}</td>
              <td>{number(x.adoption?.score)}</td>
              <td>{number(x.health.kpi.score)}</td>
              <td>{number(x.health.founder.score)}</td>
              <td>{stages[x.process.systemizationStage]}</td>
              <td>
                {x.e.system.roles.find((y) => y.id === x.process.ownerRoleId)
                  ?.title ?? "بدون مالک"}
                {!x.owner && <small>متصدی فعال ندارد</small>}
              </td>
              <td>
                {number(
                  x.health.discipline.open.filter(
                    (a) => a.priority === "critical",
                  ).length,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>فرآیند بحرانی ثبت نشده است.</p>}
    </div>
  );
}
export function DepartmentHealthTable({
  report: r,
}: {
  report: CommandReport;
}) {
  return (
    <>
      <p>
        همان فرمول سلامت سیستم روی فرآیندهای هر واحد، با وزن اولویت اجرا می‌شود؛
        داده ناقص با پوشش آن مشخص است.
      </p>
      <div className="command-table">
        <table>
          <thead>
            <tr>
              {[
                "واحد",
                "سلامت / پوشش داده",
                "وضعیت",
                "بحرانی",
                "وابسته به بنیان‌گذار",
                "بهبود باز",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.departments.map((x) => (
              <tr key={x.department.id}>
                <td>
                  <Link
                    href={`/system/processes?department=${x.department.id}`}
                  >
                    {x.department.name}
                  </Link>
                </td>
                <td>
                  {number(x.health.score)} / پوشش{" "}
                  {number(x.health.completeness)}٪
                </td>
                <td>
                  {x.health.status}
                  {x.health.partial ? " · داده ناقص" : ""}
                </td>
                <td>{number(x.critical)}</td>
                <td>{number(x.founder)}</td>
                <td>{number(x.open)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
