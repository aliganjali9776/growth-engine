"use client";
import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Crown, Building2, UserRound } from "lucide-react";
import { useSystem } from "@/components/system/provider";
import { organizationNodes, activeProcesses } from "@/lib/system/selectors";
import { Button, Drawer } from "@/components/system/ui";
import { faNumber as fa } from "@/lib/system/config";
type ChartNode = Node<
  {
    title: string;
    person: string;
    department: string;
    founder: boolean;
    vacant: boolean;
    kind: string;
  },
  "organization"
>;
function OrgNode({ data }: NodeProps<ChartNode>) {
  return (
    <div
      className={`sys-org-node ${data.founder ? "founder" : ""} ${data.kind}`}
      dir="rtl"
    >
      <Handle type="target" position={Position.Top} />
      <div>
        {data.founder ? (
          <Crown size={18} />
        ) : data.kind === "department" ? (
          <Building2 size={17} />
        ) : (
          <UserRound size={17} />
        )}
        <strong>{data.title}</strong>
      </div>
      <p className={data.vacant ? "vacant" : ""}>{data.person}</p>
      <small>{data.department}</small>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { organization: OrgNode };
export function OrgChart({
  onEdit,
}: {
  onEdit: (kind: "role" | "department", id: string) => void;
}) {
  const { data } = useSystem();
  const [kind, setKind] = useState<"role" | "department">("role"),
    [selected, setSelected] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => {
    const layout = organizationNodes(data).filter((n) => n.kind === kind);
    const nodes: ChartNode[] = layout.map((n) => {
      const role = data.roles.find((r) => r.id === n.entityId),
        dep = data.departments.find(
          (d) =>
            d.id === (kind === "department" ? n.entityId : role?.departmentId),
        ),
        person = data.people.find((p) => p.id === role?.personId);
      return {
        id: n.id,
        type: "organization",
        position: { x: n.x, y: n.y },
        data: {
          title: kind === "role" ? role!.title : dep!.name,
          person:
            kind === "role"
              ? person
                ? `${person.name}${person.status === "archived" ? " (غیرفعال)" : ""}`
                : "نقش خالی"
              : (data.roles.find((r) => r.id === dep?.managerRoleId)?.title ??
                "مدیر تعیین نشده"),
          department: kind === "role" ? (dep?.name ?? "") : "واحد سازمانی",
          founder: kind === "role" && !!role?.isFounderRole,
          vacant: kind === "role" && !person,
          kind,
        },
        ariaLabel: kind === "role" ? role!.title : dep!.name,
      };
    });
    const edges: Edge[] = layout
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `e-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: "smoothstep",
        style: { stroke: "#b7a577", strokeWidth: 1.5 },
      }));
    return { nodes, edges };
  }, [data, kind]);
  const role = data.roles.find((r) => `role-${r.id}` === selected),
    dep = data.departments.find((d) => `department-${d.id}` === selected);
  return (
    <>
      <div className="sys-chart-toolbar">
        <div className="sys-segment">
          <Button
            secondary
            aria-pressed={kind === "role"}
            onClick={() => setKind("role")}
          >
            سلسله‌مراتب نقش‌ها
          </Button>
          <Button
            secondary
            aria-pressed={kind === "department"}
            onClick={() => setKind("department")}
          >
            ساختار واحدها
          </Button>
        </div>
        <small>
          برای جزئیات، یک گره را انتخاب کنید. جابه‌جایی صفحه و بزرگ‌نمایی فعال
          است.
        </small>
      </div>
      <div className="sys-chart" dir="ltr">
        <ReactFlow
          key={kind}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, n) => setSelected(n.id)}
        >
          <Background color="#d7ddd9" gap={22} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={role?.title ?? dep?.name ?? "جزئیات ساختار"}
        description={
          role
            ? "جایگاه، متصدی و مالکیت فرآیندها"
            : "جایگاه واحد در ساختار سازمانی"
        }
      >
        <div className="sys-form">
          {role ? (
            <>
              <p>{role.purpose || "هدف نقش ثبت نشده است."}</p>
              <dl className="sys-details">
                <div>
                  <dt>فرد مسئول</dt>
                  <dd>
                    {data.people.find((p) => p.id === role.personId)?.name ??
                      "نقش خالی"}
                  </dd>
                </div>
                <div>
                  <dt>گزارش‌دهی به</dt>
                  <dd>
                    {data.roles.find((r) => r.id === role.reportsToRoleId)
                      ?.title ?? "بالاترین سطح"}
                  </dd>
                </div>
                <div>
                  <dt>فرآیندهای تحت مالکیت</dt>
                  <dd>
                    {fa(
                      activeProcesses(data).filter(
                        (p) => p.ownerRoleId === role.id,
                      ).length,
                    )}
                  </dd>
                </div>
              </dl>
              <ul>
                {role.responsibilities.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{dep?.description}</p>
          )}
          <Button
            onClick={() => {
              const id = role?.id ?? dep?.id;
              if (id) onEdit(role ? "role" : "department", id);
              setSelected(null);
            }}
          >
            ویرایش اطلاعات
          </Button>
        </div>
      </Drawer>
    </>
  );
}
