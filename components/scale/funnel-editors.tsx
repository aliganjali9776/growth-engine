"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button, Field } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Numeric, Owner, fa } from "./shared";
import { businessModels } from "@/lib/scale/model";
import * as F from "@/lib/scale/funnel/model";
import * as M from "@/lib/scale/funnel/mutations";
import * as L from "@/lib/scale/funnel/logic";
export function FunnelNav() {
  return (
    <nav className="scale-nav" aria-label="ابزارهای قیف">
      <Link href="/scale/funnel">قیف و درآمد</Link>
      <Link href="/scale/funnel/builder">ساختار قیف</Link>
      <Link href="/scale/funnel/history">دوره‌ها و تاریخچه</Link>
    </nav>
  );
}
export function FunnelBuilder() {
  const { store, commit } = useScale(),
    d = F.funnelData(store);
  const [selected, setSelected] = useState(
      d.funnels.find((f) => f.active)?.id ?? "",
    ),
    [name, setName] = useState("قیف رشد"),
    [template, setTemplate] = useState("consulting"),
    [error, setError] = useState("");
  const f = d.funnels.find((f) => f.id === selected);
  return (
    <>
      <FunnelNav />
      <Panel
        title="ساخت قیف قابل‌ویرایش"
        caption="الگو فقط ساختار پیشنهاد می‌دهد؛ هیچ عملکرد واقعی به آن اضافه نمی‌شود."
      >
        <Text label="نام قیف جدید" value={name} onChange={setName} />
        <Select
          label="الگوی اختیاری"
          value={template}
          onChange={setTemplate}
          items={Object.fromEntries(
            Object.entries(F.templates).map(([k, t]) => [k, t.name]),
          )}
        />
        <Button
          onClick={() => {
            try {
              const n = M.createFunnel(store, name, template);
              commit(n);
              setSelected(n.funnelData!.funnels.at(-1)!.id);
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          ایجاد قیف
        </Button>
        <Button
          secondary
          onClick={() => {
            try {
              const n = M.consultingSample(store);
              commit(n);
              setSelected(n.funnelData!.funnels.at(-1)!.id);
              setError("نمونه به صورت پیش‌نویس آموزشی ساخته شد.");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          ساخت نمونه آموزشی مشاوره
        </Button>
      </Panel>
      {error && <p role="alert">{error}</p>}
      <Select
        label="قیف برای ویرایش"
        value={selected}
        onChange={setSelected}
        empty="انتخاب قیف"
        items={Object.fromEntries(d.funnels.map((f) => [f.id, f.name]))}
      />
      {f && <Structure key={f.id + f.updatedAt} initial={f} />}
    </>
  );
}
function Structure({ initial }: { initial: F.GrowthFunnel }) {
  const { store, commit } = useScale(),
    d = F.funnelData(store);
  const [f, setF] = useState(initial),
    [stages, setStages] = useState(
      d.stages
        .filter((s) => s.funnelId === f.id && s.active)
        .sort((a, b) => a.order - b.order),
    ),
    [error, setError] = useState("");
  function update(id: string, change: Partial<F.FunnelStage>) {
    setStages(stages.map((s) => (s.id === id ? { ...s, ...change } : s)));
  }
  function move(i: number, delta: number) {
    const n = [...stages];
    [n[i], n[i + delta]] = [n[i + delta], n[i]];
    setStages(n);
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          commit(M.saveStructure(store, f, stages));
          setError("");
        } catch (x) {
          setError((x as Error).message);
        }
      }}
    >
      <Panel title="مراحل مرتب‌شده">
        <Text
          label="نام قیف"
          value={f.name}
          onChange={(name) => setF({ ...f, name })}
        />
        <Select
          label="مدل کسب‌وکار"
          value={f.businessModel}
          items={businessModels}
          onChange={(v) =>
            setF({ ...f, businessModel: v as F.GrowthFunnel["businessModel"] })
          }
        />
        <Text
          label="شرح قیف"
          value={f.description}
          onChange={(description) => setF({ ...f, description })}
        />
        <label>
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF({ ...f, active: e.target.checked })}
          />{" "}
          قیف اصلی فعال
        </label>
        <p>
          حذف مرحله آن را غیرفعال می‌کند؛ دوره‌های تکمیل‌شده حفظ می‌شوند. پیش از
          غیرفعال‌کردن مرحله درآمد، مدل درآمد را تغییر دهید.
        </p>
        {stages.map((s, i) => (
          <fieldset className="funnel-stage-editor" key={s.id}>
            <legend>مرحله {fa(i + 1)}</legend>
            <div className="funnel-fields">
              <Text
                label="نام مرحله"
                value={s.name}
                onChange={(name) => update(s.id, { name })}
              />
              <Select
                label="نوع مرحله"
                value={s.type}
                items={F.stageTypes}
                onChange={(type) =>
                  update(s.id, { type: type as F.FunnelStage["type"] })
                }
              />
              <Owner
                value={s.ownerRoleId}
                onChange={(ownerRoleId) => update(s.id, { ownerRoleId })}
              />
              <Text
                label="واحد حجم"
                value={s.metricUnit}
                onChange={(metricUnit) => update(s.id, { metricUnit })}
              />
              <Numeric
                label="هدف تبدیل از مرحله قبل (%)"
                value={s.targetConversion}
                max={100}
                onChange={(targetConversion) =>
                  update(s.id, { targetConversion })
                }
              />
              <Numeric
                label="هدف حجم"
                value={s.targetVolume}
                onChange={(targetVolume) => update(s.id, { targetVolume })}
              />
            </div>
            <div className="scale-actions">
              <Button secondary disabled={i === 0} onClick={() => move(i, -1)}>
                بالا بردن {s.name}
              </Button>
              <Button
                secondary
                disabled={i === stages.length - 1}
                onClick={() => move(i, 1)}
              >
                پایین بردن {s.name}
              </Button>
              <Button
                secondary
                onClick={() => setStages(stages.filter((x) => x.id !== s.id))}
              >
                غیرفعال‌کردن {s.name}
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          secondary
          onClick={() =>
            setStages([...stages, F.newStage(f.id, stages.length)])
          }
        >
          افزودن مرحله
        </Button>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره ساختار قیف</Button>
      </Panel>
    </form>
  );
}
export function FunnelHistory() {
  const { store } = useScale(),
    d = F.funnelData(store);
  const [fid, setFid] = useState(d.funnels.find((f) => f.active)?.id ?? ""),
    [editing, setEditing] = useState<F.FunnelPeriod | null>(null);
  const periods = d.periods
    .filter((p) => p.funnelId === fid)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return (
    <>
      <FunnelNav />
      <Panel title="دوره‌ها و تاریخچه قیف">
        <Select
          label="قیف تاریخچه"
          value={fid}
          onChange={(v) => {
            setFid(v);
            setEditing(null);
          }}
          empty="انتخاب قیف"
          items={Object.fromEntries(d.funnels.map((f) => [f.id, f.name]))}
        />
        <Button
          disabled={!fid}
          onClick={() => {
            const at = F.timestamp();
            setEditing({
              id: F.uid(),
              funnelId: fid,
              periodStart: "",
              periodEnd: "",
              label: "",
              cadence: "monthly",
              status: "draft",
              createdAt: at,
              updatedAt: at,
            });
          }}
        >
          دوره جدید
        </Button>
        <p>
          دوره‌های هم‌پوشان یا با طول متفاوت، مقایسه مستقیم حجم معتبری ندارند؛
          نرخ‌ها نیز نیازمند تعریف و جمعیت قابل‌مقایسه‌اند.
        </p>
        {periods.map((p) => (
          <article key={p.id} className="funnel-period">
            <h3>
              {p.label || p.periodStart} ·{" "}
              {p.status === "completed" ? "تکمیل‌شده" : "پیش‌نویس"}
            </h3>
            <p>
              {p.periodStart} — {p.periodEnd}
            </p>
            <Button secondary onClick={() => setEditing(p)}>
              {p.status === "completed" ? "مشاهده دوره" : "ویرایش دوره"}
            </Button>
            {p.status === "completed" && <PeriodSummary period={p} />}
          </article>
        ))}
      </Panel>
      {editing && (
        <PeriodEditor
          key={editing.id}
          period={editing}
          close={() => setEditing(null)}
        />
      )}
    </>
  );
}
function PeriodSummary({ period: p }: { period: F.FunnelPeriod }) {
  const { store } = useScale(),
    d = F.funnelData(store),
    all = F.completedPeriods(d, p.funnelId),
    index = all.findIndex((x) => x.id === p.id),
    rs = L.stageRows(d, p, index > 0 ? all[index - 1] : undefined),
    rev = p.snapshot?.revenue,
    estimated = rev
      ? L.calculateEstimatedRevenue(
          rs.find((r) => r.stage.id === rev.revenueStageId)?.volume ?? null,
          rev.averageDealValue,
        )
      : null;
  return (
    <>
      <p>
        گلوگاه این دوره:{" "}
        {L.calculateFunnelConstraintSignal(
          rs,
          rev?.revenueStageId ?? "",
          rev?.averageDealValue ?? null,
        ).find((s) => s.score !== null && s.score > 0)?.row.stage.name ??
          "نامشخص"}
      </p>
      {index > 0 && (
        <p>
          تغییر برآورد درآمد نسبت به دوره قبل:{" "}
          {fa(
            rev?.currency === all[index - 1].snapshot?.revenue?.currency &&
              estimated !== null &&
              L.revenueHistory(d, all[index - 1]).estimated !== null
              ? estimated - L.revenueHistory(d, all[index - 1]).estimated!
              : null,
          )}{" "}
          {rev?.currency}
        </p>
      )}
      <p>
        برآورد مبتنی بر قیف: {fa(estimated)} {rev?.currency} · درآمد واقعی
        ثبت‌شده: {fa(rev?.currentRevenue)}
      </p>
      <div className="funnel-cards">
        {rs.map((r) => (
          <div key={r.stage.id}>
            <strong>{r.stage.name}</strong>
            <p>
              حجم {fa(r.volume)} · تبدیل {fa(r.conversion)}٪
            </p>
            <p>
              تغییر حجم {fa(r.volumeDelta)} · تغییر تبدیل {fa(r.trend)} واحد
              درصد
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
function PeriodEditor({
  period,
  close,
}: {
  period: F.FunnelPeriod;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    d = F.funnelData(store);
  const [p, setP] = useState(period),
    [error, setError] = useState("");
  const stages = F.periodStages(d, p),
    [ms, setMs] = useState<F.FunnelStageMeasurement[]>(() =>
      stages.map(
        (st) =>
          d.measurements.find(
            (m) => m.periodId === p.id && m.stageId === st.id,
          ) ?? {
            id: F.uid(),
            periodId: p.id,
            funnelId: p.funnelId,
            stageId: st.id,
            volume: null,
            revenueValue: null,
            note: "",
            source: "",
            createdAt: F.timestamp(),
            updatedAt: F.timestamp(),
          },
      ),
    );
  const locked = p.status === "completed";
  const prior = F.completedPeriods(d, p.funnelId)
    .filter((x) => x.periodEnd < p.periodStart)
    .at(-1);
  const preview = {
      ...d,
      measurements: [
        ...d.measurements.filter((m) => m.periodId !== p.id),
        ...ms,
      ],
    },
    rs = L.stageRows(preview, p, prior);
  function update(id: string, change: Partial<F.FunnelStageMeasurement>) {
    setMs(
      ms.map((m) =>
        m.stageId === id ? { ...m, ...change, updatedAt: F.timestamp() } : m,
      ),
    );
  }
  return (
    <Panel title={locked ? "دوره تاریخی ثابت" : "ثبت حجم دوره"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(M.savePeriod(store, p, ms));
            setError("پیش‌نویس ذخیره شد.");
          } catch (x) {
            setError((x as Error).message);
          }
        }}
      >
        <fieldset disabled={locked}>
          <div className="funnel-fields">
            <Text
              label="عنوان دوره"
              value={p.label}
              onChange={(label) => setP({ ...p, label })}
            />
            <Select
              label="نوع دوره"
              value={p.cadence}
              onChange={(cadence) =>
                setP({ ...p, cadence: cadence as F.FunnelPeriod["cadence"] })
              }
              items={{ weekly: "هفتگی", monthly: "ماهانه", custom: "سفارشی" }}
            />
            <Field label="شروع دوره">
              <input
                required
                type="date"
                value={p.periodStart}
                onInput={(e) =>
                  setP({ ...p, periodStart: e.currentTarget.value })
                }
              />
            </Field>
            <Field label="پایان دوره">
              <input
                required
                type="date"
                value={p.periodEnd}
                onInput={(e) =>
                  setP({ ...p, periodEnd: e.currentTarget.value })
                }
              />
            </Field>
          </div>
          {stages.map((st) => {
            const m = ms.find((m) => m.stageId === st.id)!,
              r = rs.find((r) => r.stage.id === st.id)!;
            return (
              <fieldset key={st.id} className="funnel-stage-editor">
                <legend>{st.name}</legend>
                <p>
                  دوره قبل: {fa(r.previousVolume)} · هدف حجم:{" "}
                  {fa(st.targetVolume)} · تبدیل: {fa(r.conversion)}٪
                </p>
                <div className="funnel-fields">
                  <Numeric
                    label={`حجم ${st.name}`}
                    value={m.volume}
                    onChange={(volume) => update(st.id, { volume })}
                  />
                  <Numeric
                    label={`درآمد ثبت‌شده ${st.name}`}
                    value={m.revenueValue}
                    onChange={(revenueValue) => update(st.id, { revenueValue })}
                  />
                  <Text
                    label={`منبع ${st.name}`}
                    value={m.source}
                    onChange={(source) => update(st.id, { source })}
                  />
                  <Text
                    label={`یادداشت ${st.name}`}
                    value={m.note}
                    onChange={(note) => update(st.id, { note })}
                  />
                </div>
              </fieldset>
            );
          })}
        </fieldset>
        {error && <p role="status">{error}</p>}
        <div className="scale-actions">
          {!locked && (
            <>
              <Button type="submit">ذخیره پیش‌نویس دوره</Button>
              <Button
                onClick={() => {
                  try {
                    const saved = M.savePeriod(store, p, ms);
                    const r = F.funnelData(saved).revenueModels.find(
                      (r) => r.funnelId === p.funnelId,
                    );
                    const n = M.completePeriod(
                      saved,
                      p.id,
                      r ? L.strategyRevenueTarget(r, sources.keyResults) : null,
                    );
                    commit(saved);
                    commit(n);
                    setP(n.funnelData!.periods.find((x) => x.id === p.id)!);
                    setError("دوره تکمیل شد؛ تاریخچه ثابت است.");
                  } catch (x) {
                    setError((x as Error).message);
                  }
                }}
              >
                تکمیل دوره
              </Button>
            </>
          )}
          <Button secondary onClick={close}>
            بستن دوره
          </Button>
        </div>
      </form>
    </Panel>
  );
}
