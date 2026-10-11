"use client";
import { useState } from "react";
import { Button, Drawer, Field } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Owner, Numeric, fa } from "./shared";
import * as N from "@/lib/scale/network/model";
import * as U from "@/lib/scale/network/mutations";
import { experimentData } from "@/lib/scale/experiments/model";
import { funnelData } from "@/lib/scale/funnel/model";
export function LoopEditor({
  initial,
  close,
}: {
  initial: N.GrowthLoop;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    d = N.networkData(store),
    [l, setL] = useState(initial),
    [nodes, setNodes] = useState(
      d.nodes
        .filter((n) => n.loopId === l.id && n.active)
        .sort((a, b) => a.order - b.order),
    ),
    [error, setError] = useState(""),
    set = (k: keyof N.GrowthLoop, v: unknown) => setL({ ...l, [k]: v }),
    metrics = Object.fromEntries(
      experimentData(store).metrics.map((m) => [m.id, `${m.name} · ${m.unit}`]),
    );
  function update(id: string, change: Partial<N.GrowthLoopNode>) {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, ...change } : n)));
  }
  function move(i: number, delta: number) {
    const n = [...nodes];
    [n[i], n[i + delta]] = [n[i + delta], n[i]];
    setNodes(n);
  }
  return (
    <Drawer
      open
      onClose={close}
      title="طراحی حلقه رشد"
      description="خروجی باید به ورودی بعدی بازگردد؛ ترتیب مراحل به‌تنهایی یک حلقه نمی‌سازد."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(
              U.saveLoop(
                store,
                l,
                nodes,
                sources.roles.map((r) => r.id),
              ),
            );
            close();
          } catch (x) {
            setError((x as Error).message);
          }
        }}
      >
        <Text
          label="نام حلقه"
          required
          value={l.name}
          onChange={(v) => set("name", v)}
        />
        <Select
          label="نوع حلقه"
          value={l.type}
          items={N.loopTypes}
          onChange={(v) => set("type", v)}
        />
        <Select
          label="وضعیت حلقه"
          value={l.status}
          items={N.loopStatuses}
          onChange={(v) => set("status", v)}
        />
        <Owner value={l.ownerRoleId} onChange={(v) => set("ownerRoleId", v)} />
        <Text
          label="شرح حلقه"
          area
          value={l.description}
          onChange={(v) => set("description", v)}
        />
        <Text
          label="فرضیه حلقه"
          area
          value={l.hypothesis}
          onChange={(v) => set("hypothesis", v)}
        />
        <Text
          label="چه چیزی وارد حلقه می‌شود؟"
          value={l.input}
          onChange={(v) => set("input", v)}
        />
        <Text
          label="چه اقدام یا ارزشی ساخته می‌شود؟"
          value={l.valueCreated}
          onChange={(v) => set("valueCreated", v)}
        />
        <Text
          label="خروجی حلقه چیست؟"
          value={l.output}
          onChange={(v) => set("output", v)}
        />
        <Text
          label="خروجی چگونه ورودی بعدی را می‌سازد؟"
          area
          value={l.reentry}
          onChange={(v) => set("reentry", v)}
        />
        <Select
          label="شاخص اصلی حلقه"
          value={l.primaryOutputMetricId}
          items={metrics}
          empty="انتخاب شاخص"
          onChange={(v) => set("primaryOutputMetricId", v)}
        />
        <Numeric
          label="زمان تقریبی چرخه (روز)"
          value={l.loopCycleTime}
          onChange={(v) => set("loopCycleTime", v)}
        />
        <Select
          label="سطح توصیفی شواهد"
          value={l.evidenceLevel}
          items={N.evidenceLevels}
          onChange={(v) => set("evidenceLevel", v)}
        />
        <Text
          label="وابستگی یا محدودیت حلقه"
          value={l.dependency}
          onChange={(v) => set("dependency", v)}
        />
        <h3>مراحل مرتب‌شده</h3>
        <Button
          secondary
          onClick={() => {
            set("name", l.name || "حلقه معرفی مشتری موفق");
            setL({
              ...l,
              name: l.name || "حلقه معرفی مشتری موفق",
              type: "referral",
              hypothesis:
                "درخواست ساختاریافته معرفی پس از تجربه موفق، ورودی واجد شرایط می‌سازد.",
              input: "مشتری فعلی",
              valueCreated: "اجرای موفق و درخواست معرفی",
              output: "مشتری جدید",
              reentry: "مشتری جدید پس از تجربه موفق دوباره معرفی می‌کند.",
              primaryOutputMetricId: "qualified",
            });
            setNodes(
              [
                "مشتری",
                "تجربه موفق",
                "درخواست معرفی",
                "لید معرفی‌شده",
                "لید واجد شرایط",
                "مشتری جدید",
              ].map((name, i) => ({ ...N.newNode(l.id, i), name })),
            );
          }}
        >
          استفاده از طرح آموزشی معرفی
        </Button>
        {nodes.map((n, i) => (
          <fieldset className="funnel-stage-editor" key={n.id}>
            <legend>مرحله {fa(i + 1)}</legend>
            <Text
              label="نام مرحله حلقه"
              value={n.name}
              onChange={(name) => update(n.id, { name })}
            />
            <Text
              label="شرح مرحله حلقه"
              value={n.description}
              onChange={(description) => update(n.id, { description })}
            />
            <Owner
              value={n.ownerRoleId}
              onChange={(ownerRoleId) => update(n.id, { ownerRoleId })}
            />
            <Select
              label="شاخص مرحله حلقه"
              value={n.metricId}
              items={metrics}
              empty="بدون شاخص"
              onChange={(metricId) => update(n.id, { metricId })}
            />
            <Select
              label="کانال مرحله حلقه"
              value={n.linkedChannelId}
              items={Object.fromEntries(d.channels.map((c) => [c.id, c.name]))}
              empty="بدون کانال"
              onChange={(linkedChannelId) => update(n.id, { linkedChannelId })}
            />
            <Select
              label="مرحله قیف مرتبط حلقه"
              value={n.linkedFunnelStageId}
              items={Object.fromEntries(
                funnelData(store)
                  .stages.filter((s) => s.active)
                  .map((s) => [s.id, s.name]),
              )}
              empty="بدون قیف"
              onChange={(linkedFunnelStageId) =>
                update(n.id, { linkedFunnelStageId })
              }
            />
            <div className="scale-actions">
              <Button secondary disabled={i === 0} onClick={() => move(i, -1)}>
                بالا بردن {n.name}
              </Button>
              <Button
                secondary
                disabled={i === nodes.length - 1}
                onClick={() => move(i, 1)}
              >
                پایین بردن {n.name}
              </Button>
              <Button
                secondary
                onClick={() => setNodes(nodes.filter((x) => x.id !== n.id))}
              >
                غیرفعال‌کردن {n.name}
              </Button>
            </div>
          </fieldset>
        ))}
        <Button
          secondary
          onClick={() => setNodes([...nodes, N.newNode(l.id, nodes.length)])}
        >
          افزودن مرحله حلقه
        </Button>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره حلقه</Button>
      </form>
    </Drawer>
  );
}
export function LoopPeriodEditor({
  initial,
  close,
}: {
  initial: N.GrowthLoopPeriod;
  close: () => void;
}) {
  const { store, commit } = useScale(),
    d = N.networkData(store),
    [p, setP] = useState(initial),
    [message, setMessage] = useState(""),
    locked = p.status === "completed",
    nodes =
      p.snapshot?.nodes ??
      d.nodes
        .filter((n) => n.loopId === p.loopId && n.active)
        .sort((a, b) => a.order - b.order),
    set = (k: keyof N.GrowthLoopPeriod, v: unknown) => setP({ ...p, [k]: v });
  return (
    <Drawer
      open
      onClose={close}
      title="دوره اندازه‌گیری حلقه"
      description="خروجی ثبت‌شده را از ادعای قدرت یا علت اثر جدا نگه دارید."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(U.saveLoopPeriod(store, p));
            setMessage("پیش‌نویس ذخیره شد.");
          } catch (x) {
            setMessage((x as Error).message);
          }
        }}
      >
        <fieldset disabled={locked}>
          <Field label="شروع دوره حلقه">
            <input
              type="date"
              value={p.periodStart}
              onInput={(e) => set("periodStart", e.currentTarget.value)}
            />
          </Field>
          <Field label="پایان دوره حلقه">
            <input
              type="date"
              value={p.periodEnd}
              onInput={(e) => set("periodEnd", e.currentTarget.value)}
            />
          </Field>
          <Numeric
            label="حجم ورودی حلقه"
            value={p.inputVolume}
            onChange={(v) => set("inputVolume", v)}
          />
          <Numeric
            label="خروجی شاخص اصلی حلقه"
            value={p.outputMetric}
            onChange={(v) => set("outputMetric", v)}
          />
          <Numeric
            label="زمان چرخه مشاهده‌شده (روز)"
            value={p.cycleTime}
            onChange={(v) => set("cycleTime", v)}
          />
          {nodes.map((n) => (
            <Numeric
              key={n.id}
              label={`مشاهده ${n.name}`}
              value={
                p.nodeMeasurements.find((m) => m.nodeId === n.id)?.value ?? null
              }
              onChange={(value) =>
                set("nodeMeasurements", [
                  ...p.nodeMeasurements.filter((m) => m.nodeId !== n.id),
                  { nodeId: n.id, value },
                ])
              }
            />
          ))}
          <Text
            label="منبع و یادداشت دوره حلقه"
            value={p.note}
            area
            onChange={(v) => set("note", v)}
          />
        </fieldset>
        {p.snapshot && (
          <p>
            سابقه: {p.snapshot.loop.name} · {p.snapshot.metricName} ·{" "}
            {p.snapshot.metricUnit}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {!locked && (
          <div className="scale-actions">
            <Button type="submit">ذخیره پیش‌نویس حلقه</Button>
            <Button
              onClick={() => {
                try {
                  const saved = U.saveLoopPeriod(store, p),
                    n = U.completeLoopPeriod(saved, p.id);
                  commit(saved);
                  commit(n);
                  setP(n.networkData!.loopPeriods.find((x) => x.id === p.id)!);
                  setMessage("دوره حلقه تکمیل و ثابت شد.");
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              تکمیل دوره حلقه
            </Button>
          </div>
        )}
      </form>
    </Drawer>
  );
}
