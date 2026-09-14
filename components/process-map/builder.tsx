"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Plus,
  GitBranch,
  LayoutGrid,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useSystem } from "@/components/system/provider";
import { Button, Panel } from "@/components/system/ui";
import { useMaps } from "./provider";
import {
  emptyMap,
  newStep,
  connect,
  removeStep,
  type ProcessStep,
  type ProcessConnection,
  type ProcessMap,
} from "@/lib/system/maps/model";
import { mapCompleteness } from "@/lib/system/maps/logic";
import { autoLayout } from "@/lib/system/maps/layout";
import { changeStage } from "@/lib/system/actions";
import { stages } from "@/lib/system/config";
import { StepDrawer } from "./step-drawer";
import { EdgeEditor } from "./edge-editor";
import { ProcessMetricsBar, MapValidationPanel } from "./metrics";
import "./map.css";
import { useAnalysis } from "@/components/process-analysis/provider";
import { ProcessNav, Confirmation } from "@/components/process-analysis/shared";
import { redesignReadiness, compareMaps } from "@/lib/system/analysis/redesign";
import "../process-analysis/analysis.css";
const Canvas = dynamic(() => import("./canvas").then((m) => m.ProcessCanvas), {
  ssr: false,
  loading: () => (
    <div className="process-canvas map-loading">در حال آماده‌سازی بوم…</div>
  ),
});
export function ProcessBuilder({
  id,
  variant = "as-is",
}: {
  id: string;
  variant?: "as-is" | "to-be";
}) {
  const { data, commit } = useSystem(),
    maps = useMaps(),
    analysis = useAnalysis();
  const { store } = maps;
  const error = variant === "as-is" ? maps.error : analysis.error,
    status = variant === "as-is" ? maps.status : analysis.status;
  const save = variant === "as-is" ? maps.save : analysis.saveMap;
  const fallback = useMemo(() => emptyMap(id), [id]);
  const asis = store?.maps.find((m) => m.processId === id);
  const map =
      (variant === "as-is"
        ? asis
        : analysis.store?.records.find((r) => r.processId === id)?.toBe) ??
      fallback,
    p = data.processes.find((p) => p.id === id);
  const [step, setStep] = useState<ProcessStep | null>(null),
    [edge, setEdge] = useState<ProcessConnection | null>(null),
    [message, setMessage] = useState(""),
    [layoutVersion, setLayoutVersion] = useState(0),
    [confirmStage, setConfirmStage] = useState(false);
  const readiness = useMemo(() => mapCompleteness(map, data), [map, data]);
  function update(next: ProcessMap) {
    save(next);
    setMessage("");
  }
  function safe(next: ProcessMap) {
    try {
      update(next);
      return true;
    } catch {
      setMessage("تغییر ذخیره نشد؛ پیام حافظه را بررسی کنید.");
      return false;
    }
  }
  if (!p)
    return (
      <Panel title="فرآیند پیدا نشد">
        <Link href="/system/processes">بازگشت به فرآیندها</Link>
      </Panel>
    );
  if (!store)
    return (
      <Panel title="نقشه وضعیت فعلی فرآیند">
        <p role={error ? "alert" : "status"}>{error || status}</p>
      </Panel>
    );
  return (
    <div className={`process-builder ${variant}`}>
      <ProcessNav id={id} />
      <Link className="sys-text-link" href={`/system/processes/${id}`}>
        <ArrowRight size={15} />
        شناسنامه فرآیند
      </Link>
      <header className="map-heading">
        <div>
          <span className="map-as-is" dir="ltr">
            {variant === "as-is"
              ? "AS-IS · CURRENT PROCESS MAP"
              : "TO-BE · FUTURE PROCESS DESIGN"}
          </span>
          <h1>
            {variant === "as-is"
              ? "نقشه وضعیت فعلی فرآیند"
              : "طراحی وضعیت مطلوب فرآیند"}
          </h1>
          <p>
            {p.code} · {p.name}
          </p>
        </div>
        <span className="map-save" role="status">
          <CheckCircle2 size={14} />
          {error ? "ذخیره متوقف شده" : status}
        </span>
      </header>
      {(error || message) && (
        <p className="sys-alert" role="alert">
          {error || message}
        </p>
      )}
      <ProcessMetricsBar map={map} />
      <div className="map-toolbar">
        <div>
          <Button
            onClick={() =>
              setStep({
                ...newStep(id, crypto.randomUUID()),
                title: "",
                positionX:
                  Math.max(0, ...map.steps.map((s) => s.positionX)) + 100,
                positionY: (map.steps.length % 4) * 250,
              })
            }
          >
            <Plus size={16} />
            افزودن مرحله
          </Button>
          <Button
            secondary
            disabled={map.steps.length < 2}
            onClick={() =>
              setEdge({
                id: crypto.randomUUID(),
                processId: id,
                sourceStepId: "",
                targetStepId: "",
                label: "",
                condition: "",
                type: "sequence",
              })
            }
          >
            <GitBranch size={16} />
            اتصال مرحله‌ها
          </Button>
        </div>
        <div>
          <select
            aria-label="جهت چیدمان"
            value={map.direction}
            onChange={(e) => {
              safe(autoLayout(map, e.target.value as ProcessMap["direction"]));
              setLayoutVersion((v) => v + 1);
            }}
          >
            <option value="RL">افقی؛ راست به چپ</option>
            <option value="TB">عمودی؛ بالا به پایین</option>
          </select>
          <Button
            secondary
            onClick={() => {
              safe(autoLayout(map));
              setLayoutVersion((v) => v + 1);
            }}
          >
            <LayoutGrid size={16} />
            چیدمان خودکار
          </Button>
        </div>
      </div>
      <Canvas
        map={map}
        layoutVersion={layoutVersion}
        onStep={(id) => setStep(map.steps.find((s) => s.id === id)!)}
        onEdge={(id) => setEdge(map.connections.find((e) => e.id === id)!)}
        onMove={(id, x, y) =>
          safe({
            ...map,
            steps: map.steps.map((s) =>
              s.id === id
                ? {
                    ...s,
                    positionX: x,
                    positionY: y,
                    updatedAt: new Date().toISOString(),
                  }
                : s,
            ),
          })
        }
        onConnect={(c) => {
          try {
            update(
              connect(map, {
                id: crypto.randomUUID(),
                processId: id,
                sourceStepId: c.source,
                targetStepId: c.target,
                label: "",
                condition: "",
                type: "sequence",
              }),
            );
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "اتصال ذخیره نشد.");
          }
        }}
      />
      <p className="map-caption">
        گره را جابه‌جا کنید؛ با کلیک، جزئیات را ویرایش کنید. برای اتصال، نقطهٔ
        خروجی را به ورودی بکشید یا از «اتصال مرحله‌ها» استفاده کنید. کلیک روی
        خط، برچسب و حذف اتصال را باز می‌کند.
      </p>
      <details className="map-directory">
        <summary>فهرست مراحل و اتصال‌ها</summary>
        <p className="map-caption">
          دسترسی مستقیم به جزئیات، بدون نیاز به بزرگ‌نمایی بوم.
        </p>
        <div>
          {map.steps.map((s) => (
            <button key={s.id} onClick={() => setStep(s)}>
              {s.title}
            </button>
          ))}
        </div>
        <ul>
          {map.connections.map((e) => (
            <li key={e.id}>
              <button onClick={() => setEdge(e)}>
                {map.steps.find((s) => s.id === e.sourceStepId)?.title} ←{" "}
                {map.steps.find((s) => s.id === e.targetStepId)?.title}
                {e.label ? ` · ${e.label}` : ""}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <MapValidationPanel
        map={map}
        onSelect={(id) => setStep(map.steps.find((s) => s.id === id)!)}
      />
      {variant === "as-is" ? (
        <section className="map-stage">
          <div>
            <strong>مرحله فعلی: {stages[p.systemizationStage]}</strong>
            <p>
              ثبت مدل‌سازی: حداقل سه مرحله، مسیر شروع تا پایان برای همه مراحل،
              حداقل ۸۰٪ پوشش نقش مالک و دو شاخه برای هر تصمیم.
            </p>
          </div>
          {p.systemizationStage === "identified" ? (
            <Button
              disabled={!readiness.ready || !!error}
              onClick={() => setConfirmStage(true)}
            >
              ثبت مرحله مدل‌سازی
            </Button>
          ) : (
            <span>
              این اقدام فقط مرحله شناسایی‌شده را به مدل‌سازی‌شده می‌برد.
            </span>
          )}
          {confirmStage && (
            <div className="map-stage-confirm">
              <p>
                نقشه وضعیت فعلی بررسی شده و مرحله فرآیند به «مدل‌سازی‌شده» تغییر
                کند؟
              </p>
              <Button
                onClick={() => {
                  try {
                    if (!mapCompleteness(map, data).ready)
                      throw new Error("نقشه هنوز آماده نیست.");
                    update(map);
                    commit(changeStage(data, id, "mapped"));
                    setConfirmStage(false);
                  } catch (e) {
                    setMessage(
                      e instanceof Error ? e.message : "ثبت مرحله ممکن نشد.",
                    );
                  }
                }}
              >
                تأیید ثبت مدل‌سازی
              </Button>
              <Button secondary onClick={() => setConfirmStage(false)}>
                انصراف
              </Button>
            </div>
          )}
        </section>
      ) : (
        asis && (
          <>
            <Panel
              title={
                redesignReadiness(map, data).ready
                  ? "نسخه TO-BE آماده تأیید است"
                  : "نسخه TO-BE نیازمند تکمیل است"
              }
            >
              <p>
                AS-IS دست‌نخورده باقی می‌ماند؛ زمان‌ها برآورد طراحی آینده‌اند.
              </p>
              {compareMaps(asis, map, data).warnings.map((w) => (
                <p key={w} className="sys-alert">
                  {w}
                </p>
              ))}
              <Link
                href={`/system/processes/${id}/compare`}
                className="sys-button"
              >
                مقایسه AS-IS و TO-BE
              </Link>
            </Panel>
            <Confirmation asis={asis} kind="approval" />
          </>
        )
      )}
      {step && (
        <StepDrawer
          key={step.id}
          initial={step}
          variant={variant}
          isNew={!map.steps.some((s) => s.id === step.id)}
          onClose={() => setStep(null)}
          onChange={(s) =>
            update({
              ...map,
              steps: map.steps.some((x) => x.id === s.id)
                ? map.steps.map((x) => (x.id === s.id ? s : x))
                : [...map.steps, s],
            })
          }
          onDelete={() => update(removeStep(map, step.id))}
        />
      )}
      {edge && (
        <EdgeEditor
          key={edge.id}
          map={map}
          initial={edge}
          onClose={() => setEdge(null)}
          onSave={(e) =>
            update(
              map.connections.some((x) => x.id === e.id)
                ? {
                    ...map,
                    connections: map.connections.map((x) =>
                      x.id === e.id ? e : x,
                    ),
                  }
                : connect(map, e),
            )
          }
          onDelete={
            map.connections.some((e) => e.id === edge.id)
              ? () =>
                  update({
                    ...map,
                    connections: map.connections.filter(
                      (e) => e.id !== edge.id,
                    ),
                  })
              : undefined
          }
        />
      )}
    </div>
  );
}
