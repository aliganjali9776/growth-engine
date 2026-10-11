"use client";
import { ReadinessEntry } from "./readiness-shared";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel, PageTitle } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, fa } from "./shared";
import * as N from "@/lib/scale/network/model";
import * as L from "@/lib/scale/network/logic";
import * as U from "@/lib/scale/network/mutations";
import { experimentData } from "@/lib/scale/experiments/model";
import { funnelData } from "@/lib/scale/funnel/model";
import { LoopEditor, LoopPeriodEditor } from "./loop-editors";
import { MetricEditor } from "./experiment-editor";
import { NetworkRelations } from "./network-shared";
const strengthLabels: Record<string, string> = {
  unproven: "اثبات‌نشده",
  weak: "ضعیف",
  emerging: "نوظهور",
  repeatable: "تکرارپذیر",
  strong: "قوی",
};
export function Loops({ id }: { id?: string }) {
  const { store, sources } = useScale(),
    d = N.networkData(store),
    l = d.loops.find((l) => l.id === id),
    [edit, setEdit] = useState<N.GrowthLoop | null>(null),
    [metric, setMetric] = useState(false),
    [period, setPeriod] = useState<N.GrowthLoopPeriod | null>(null);
  if (id && !l)
    return (
      <Panel title="حلقه پیدا نشد">
        <Link href="/scale/loops">بازگشت به حلقه‌ها</Link>
      </Panel>
    );
  const nodes = l
      ? d.nodes
          .filter((n) => n.loopId === l.id && n.active)
          .sort((a, b) => a.order - b.order)
      : [],
    readiness = l
      ? L.loopReadiness(
          store,
          l,
          sources.roles.map((r) => r.id),
        )
      : null,
    strength = l ? L.loopStrength(store, l) : null,
    trend = l ? L.loopTrend(d, l.id) : null;
  return (
    <>
      <PageTitle
        title={l ? l.name : "حلقه‌های رشد"}
        description="قیف: مشتری چگونه ایجاد می‌شود؟ حلقه: چگونه خروجی رشد، ورودی رشد بعدی را می‌سازد؟"
        onAdd={() => setEdit(l ?? N.newLoop())}
        addLabel={l ? "ویرایش طراحی حلقه" : "حلقه جدید"}
      />
      <Button secondary onClick={() => setMetric(true)}>
        تعریف شاخص حلقه
      </Button>
      {l ? (
        <>
          <ReadinessEntry type="loop" id={l.id} />
          <p>
            {N.loopTypes[l.type]} · {N.loopStatuses[l.status]} · مالک{" "}
            {sources.roles.find((r) => r.id === l.ownerRoleId)?.title ??
              "نامشخص"}
          </p>
          <Panel title="فرضیه و بازگشت خروجی">
            <p>{l.hypothesis || "فرضیه ثبت نشده است."}</p>
            <dl>
              <dt>ورودی</dt>
              <dd>{l.input || "نامشخص"}</dd>
              <dt>ارزش / اقدام</dt>
              <dd>{l.valueCreated || "نامشخص"}</dd>
              <dt>خروجی</dt>
              <dd>{l.output || "نامشخص"}</dd>
              <dt>ساخت ورودی بعدی</dt>
              <dd>{l.reentry || "سازوکار بازگشت تعریف نشده است."}</dd>
            </dl>
            <p>
              وابستگی:{" "}
              {l.dependency || "موردی ثبت نشده؛ نبود ثبت به معنی استقلال نیست."}
            </p>
          </Panel>
          <Panel title="ساختار حلقه">
            <ol className="network-loop">
              {nodes.map((n) => (
                <li key={n.id}>
                  <strong>{n.name}</strong>
                  <p>{n.description}</p>
                  <p>
                    {sources.roles.find((r) => r.id === n.ownerRoleId)?.title ??
                      "بدون مالک مرحله"}{" "}
                    ·{" "}
                    {experimentData(store).metrics.find(
                      (m) => m.id === n.metricId,
                    )?.name ?? "شاخص مرحله انتخاب نشده"}
                  </p>
                  {n.linkedChannelId && (
                    <Link href={`/scale/channels/${n.linkedChannelId}`}>
                      {d.channels.find((c) => c.id === n.linkedChannelId)?.name}
                    </Link>
                  )}
                  {n.linkedFunnelStageId && (
                    <p>
                      قیف:{" "}
                      {
                        funnelData(store).stages.find(
                          (s) => s.id === n.linkedFunnelStageId,
                        )?.name
                      }
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p>بازگشت به ورودی: {l.reentry || "هنوز تعریف نشده"}</p>
          </Panel>
          <Panel title="قدرت، آمادگی و شاخص اصلی">
            <h3>{strengthLabels[strength!.state]}</h3>
            <p>{strength?.reason}</p>
            <p>
              شاخص اصلی:{" "}
              {experimentData(store).metrics.find(
                (m) => m.id === l.primaryOutputMetricId,
              )?.name ?? "نامشخص"}{" "}
              · سطح شواهد اظهارشده: {N.evidenceLevels[l.evidenceLevel]}
            </p>
            <p>
              خروجی اخیر {fa(trend?.current)} · قبل {fa(trend?.previous)} ·
              تغییر {fa(trend?.delta)} · خروجی / ورودی {fa(trend?.rate)}٪ · زمان
              چرخه {fa(trend?.cycleTime ?? l.loopCycleTime)} روز
            </p>
            <p>
              نسبت خروجی به ورودی ضریب وایرال یا اثبات بازتولید نیست؛ تعریف
              شاخص‌ها باید سازگار باشد.
            </p>
            {Object.entries(readiness!.parts).map(([k, v]) => (
              <p key={k}>
                {
                  (
                    {
                      structure: "ساختار",
                      owner: "مالک",
                      metric: "شاخص اصلی",
                      evidence: "شواهد",
                      reentry: "بازگشت خروجی",
                    } as Record<string, string>
                  )[k]
                }
                : {v ? "موجود" : "ناقص"}
              </p>
            ))}
            <p>
              تاریخچه: {N.loopPeriods(d, l.id).length ? "موجود" : "ناموجود"}
            </p>
            {L.loopNeedsAttention(
              store,
              l,
              sources.roles.map((r) => r.id),
            ).map((t) => (
              <p className="scale-notice" key={t}>
                {t}
              </p>
            ))}
          </Panel>
          <LoopEvidencePanel loopId={l.id} />
          <LeakagePanel loopId={l.id} />
          <NetworkRelations loopId={l.id} />
          <Panel
            title="تاریخچه حلقه"
            action={
              <Button
                onClick={() =>
                  setPeriod({
                    id: N.id(),
                    loopId: l.id,
                    periodStart: "",
                    periodEnd: "",
                    status: "draft",
                    nodeMeasurements: nodes.map((n) => ({
                      nodeId: n.id,
                      value: null,
                    })),
                    outputMetric: null,
                    inputVolume: null,
                    cycleTime: null,
                    note: "",
                    createdAt: N.now(),
                  })
                }
              >
                دوره جدید حلقه
              </Button>
            }
            caption="قضاوت روند برای دوره‌های قابل‌مقایسه است؛ تغییر تعریف شاخص، سابقه قبلی را بازنویسی نمی‌کند."
          >
            {d.loopPeriods
              .filter((p) => p.loopId === l.id)
              .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
              .map((p) => (
                <article className="funnel-period" key={p.id}>
                  <h3>
                    {p.periodStart} — {p.periodEnd} ·{" "}
                    {p.status === "completed" ? "تکمیل‌شده" : "پیش‌نویس"}
                  </h3>
                  <p>
                    {p.snapshot?.loop.name ?? l.name} ·{" "}
                    {p.snapshot?.metricName ?? "شاخص فعلی"} · خروجی{" "}
                    {fa(p.outputMetric)} {p.snapshot?.metricUnit} · چرخه{" "}
                    {fa(p.cycleTime)} روز
                  </p>
                  {L.loopNodeRates(p).map((n) => (
                    <p key={n.nodeId}>
                      {n.name}: {fa(n.value)} · نسبت به مرحله قبل {fa(n.rate)}٪
                    </p>
                  ))}
                  <p>{p.note}</p>
                  <Button secondary onClick={() => setPeriod(p)}>
                    مشاهده / ویرایش دوره حلقه
                  </Button>
                </article>
              ))}
          </Panel>
        </>
      ) : (
        <div className="funnel-cards">
          {d.loops.map((l) => (
            <article key={l.id}>
              <h3>
                <Link href={`/scale/loops/${l.id}`}>{l.name}</Link>
              </h3>
              <p>
                {N.loopTypes[l.type]} · {N.loopStatuses[l.status]}
              </p>
              <p>
                {strengthLabels[L.loopStrength(store, l).state]} ·{" "}
                {sources.roles.find((r) => r.id === l.ownerRoleId)?.title ??
                  "بدون مالک"}
              </p>
              <p>
                {experimentData(store).metrics.find(
                  (m) => m.id === l.primaryOutputMetricId,
                )?.name ?? "بدون شاخص"}{" "}
                · {N.evidenceLevels[l.evidenceLevel]}
              </p>
              <p>
                خروجی {fa(L.loopTrend(d, l.id).current)} · تغییر{" "}
                {fa(L.loopTrend(d, l.id).delta)}
              </p>
            </article>
          ))}
        </div>
      )}
      {edit && <LoopEditor initial={edit} close={() => setEdit(null)} />}{" "}
      {period && (
        <LoopPeriodEditor initial={period} close={() => setPeriod(null)} />
      )}{" "}
      {metric && <MetricEditor close={() => setMetric(false)} />}
    </>
  );
}
function LoopEvidencePanel({ loopId }: { loopId: string }) {
  const { store, commit } = useScale(),
    d = N.networkData(store),
    [type, setType] = useState<keyof typeof N.evidenceSources>("observation"),
    [sourceId, setSource] = useState(""),
    [text, setText] = useState(""),
    [message, setMessage] = useState("");
  const sources =
    type === "channel"
      ? Object.fromEntries(
          d.channelPeriods
            .filter((p) => p.status === "completed")
            .map((p) => [
              p.id,
              `${p.snapshot?.name} · ${p.periodStart} تا ${p.periodEnd}`,
            ]),
        )
      : type === "funnel"
        ? Object.fromEntries(
            funnelData(store)
              .periods.filter((p) => p.status === "completed")
              .map((p) => [p.id, p.label || p.periodEnd]),
          )
        : type === "experiment"
          ? Object.fromEntries(
              experimentData(store)
                .experiments.filter((e) => e.status === "completed")
                .map((e) => [e.id, e.title]),
            )
          : {};
  return (
    <Panel title="شواهد حلقه">
      <Select
        label="نوع شواهد حلقه"
        value={type}
        items={N.evidenceSources}
        onChange={(v) => {
          setType(v as typeof type);
          setSource("");
        }}
      />
      {["channel", "funnel", "experiment"].includes(type) && (
        <Select
          label="منبع شواهد حلقه"
          value={sourceId}
          onChange={setSource}
          items={sources}
          empty="انتخاب سابقه تکمیل‌شده"
        />
      )}
      <Text label="شرح شواهد حلقه" value={text} onChange={setText} area />
      <Button
        onClick={() => {
          try {
            commit(U.addEvidence(store, { loopId, type, sourceId, text }));
            setText("");
            setMessage("شواهد ثبت شد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        ثبت شواهد حلقه
      </Button>
      {message && <p role="status">{message}</p>}
      {d.evidence
        .filter((e) => e.loopId === loopId)
        .map((e) => (
          <blockquote key={e.id}>
            {e.text}
            <p>
              {N.evidenceSources[e.type]} ·{" "}
              {new Date(e.createdAt).toLocaleDateString("fa-IR", {
                timeZone: "Asia/Tehran",
              })}
            </p>
          </blockquote>
        ))}
    </Panel>
  );
}
function LeakagePanel({ loopId }: { loopId: string }) {
  const { store, commit } = useScale(),
    d = N.networkData(store),
    [nodeId, setNode] = useState(""),
    [description, setDescription] = useState(""),
    [severity, setSeverity] = useState<N.LoopLeakage["severity"]>("medium"),
    [message, setMessage] = useState("");
  function action(fn: () => void) {
    try {
      fn();
      setMessage("تغییر ثبت شد؛ گلوگاه اصلی تغییر نکرد.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <Panel title="نشتی و فرصت مداخله">
      <Select
        label="مرحله نشتی"
        value={nodeId}
        onChange={setNode}
        empty="انتخاب مرحله"
        items={Object.fromEntries(
          d.nodes
            .filter((n) => n.loopId === loopId && n.active)
            .map((n) => [n.id, n.name]),
        )}
      />
      <Text
        label="شرح نشتی"
        area
        value={description}
        onChange={setDescription}
      />
      <Select
        label="شدت نشتی"
        value={severity}
        onChange={(v) => setSeverity(v as typeof severity)}
        items={{
          low: "پایین",
          medium: "متوسط",
          high: "بالا",
          critical: "بحرانی",
        }}
      />
      <Button
        onClick={() =>
          action(() =>
            commit(
              U.addLeakage(store, { loopId, nodeId, description, severity }),
            ),
          )
        }
      >
        ثبت نشتی
      </Button>
      {message && <p role="status">{message}</p>}
      {d.leakage
        .filter((l) => l.loopId === loopId)
        .map((l) => (
          <article className="funnel-period" key={l.id}>
            <strong>
              {d.nodes.find((n) => n.id === l.nodeId)?.name} ·{" "}
              {l.resolved ? "حل‌شده" : "باز"}
            </strong>
            <p>{l.description}</p>
            <div className="scale-actions">
              <Button
                secondary
                onClick={() =>
                  action(() => commit(U.createFromLeakage(store, l.id, "idea")))
                }
              >
                ایجاد ایده از نشتی
              </Button>
              <Button
                secondary
                onClick={() =>
                  action(() =>
                    commit(U.createFromLeakage(store, l.id, "constraint")),
                  )
                }
              >
                ایجاد کاندید گلوگاه از نشتی
              </Button>
              {!l.resolved && (
                <Button
                  secondary
                  onClick={() =>
                    action(() => commit(U.resolveLeakage(store, l.id)))
                  }
                >
                  ثبت حل نشتی
                </Button>
              )}
            </div>
          </article>
        ))}
    </Panel>
  );
}
