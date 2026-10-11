"use client";
import { useState } from "react";
import { Button, Drawer, Panel, Field } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Numeric, Owner, fa } from "./shared";
import { funnelData } from "@/lib/scale/funnel/model";
import * as N from "@/lib/scale/network/model";
import * as U from "@/lib/scale/network/mutations";
import * as L from "@/lib/scale/network/logic";
export function ChannelEditor({
  initial,
  close,
}: {
  initial: N.GrowthChannel;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    [c, setC] = useState(initial),
    [error, setError] = useState(""),
    set = (k: keyof N.GrowthChannel, v: unknown) => setC({ ...c, [k]: v });
  return (
    <Drawer
      open
      onClose={close}
      title="تعریف کانال"
      description="وضعیت و بلوغ از مسیر تصمیم مستند تغییر می‌کنند."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(U.saveChannel(store, c));
            close();
          } catch (x) {
            setError((x as Error).message);
          }
        }}
      >
        <Text
          label="نام کانال"
          value={c.name}
          onChange={(v) => set("name", v)}
          required
        />
        <Select
          label="دسته کانال"
          value={c.category}
          items={N.channelCategories}
          onChange={(v) => set("category", v)}
        />
        <Text
          label="شرح کانال"
          value={c.description}
          area
          onChange={(v) => set("description", v)}
        />
        <Owner value={c.ownerRoleId} onChange={(v) => set("ownerRoleId", v)} />
        <Text
          label="مخاطب هدف"
          value={c.targetAudience}
          onChange={(v) => set("targetAudience", v)}
        />
        <Select
          label="اهرم مرتبط کانال"
          value={c.linkedLeverId}
          onChange={(v) => set("linkedLeverId", v)}
          empty="بدون پیوند"
          items={Object.fromEntries(store.levers.map((l) => [l.id, l.name]))}
        />
        <Select
          label="مرحله ورود به قیف"
          value={c.funnelStageId}
          onChange={(v) => set("funnelStageId", v)}
          empty="بدون پیوند"
          items={Object.fromEntries(
            funnelData(store)
              .stages.filter((s) => s.active)
              .map((s) => [s.id, s.name]),
          )}
        />
        <Select
          label="هدف استراتژی مرتبط"
          value={c.strategyObjectiveId}
          onChange={(v) => set("strategyObjectiveId", v)}
          empty="بدون پیوند"
          items={Object.fromEntries(
            sources.objectives.map((o) => [o.id, o.title]),
          )}
        />
        <Select
          label="نتیجه کلیدی مرتبط"
          value={c.strategyKRId}
          onChange={(v) => set("strategyKRId", v)}
          empty="بدون پیوند"
          items={Object.fromEntries(
            sources.keyResults.map((k) => [k.id, k.title]),
          )}
        />
        <Select
          label="فرآیند ظرفیت مرتبط"
          value={c.systemProcessId}
          onChange={(v) => set("systemProcessId", v)}
          empty="بدون پیوند"
          items={Object.fromEntries(
            sources.processes.map((p) => [p.id, p.name]),
          )}
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره کانال</Button>
      </form>
    </Drawer>
  );
}
export function ChannelPeriodEditor({
  initial,
  close,
}: {
  initial: N.ChannelPeriodMeasurement;
  close: () => void;
}) {
  const { store, sources, commit } = useScale(),
    [p, setP] = useState(initial),
    [message, setMessage] = useState(""),
    locked = p.status === "completed",
    set = (k: keyof N.ChannelPeriodMeasurement, v: unknown) =>
      setP({ ...p, [k]: v }),
    perf = L.channelPerformance(p);
  return (
    <Drawer
      open
      onClose={close}
      title={locked ? "دوره تاریخی کانال" : "ثبت دوره کانال"}
      description="فیلد نامرتبط را خالی بگذارید؛ صفر با ناشناخته متفاوت است."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(U.saveChannelPeriod(store, p));
            setMessage("پیش‌نویس ذخیره شد.");
          } catch (x) {
            setMessage((x as Error).message);
          }
        }}
      >
        <fieldset disabled={locked}>
          <div className="funnel-fields">
            <Field label="شروع دوره کانال">
              <input
                type="date"
                required
                value={p.periodStart}
                onInput={(e) => set("periodStart", e.currentTarget.value)}
              />
            </Field>
            <Field label="پایان دوره کانال">
              <input
                type="date"
                required
                value={p.periodEnd}
                onInput={(e) => set("periodEnd", e.currentTarget.value)}
              />
            </Field>
            <Select
              label="تناوب دوره"
              value={p.cadence}
              items={{ weekly: "هفتگی", monthly: "ماهانه", custom: "سفارشی" }}
              onChange={(v) => set("cadence", v)}
            />
            <Select
              label="نوع انتساب دستی"
              value={p.attribution}
              items={{ primary: "منبع اصلی", assisted: "کمک‌کننده / اثرگذار" }}
              onChange={(v) => set("attribution", v)}
            />
            <Text
              label="واحد پول دوره"
              value={p.currency}
              onChange={(v) => set("currency", v)}
            />
            {Object.entries(N.metricNames).map(([k, label]) => (
              <Numeric
                key={k}
                label={label}
                value={p[k as keyof N.ChannelValues]}
                onChange={(v) => set(k as keyof N.ChannelValues, v)}
              />
            ))}
            <Numeric
              label="حجم منتسب به مرحله ورودی قیف"
              value={p.contributedVolume}
              onChange={(v) => set("contributedVolume", v)}
            />
          </div>
          <p>
            حجم منتسب را با تعریف مرحله ورودی و همین دوره تطبیق دهید؛ جمع
            کمک‌کننده‌ها با منابع اصلی انجام نمی‌شود.
          </p>
          <Text
            label="منبع داده کانال"
            value={p.source}
            onChange={(v) => set("source", v)}
          />
          <Text
            label="یادداشت دوره کانال"
            area
            value={p.note}
            onChange={(v) => set("note", v)}
          />
          <h3>شاخص‌های سفارشی</h3>
          {p.customMetrics.map((m, i) => (
            <div className="funnel-fields" key={i}>
              <Text
                label={`نام شاخص سفارشی ${i + 1}`}
                value={m.name}
                onChange={(name) =>
                  set(
                    "customMetrics",
                    p.customMetrics.map((x, j) =>
                      i === j ? { ...x, name } : x,
                    ),
                  )
                }
              />
              <Text
                label={`واحد شاخص سفارشی ${i + 1}`}
                value={m.unit}
                onChange={(unit) =>
                  set(
                    "customMetrics",
                    p.customMetrics.map((x, j) =>
                      i === j ? { ...x, unit } : x,
                    ),
                  )
                }
              />
              <Numeric
                label={`مقدار شاخص سفارشی ${i + 1}`}
                value={m.value}
                onChange={(value) =>
                  set(
                    "customMetrics",
                    p.customMetrics.map((x, j) =>
                      i === j ? { ...x, value } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          <Button
            secondary
            onClick={() =>
              set("customMetrics", [
                ...p.customMetrics,
                { name: "", unit: "", value: null },
              ])
            }
          >
            افزودن شاخص سفارشی دوره
          </Button>
        </fieldset>
        <p>
          نرخ واجد شرایط {fa(perf.qualification)}٪ · تبدیل لید به مشتری{" "}
          {fa(perf.conversion)}٪ · تبدیل واجد شرایط به مشتری{" "}
          {fa(perf.qualifiedConversion)}٪
        </p>
        <p>
          هزینه جذب ثبت‌شده به ازای مشتری {fa(perf.spendPerCustomer)}{" "}
          {p.currency}؛ این عدد CAC کامل نیست.
        </p>
        {p.snapshot && (
          <p>
            سابقه: {p.snapshot.name} ·{" "}
            {N.channelCategories[p.snapshot.category]} · نقش مالک:{" "}
            {sources.roles.find((r) => r.id === p.snapshot?.ownerRoleId)
              ?.title ?? "نقش تاریخی در دسترس نیست"}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {!locked && (
          <div className="scale-actions">
            <Button type="submit">ذخیره پیش‌نویس کانال</Button>
            <Button
              onClick={() => {
                try {
                  const saved = U.saveChannelPeriod(store, p),
                    n = U.completeChannelPeriod(saved, p.id);
                  commit(saved);
                  commit(n);
                  setP(
                    n.networkData!.channelPeriods.find((x) => x.id === p.id)!,
                  );
                  setMessage("دوره کانال تکمیل و ثابت شد.");
                } catch (x) {
                  setMessage((x as Error).message);
                }
              }}
            >
              تکمیل دوره کانال
            </Button>
          </div>
        )}
      </form>
    </Drawer>
  );
}
export function ChannelDecisionEditor({
  channel: c,
}: {
  channel: N.GrowthChannel;
}) {
  const { store, sources, commit } = useScale(),
    [decision, setDecision] =
      useState<keyof typeof N.channelDecisions>("continue"),
    [status, setStatus] = useState(c.status),
    [maturity, setMaturity] = useState(c.maturity),
    [reason, setReason] = useState(""),
    [review, setReview] = useState(""),
    [capacity, setCapacity] = useState(false),
    [economics, setEconomics] = useState(false),
    [message, setMessage] = useState("");
  return (
    <Panel
      title="تصمیم مدیریت درباره کانال"
      caption="عملکرد، بلوغ و وضعیت سه مفهوم جدا هستند؛ تصمیم جدید سابقه قبلی را پاک نمی‌کند."
    >
      <Select
        label="تصمیم کانال"
        value={decision}
        items={N.channelDecisions}
        onChange={(v) => setDecision(v as typeof decision)}
      />
      <Select
        label="وضعیت پس از تصمیم"
        value={status}
        items={N.channelStatuses}
        onChange={(v) => setStatus(v as typeof status)}
      />
      <Select
        label="بلوغ پس از تصمیم"
        value={maturity}
        items={N.maturities}
        onChange={(v) => setMaturity(v as typeof maturity)}
      />
      <Text label="دلیل تصمیم کانال" value={reason} onChange={setReason} area />
      <Text label="مرور شواهد تصمیم" value={review} onChange={setReview} area />
      <label>
        <input
          type="checkbox"
          checked={capacity}
          onChange={(e) => setCapacity(e.target.checked)}
        />{" "}
        ظرفیت سیستم را بررسی کردم
      </label>
      <label>
        <input
          type="checkbox"
          checked={economics}
          onChange={(e) => setEconomics(e.target.checked)}
        />{" "}
        اقتصاد و محدودیت انتساب را بررسی کردم
      </label>
      <Button
        onClick={() => {
          try {
            const context = sources.capacity
              .filter((p) => p.id === c.systemProcessId)
              .map(
                (p) =>
                  `${p.title}: سلامت ${fa(p.health)}، استقلال ${fa(p.independence)}؛ ${p.reasons.join("، ")}`,
              )
              .join("\n");
            commit(
              U.recordChannelDecision(store, {
                channelId: c.id,
                decision,
                reason,
                ownerRoleId: c.ownerRoleId,
                status,
                maturity,
                capacityReviewed: capacity,
                economicsReviewed: economics,
                sourceReview: review + (context ? "\n" + context : ""),
              }),
            );
            setMessage("تصمیم مستند ثبت شد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        ثبت تصمیم کانال
      </Button>
      {message && <p role="status">{message}</p>}
    </Panel>
  );
}
