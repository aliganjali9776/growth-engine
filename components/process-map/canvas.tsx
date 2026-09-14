"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Crown,
  Diamond,
  ArrowLeftRight,
  Play,
  Square,
  Clock3,
} from "lucide-react";
import { useSystem } from "@/components/system/provider";
import {
  stepOwner,
  founderStep,
  isHandoff,
  formatMinutes,
} from "@/lib/system/maps/logic";
import {
  stepTypes,
  type ProcessMap,
  type ProcessStep,
} from "@/lib/system/maps/model";
type MapNode = Node<
  {
    step: ProcessStep;
    owner: string;
    person: string;
    founder: boolean;
    direction: "RL" | "TB";
  },
  "process"
>;
function ProcessNode({ id, data, selected }: NodeProps<MapNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.direction, updateNodeInternals]);
  const s = data.step,
    Icon =
      s.type === "start"
        ? Play
        : s.type === "end"
          ? Square
          : s.type === "decision"
            ? Diamond
            : s.type === "handoff"
              ? ArrowLeftRight
              : Clock3;
  return (
    <div
      className={`process-node type-${s.type} ${selected ? "selected" : ""} ${data.founder ? "founder" : ""}`}
      dir="rtl"
    >
      <Handle
        id="in"
        type="target"
        position={data.direction === "RL" ? Position.Right : Position.Top}
      />
      <div className="process-node-type">
        <Icon size={15} />
        <span>{stepTypes[s.type]}</span>
        {data.founder && <Crown size={16} aria-label="وابسته به بنیان‌گذار" />}
      </div>
      <strong>{s.title}</strong>
      <p>{data.owner}</p>
      <small>{data.person}</small>
      <div className="process-node-times">
        <span>
          کار{" "}
          <b>
            {s.workTimeMinutes === null
              ? "—"
              : formatMinutes(s.workTimeMinutes)}
          </b>
        </span>
        <span className={(s.waitTimeMinutes ?? 0) > 0 ? "waiting" : ""}>
          انتظار{" "}
          <b>
            {s.waitTimeMinutes === null
              ? "—"
              : formatMinutes(s.waitTimeMinutes)}
          </b>
        </span>
      </div>
      <Handle
        id="out"
        type="source"
        position={data.direction === "RL" ? Position.Left : Position.Bottom}
      />
    </div>
  );
}
const nodeTypes = { process: ProcessNode };
export function ProcessCanvas({
  map,
  layoutVersion,
  onStep,
  onEdge,
  onConnect,
  onMove,
}: {
  map: ProcessMap;
  layoutVersion: number;
  onStep: (id: string) => void;
  onEdge: (id: string) => void;
  onConnect: (c: Connection) => void;
  onMove: (id: string, x: number, y: number) => boolean;
}) {
  const { data } = useSystem();
  const mapped = useMemo(
    () =>
      map.steps.map((s): MapNode => {
        const { role, person } = stepOwner(data, s);
        return {
          id: s.id,
          type: "process",
          position: { x: s.positionX, y: s.positionY },
          ariaLabel: `مرحله ${s.title}`,
          data: {
            step: s,
            owner: role?.title ?? "بدون نقش مالک",
            person: person
              ? `${person.name}${person.status === "archived" ? " (غیرفعال)" : ""}`
              : role
                ? "نقش بدون فرد"
                : "",
            founder: founderStep(data, s),
            direction: map.direction,
          },
        };
      }),
    [map, data],
  );
  const [nodes, setNodes] = useState(mapped),
    [instance, setInstance] = useState<ReactFlowInstance<MapNode> | null>(null);
  useEffect(() => setNodes(mapped), [mapped]);
  useEffect(() => {
    if (instance) {
      const id = requestAnimationFrame(() =>
        instance.fitView({ padding: 0.2, maxZoom: 0.9, duration: 200 }),
      );
      return () => cancelAnimationFrame(id);
    }
  }, [layoutVersion, instance, map.steps.length]);
  const edges = useMemo(
    () =>
      map.connections.map((e) => ({
        id: e.id,
        source: e.sourceStepId,
        target: e.targetStepId,
        sourceHandle: "out",
        targetHandle: "in",
        type: "smoothstep",
        label: [
          e.label || e.condition,
          isHandoff(map, e) ? "تحویل بین نقش‌ها" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isHandoff(map, e) ? "#b59a62" : "#718390",
        },
        style: {
          stroke: isHandoff(map, e) ? "#b59a62" : "#718390",
          strokeWidth: 1.8,
        },
        labelStyle: { fontFamily: "Vazirmatn", fontSize: 11 },
        labelBgStyle: { fill: "#fff" },
        ariaLabel: `اتصال ${map.steps.find((s) => s.id === e.sourceStepId)?.title} به ${map.steps.find((s) => s.id === e.targetStepId)?.title}`,
      })),
    [map],
  );
  return (
    <div
      className="process-canvas"
      dir="ltr"
      onKeyDownCapture={(event) => {
        if (!(event.target instanceof Element)) return;
        const node = event.target.closest(".react-flow__node");
        const id = node?.getAttribute("data-id");
        const step = map.steps.find((s) => s.id === id);
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-5, 0],
          ArrowRight: [5, 0],
          ArrowUp: [0, -5],
          ArrowDown: [0, 5],
        };
        if (step && delta[event.key]) {
          event.preventDefault();
          event.stopPropagation();
          const [x, y] = delta[event.key],
            factor = event.shiftKey ? 4 : 1;
          onMove(
            step.id,
            step.positionX + x * factor,
            step.positionY + y * factor,
          );
          return;
        }
        if (event.key !== "Enter") return;
        if (id && map.steps.some((s) => s.id === id)) {
          event.preventDefault();
          event.stopPropagation();
          onStep(id);
        }
      }}
    >
      <ReactFlow<MapNode>
        ariaLabelConfig={{
          "node.a11yDescription.default":
            "برای ویرایش Enter و برای جابه‌جایی ذخیره‌شونده کلیدهای جهت را بزنید. حذف از پنل جزئیات انجام می‌شود.",
          "edge.a11yDescription.default":
            "برای ویرایش یا حذف اتصال، از فهرست اتصال‌ها استفاده کنید.",
          "controls.ariaLabel": "کنترل نقشه",
          "controls.zoomIn.ariaLabel": "بزرگ‌نمایی",
          "controls.zoomOut.ariaLabel": "کوچک‌نمایی",
          "controls.fitView.ariaLabel": "نمایش کامل نقشه",
          "minimap.ariaLabel": "نمای کوچک نقشه",
        }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setInstance}
        onNodesChange={(changes) =>
          setNodes((n) => applyNodeChanges(changes, n))
        }
        onNodeDragStop={(_, n) => {
          if (!onMove(n.id, n.position.x, n.position.y)) setNodes(mapped);
        }}
        onNodeClick={(_, n) => onStep(n.id)}
        onEdgeClick={(_, e) => onEdge(e.id)}
        onConnect={onConnect}
        isValidConnection={(c) =>
          c.source !== c.target &&
          !map.connections.some(
            (e) => e.sourceStepId === c.source && e.targetStepId === c.target,
          )
        }
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 0.9 }}
        minZoom={0.01}
        maxZoom={1.8}
        deleteKeyCode={null}
        onNodesDelete={() => {}}
      >
        <Background gap={24} color="#d5ddd9" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.data.founder ? "#b59a62" : "#29485d")}
        />
      </ReactFlow>
      {!map.steps.length && (
        <div className="map-empty">
          <strong>نقشهٔ فعلی را از یک مرحله شروع کنید</strong>
          <p>
            مرحله‌ها را اضافه کنید؛ سپس از نقطهٔ خروجی به ورودی مرحله بعد اتصال
            بکشید.
          </p>
        </div>
      )}
    </div>
  );
}
