"use client";
import { AdvisorEntry } from "@/components/advisor/entry";
import { useState } from "react";
import Link from "next/link";
import { Button, Drawer, Panel, PageTitle } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Owner } from "./shared";
import * as M from "@/lib/scale/model";
import {
  constraintQuality,
  constraintLeverSuggestions,
} from "@/lib/scale/logic";
import { saveConstraint } from "@/lib/scale/persistence";
import { ExperimentLinks } from "./experiments";
import { FunnelEntityContext } from "./funnel";
import { NetworkEntityContext } from "./network-shared";
import { ReadinessEntry } from "./readiness-shared";
const quality = {
  strong: "ساختار قوی",
  needsEvidence: "نیازمند شواهد",
  incomplete: "ناقص",
};
function Editor({
  initial,
  close,
}: {
  initial: M.GrowthConstraint;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    [c, setC] = useState(initial),
    [primary, setPrimary] = useState(store.primaryConstraintId === initial.id),
    [error, setError] = useState("");
  const change = (k: keyof M.GrowthConstraint, v: unknown) =>
    setC({ ...c, [k]: v });
  const objective = sources.objectives.find(
    (o) => o.id === c.linkedStrategyObjectiveId,
  );
  return (
    <Drawer
      open
      onClose={close}
      title="گلوگاه رشد"
      description="مسئله و شواهد را از راه‌حل جدا کنید."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (c.linkedStrategyKRId) {
              const kr = sources.keyResults.find(
                (k) => k.id === c.linkedStrategyKRId,
              );
              if (kr && kr.objectiveId !== c.linkedStrategyObjectiveId)
                throw Error("نتیجه کلیدی با هدف انتخابی هم‌راستا نیست.");
            }
            commit(
              saveConstraint(
                {
                  ...store,
                  primaryConstraintId:
                    !primary && store.primaryConstraintId === c.id
                      ? null
                      : store.primaryConstraintId,
                },
                c,
                primary,
              ),
            );
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد");
          }
        }}
      >
        <Text
          required
          label="عنوان مسئله"
          value={c.title}
          onChange={(v) => change("title", v)}
        />
        <Text
          area
          label="شرح گلوگاه احتمالی"
          value={c.description}
          onChange={(v) => change("description", v)}
        />
        <Text
          label="نشانه مشاهده‌شده (نه علت قطعی)"
          value={c.symptom}
          onChange={(v) => change("symptom", v)}
        />
        <Select
          label="بُعد رشد"
          value={c.dimension}
          items={M.dimensions}
          onChange={(v) => change("dimension", v)}
        />
        <div className="scale-grid">
          <Select
            label="شدت محدودیت"
            value={c.severity}
            items={M.severityLabels}
            onChange={(v) => change("severity", v)}
          />
          <Select
            label="اطمینان به تشخیص"
            value={c.confidence}
            items={M.levels}
            onChange={(v) => change("confidence", v)}
          />
        </div>
        <Text
          area
          label="اثر محدودیت بر رشد"
          value={c.impact}
          onChange={(v) => change("impact", v)}
        />
        <Owner
          value={c.ownerRoleId}
          onChange={(v) => change("ownerRoleId", v)}
        />
        <Select
          label="وضعیت گلوگاه"
          value={c.status}
          items={M.constraintStatuses}
          onChange={(v) => {
            setC({ ...c, status: v as M.GrowthConstraint["status"] });
            if (v !== "active") setPrimary(false);
          }}
        />
        <label className="scale-check">
          <input
            type="checkbox"
            checked={primary}
            disabled={c.status !== "active"}
            onChange={(e) => setPrimary(e.target.checked)}
          />
          گلوگاه اصلی رشد (فقط یکی؛ جایگزین انتخاب قبلی می‌شود)
        </label>
        <h3>شواهد</h3>
        {c.evidence.map((x, index) => (
          <div className="scale-evidence" key={index}>
            <Select
              label={`نوع شاهد ${index + 1}`}
              value={x.type}
              items={M.evidenceTypes}
              onChange={(v) =>
                change(
                  "evidence",
                  c.evidence.map((e, j) =>
                    j === index ? { ...e, type: v } : e,
                  ),
                )
              }
            />
            <Text
              area
              label={`متن شاهد ${index + 1}`}
              value={x.text}
              onChange={(v) =>
                change(
                  "evidence",
                  c.evidence.map((e, j) =>
                    j === index ? { ...e, text: v } : e,
                  ),
                )
              }
            />
            <Button
              secondary
              onClick={() =>
                change(
                  "evidence",
                  c.evidence.filter((_, j) => j !== index),
                )
              }
            >
              حذف شاهد از فرم
            </Button>
          </div>
        ))}
        <Button
          secondary
          onClick={() =>
            change("evidence", [
              ...c.evidence,
              { type: "observation", text: "" },
            ])
          }
        >
          افزودن شاهد
        </Button>
        <h3>پیوندهای خواندنی</h3>
        <Select
          label="هدف استراتژیک"
          value={c.linkedStrategyObjectiveId}
          empty="بدون پیوند"
          items={Object.fromEntries(
            sources.objectives.map((o) => [
              o.id,
              `${o.title} · ${sources.cycleLabels[o.cycleId] ?? "دوره نامشخص"}`,
            ]),
          )}
          onChange={(v) =>
            setC({ ...c, linkedStrategyObjectiveId: v, linkedStrategyKRId: "" })
          }
        />
        <Select
          label="نتیجه کلیدی استراتژی"
          value={c.linkedStrategyKRId}
          empty="بدون پیوند"
          items={Object.fromEntries(
            sources.keyResults
              .filter((k) => !objective || k.objectiveId === objective.id)
              .map((k) => [
                k.id,
                `${k.title} · ${sources.cycleLabels[k.cycleId] ?? "دوره نامشخص"}`,
              ]),
          )}
          onChange={(v) =>
            setC({
              ...c,
              linkedStrategyKRId: v,
              linkedStrategyObjectiveId:
                sources.keyResults.find((k) => k.id === v)?.objectiveId ??
                c.linkedStrategyObjectiveId,
            })
          }
        />
        <Select
          label="فرآیند سیستم"
          value={c.linkedSystemProcessId}
          empty="بدون پیوند"
          items={Object.fromEntries(
            sources.processes.map((p) => [p.id, p.name]),
          )}
          onChange={(v) => change("linkedSystemProcessId", v)}
        />
        <h3>اهرم‌های ممکن</h3>
        <p>راهنمای چارچوب بر اساس بُعد؛ تضمین مناسب بودن مداخله نیست.</p>
        {constraintLeverSuggestions(store, c.dimension).map((l) => (
          <label key={l.id} className="scale-check">
            <input
              type="checkbox"
              checked={c.leverIds.includes(l.id)}
              onChange={(e) =>
                change(
                  "leverIds",
                  e.target.checked
                    ? [...c.leverIds, l.id]
                    : c.leverIds.filter((id) => id !== l.id),
                )
              }
            />
            {l.name}
          </label>
        ))}
        {c.leverIds
          .filter(
            (id) =>
              !constraintLeverSuggestions(store, c.dimension).some(
                (l) => l.id === id,
              ),
          )
          .map((id) => (
            <label className="scale-check" key={id}>
              <input
                type="checkbox"
                checked
                onChange={() =>
                  change(
                    "leverIds",
                    c.leverIds.filter((x) => x !== id),
                  )
                }
              />
              {store.levers.find((l) => l.id === id)?.name} · پیوند موجود
            </label>
          ))}
        <Text
          area
          label="یادداشت"
          value={c.notes}
          onChange={(v) => change("notes", v)}
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره گلوگاه</Button>
      </form>
    </Drawer>
  );
}
export function Constraints({ id }: { id?: string }) {
  const { store, sources } = useScale(),
    [edit, setEdit] = useState<M.GrowthConstraint | null>(null),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState("");
  const c = store.constraints.find((c) => c.id === id);
  if (id && !c)
    return (
      <Panel title="گلوگاه پیدا نشد">
        <Link href="/scale/constraints">بازگشت به گلوگاه‌ها</Link>
      </Panel>
    );
  const rows = store.constraints.filter(
    (c) => (!filter || c.status === filter) && c.title.includes(search),
  );
  return (
    <>
      <PageTitle
        title={c ? c.title : "گلوگاه‌های رشد"}
        description="روی محدودیت‌های مهم تمرکز کنید؛ شدت، اطمینان و کیفیت شواهد مستقل هستند."
        onAdd={() => setEdit(c ?? M.newConstraint())}
        addLabel={c ? "ویرایش گلوگاه" : "ثبت گلوگاه"}
      />
      {c && <AdvisorEntry type="constraint" id={c.id} />}
      {c ? (
        <>
          <Panel
            title={
              store.primaryConstraintId === c.id
                ? "گلوگاه اصلی رشد"
                : "شناسنامه گلوگاه"
            }
          >
            <p>{c.description}</p>
            <div className="scale-tags">
              <span>{M.dimensions[c.dimension]}</span>
              <span>{M.constraintStatuses[c.status]}</span>
              <span>شدت: {M.severityLabels[c.severity]}</span>
              <span>اطمینان: {M.levels[c.confidence]}</span>
              <span>{quality[constraintQuality(c)]}</span>
            </div>
            <p>نشانه: {c.symptom || "ثبت نشده"}</p>
            <p>اثر: {c.impact || "نامشخص"}</p>
            <p>
              مسئول:{" "}
              {sources.roles.find((r) => r.id === c.ownerRoleId)?.title ??
                "ناشناخته / بدون نقش"}
            </p>
            <h3>شواهد</h3>
            {c.evidence.map((e, i) => (
              <p key={i}>
                <strong>{M.evidenceTypes[e.type]}:</strong> {e.text}
              </p>
            ))}
            {!c.evidence.length && <p>شاهدی ثبت نشده است.</p>}
            <p>{c.notes}</p>
            {c.linkedStrategyObjectiveId && (
              <p>
                {sources.objectives.some(
                  (o) => o.id === c.linkedStrategyObjectiveId,
                ) ? (
                  <Link
                    href={`/strategy/cycles/${sources.objectives.find((o) => o.id === c.linkedStrategyObjectiveId)!.cycleId}/objectives/${c.linkedStrategyObjectiveId}${c.linkedStrategyKRId ? "#kr-" + c.linkedStrategyKRId : ""}`}
                  >
                    مشاهده هدف / نتیجه کلیدی در استراتژی ←
                  </Link>
                ) : (
                  "پیوند استراتژی در منبع موجود نیست."
                )}
              </p>
            )}
            {c.linkedSystemProcessId && (
              <Link href={`/system/processes/${c.linkedSystemProcessId}`}>
                مشاهده فرآیند سیستم ←
              </Link>
            )}
          </Panel>
          <Panel title="اهرم‌های ممکن">
            <div className="scale-tags">
              {c.leverIds.map((id) => (
                <span key={id}>
                  {store.levers.find((l) => l.id === id)?.name}
                </span>
              ))}
            </div>
            <p>اهرم، حوزه مداخله است؛ هنوز راه‌حل تأییدشده نیست.</p>
          </Panel>
          <Panel title="ایده‌های این گلوگاه">
            {store.ideas
              .filter((i) => i.constraintId === c.id)
              .map((i) => (
                <p key={i.id}>
                  <Link href={`/scale/ideas/${i.id}`}>{i.title}</Link> ·{" "}
                  {M.ideaStatuses[i.status]}
                </p>
              ))}
            <Link href="/scale/ideas">ثبت و بررسی ایده ←</Link>
          </Panel>
          <ExperimentLinks constraintId={c.id} />
          <FunnelEntityContext kind="constraint" entityId={c.id} />
          <NetworkEntityContext kind="constraint" entityId={c.id} />
          <ReadinessEntry />
        </>
      ) : (
        <>
          <div className="scale-grid">
            <Text label="جست‌وجوی گلوگاه" value={search} onChange={setSearch} />
            <Select
              label="فیلتر وضعیت"
              value={filter}
              items={M.constraintStatuses}
              empty="همه وضعیت‌ها"
              onChange={setFilter}
            />
          </div>
          <div className="scale-grid">
            {rows.map((c) => (
              <article className="scale-card" key={c.id}>
                <small>
                  {M.dimensions[c.dimension]} · {M.constraintStatuses[c.status]}
                </small>
                <h3>
                  <Link href={`/scale/constraints/${c.id}`}>{c.title}</Link>
                </h3>
                {store.primaryConstraintId === c.id && (
                  <strong className="scale-gold">گلوگاه اصلی</strong>
                )}
                <p>
                  شدت {M.severityLabels[c.severity]} · اطمینان{" "}
                  {M.levels[c.confidence]}
                </p>
                <p>{quality[constraintQuality(c)]}</p>
                <Button secondary onClick={() => setEdit(c)}>
                  ویرایش گلوگاه
                </Button>
              </article>
            ))}
          </div>
          {!rows.length && <p>گلوگاهی با این شرایط وجود ندارد.</p>}
        </>
      )}
      {edit && (
        <Editor key={edit.id} initial={edit} close={() => setEdit(null)} />
      )}
    </>
  );
}
