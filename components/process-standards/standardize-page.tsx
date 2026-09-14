"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/system/ui";
import { useStandards } from "./provider";
import { useSystem } from "@/components/system/provider";
import {
  createSOP,
  emptyRecord,
  rebaseSOP,
  sopStatuses,
  type Checklist,
  type DecisionRule,
  type Asset,
  type StandardRecord,
} from "@/lib/system/standards/model";
import {
  standardization,
  sourceApproved,
  effectiveSOPStatus,
  standardizedCurrent,
  sourceChanged,
} from "@/lib/system/standards/logic";
import { exampleStandard } from "@/lib/system/standards/example";
import { ProcessNav } from "@/components/process-analysis/shared";
import { SOPEditor } from "./sop-editor";
import { ChecklistEditor } from "./checklist-editor";
import { RuleEditor, AssetEditor } from "./library-editors";
import { ConfirmAction, ProgressPanel, RoleField } from "./shared";
import "./standards.css";
export function StandardizePage({ id }: { id: string }) {
  const c = useStandards(),
    { data } = useSystem(),
    src = c.source(id),
    r = c.store?.records.find((r) => r.processId === id) ?? emptyRecord(id),
    map = src?.analysis.toBe,
    [check, setCheck] = useState<Checklist | null>(null),
    [rule, setRule] = useState<DecisionRule | null>(null),
    [asset, setAsset] = useState<Asset | null>(null),
    [approver, setApprover] = useState(""),
    [localError, setLocalError] = useState("");
  const save = (next: StandardRecord) => {
    c.save(next);
    setLocalError("");
  };
  const safe = (next: StandardRecord) => {
    try {
      save(next);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "ذخیره نشد.");
    }
  };
  if (!c.store)
    return (
      <Panel title="استانداردسازی فرآیند">
        <p>{c.error || c.status}</p>
      </Panel>
    );
  if (!src || !map)
    return (
      <Panel title="استانداردسازی فرآیند">
        <p>ابتدا نسخه TO-BE را بسازید و تأیید کنید.</p>
        <Link href={`/system/processes/${id}/to-be`}>طراحی TO-BE</Link>
      </Panel>
    );
  const m = standardization(r, src),
    status = effectiveSOPStatus(r, src);
  return (
    <div className="standards-workspace">
      <ProcessNav id={id} />
      <header className="standard-heading">
        <span>STANDARDIZE · EXECUTION STANDARD</span>
        <h1>استانداردسازی فرآیند</h1>
        <h2>{data.processes.find((p) => p.id === id)?.name}</h2>
        <p>
          TO-BE = طراحی · SOP = استاندارد اجرا. منبع: TO-BE نسخه{" "}
          {map.version ?? 1} ·{" "}
          {sourceApproved(src) ? "تأیید معتبر" : "تأیید نیازمند بازبینی"}
        </p>
        <small role="status">{c.status}</small>
      </header>
      {(c.error || localError) && (
        <p role="alert" className="sys-alert">
          {c.error || localError}
        </p>
      )}
      {!r.sop ? (
        <Panel title="ساخت استاندارد از نسخه تأییدشده">
          <p>
            شناسه و مسئول مرحله‌ها منتقل می‌شوند؛ دستورهای اجرایی را تیم
            می‌نویسد.
          </p>
          <div className="standard-inline">
            <Button
              disabled={!sourceApproved(src)}
              onClick={() =>
                safe({
                  ...r,
                  sop: createSOP(map, data),
                  plan: {
                    ...r.plan,
                    roles: [
                      ...new Set(
                        map.steps
                          .map((s) => s.ownerRoleId)
                          .filter((x): x is string => !!x),
                      ),
                    ].map((roleId) => ({
                      roleId,
                      trained: false,
                      acknowledged: false,
                    })),
                  },
                })
              }
            >
              ساخت SOP
            </Button>
            {id === "p6" && (
              <Button
                secondary
                disabled={!sourceApproved(src)}
                onClick={() => safe(exampleStandard(map, data))}
              >
                بارگذاری نمونه آموزشی قابل ویرایش
              </Button>
            )}
          </div>
        </Panel>
      ) : (
        <>
          <ProgressPanel
            score={m.score}
            components={m.components}
            label={m.label}
          />
          <Panel
            title={`SOP · ${sopStatuses[status]}`}
            caption={`نسخه ${r.sop.version} · بر پایه TO-BE نسخه ${r.sop.basedOnToBeVersion}`}
          >
            {sourceChanged(r.sop, src) && (
              <div className="sys-alert">
                <p>
                  TO-BE تغییر کرده است؛ استاندارد اجرایی نیازمند بازبینی است.
                  تطبیق، دستورهای باقی‌مانده را حفظ و مرحله‌های جدید را خالی
                  اضافه می‌کند.
                </p>
                <Button
                  disabled={!sourceApproved(src)}
                  onClick={() =>
                    safe({ ...r, sop: rebaseSOP(r.sop!, map, data) })
                  }
                >
                  تطبیق با نسخه تأییدشده
                </Button>
              </div>
            )}
            <SOPEditor
              key={r.sop.updatedAt}
              initial={r.sop}
              map={map}
              onSave={(sop) => save({ ...r, sop })}
            />
          </Panel>
          <Panel
            title="چک‌لیست‌های اجرایی"
            action={
              <Button
                secondary
                onClick={() =>
                  setCheck({
                    id: crypto.randomUUID(),
                    processId: id,
                    name: "",
                    description: "",
                    trigger: "",
                    ownerRoleId: r.sop!.processOwnerRoleId,
                    items: [],
                    status: "draft",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  })
                }
              >
                چک‌لیست جدید
              </Button>
            }
          >
            {r.checklists.map((x) => (
              <article className="standard-library-row" key={x.id}>
                <div>
                  <strong>{x.name}</strong>
                  <p>
                    {x.items.length.toLocaleString("fa-IR")} مورد ·{" "}
                    {x.status === "ready" ? "آماده" : "پیش‌نویس"}
                  </p>
                </div>
                <Button secondary onClick={() => setCheck(x)}>
                  ویرایش چک‌لیست
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    safe({
                      ...r,
                      checklists: r.checklists.filter((y) => y.id !== x.id),
                    })
                  }
                >
                  حذف چک‌لیست
                </Button>
              </article>
            ))}
          </Panel>
          <Panel
            title="قواعد تصمیم و ارجاع"
            action={
              <Button
                secondary
                onClick={() =>
                  setRule({
                    id: crypto.randomUUID(),
                    processId: id,
                    title: "",
                    condition: "",
                    action: "",
                    relatedStepId: "",
                    ownerRoleId: r.sop!.processOwnerRoleId,
                    escalationRoleId: "",
                    priority: 2,
                    status: "draft",
                    notes: "",
                  })
                }
              >
                قاعده جدید
              </Button>
            }
          >
            {r.rules.map((x) => (
              <article className="standard-library-row" key={x.id}>
                <div>
                  <strong>{x.title}</strong>
                  <p>
                    اگر {x.condition} ← {x.action}
                  </p>
                  <small>
                    ارجاع:{" "}
                    {data.roles.find((r) => r.id === x.escalationRoleId)
                      ?.title ?? "ندارد"}
                  </small>
                </div>
                <Button secondary onClick={() => setRule(x)}>
                  ویرایش قاعده
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    safe({ ...r, rules: r.rules.filter((y) => y.id !== x.id) })
                  }
                >
                  حذف قاعده
                </Button>
              </article>
            ))}
          </Panel>
          <Panel
            title="دارایی‌ها و قالب‌های مرتبط"
            action={
              <Button
                secondary
                onClick={() =>
                  setAsset({
                    id: crypto.randomUUID(),
                    processId: id,
                    name: "",
                    type: "template",
                    description: "",
                    reference: "",
                    relatedStepId: "",
                    version: "1.0",
                    status: "draft",
                  })
                }
              >
                دارایی جدید
              </Button>
            }
          >
            {r.assets.map((x) => (
              <article className="standard-library-row" key={x.id}>
                <div>
                  <strong>
                    {x.name} · {x.version}
                  </strong>
                  <p>{x.reference}</p>
                  <small>{x.description}</small>
                </div>
                <Button secondary onClick={() => setAsset(x)}>
                  ویرایش دارایی
                </Button>
                <Button
                  secondary
                  onClick={() =>
                    safe({
                      ...r,
                      assets: r.assets.filter((y) => y.id !== x.id),
                    })
                  }
                >
                  حذف دارایی
                </Button>
              </article>
            ))}
          </Panel>
          <Panel title="تعریف پایان صحیح">
            <ul>
              {r.sop.definitionOfDone.filter(Boolean).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </Panel>
          <Panel title="بررسی استاندارد و تأیید">
            <ul className="standard-warnings">
              {m.warnings.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <RoleField
              label="نقش تأییدکننده SOP"
              value={approver}
              onChange={setApprover}
            />
            <ConfirmAction
              id={id}
              action="sop"
              label="تأیید SOP"
              disabled={!m.approvable || !approver || status === "approved"}
              roleId={approver}
            />
            <p>
              {standardizedCurrent(r, src)
                ? `استانداردسازی تأیید شده · ${new Date(r.standardizedAt!).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}`
                : m.ready
                  ? "آماده تأیید استانداردسازی"
                  : "SOP باید تأیید شود و موانع رفع شوند."}
            </p>
            <ConfirmAction
              id={id}
              action="standardize"
              label="تأیید استانداردسازی"
              disabled={!m.ready || standardizedCurrent(r, src)}
            />
            <Link
              href={`/system/processes/${id}/implementation`}
              className="sys-text-link"
            >
              برنامه پیاده‌سازی
            </Link>
          </Panel>
        </>
      )}
      {check && (
        <ChecklistEditor
          initial={check}
          map={map}
          onClose={() => setCheck(null)}
          onSave={(x) =>
            save({
              ...r,
              checklists: [...r.checklists.filter((y) => y.id !== x.id), x],
            })
          }
        />
      )}{" "}
      {rule && (
        <RuleEditor
          initial={rule}
          map={map}
          onClose={() => setRule(null)}
          onSave={(x) =>
            save({ ...r, rules: [...r.rules.filter((y) => y.id !== x.id), x] })
          }
        />
      )}{" "}
      {asset && (
        <AssetEditor
          initial={asset}
          map={map}
          onClose={() => setAsset(null)}
          onSave={(x) =>
            save({
              ...r,
              assets: [...r.assets.filter((y) => y.id !== x.id), x],
            })
          }
        />
      )}
    </div>
  );
}
