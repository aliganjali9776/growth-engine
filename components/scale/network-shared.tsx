"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Panel } from "@/components/system/ui";
import { useScale } from "./provider";
import { Select, fa } from "./shared";
import * as N from "@/lib/scale/network/model";
import * as U from "@/lib/scale/network/mutations";
import * as L from "@/lib/scale/network/logic";
import { experimentData, results } from "@/lib/scale/experiments/model";
export function NetworkEntityContext({
  kind,
  entityId,
}: {
  kind: N.NetworkLink["kind"];
  entityId: string;
}) {
  const { store, commit } = useScale(),
    d = N.networkData(store),
    [channelId, setChannel] = useState(""),
    [loopId, setLoop] = useState(""),
    [nodeId, setNode] = useState(""),
    [message, setMessage] = useState(""),
    e = experimentData(store).experiments.find((e) => e.id === entityId),
    locked =
      kind === "experiment" && !!(e?.startedAt || e?.status === "cancelled");
  return (
    <Panel
      title="ارتباط با کانال و حلقه رشد"
      caption="ارتباط شواهد به معنی انتساب خودکار اثر نیست."
    >
      <div className="funnel-fields">
        <Select
          label="کانال مرتبط"
          value={channelId}
          onChange={setChannel}
          empty="بدون کانال"
          items={Object.fromEntries(
            d.channels.filter((c) => c.active).map((c) => [c.id, c.name]),
          )}
        />
        <Select
          label="حلقه مرتبط"
          value={loopId}
          onChange={(v) => {
            setLoop(v);
            setNode("");
          }}
          empty="بدون حلقه"
          items={Object.fromEntries(
            d.loops
              .filter((l) => l.status !== "archived")
              .map((l) => [l.id, l.name]),
          )}
        />
        {loopId && (
          <Select
            label="مرحله هدف حلقه"
            value={nodeId}
            onChange={setNode}
            empty="کل حلقه"
            items={Object.fromEntries(
              d.nodes
                .filter((n) => n.loopId === loopId && n.active)
                .map((n) => [n.id, n.name]),
            )}
          />
        )}
      </div>
      <Button
        secondary
        disabled={locked}
        onClick={() => {
          try {
            commit(
              U.saveNetworkLink(store, {
                kind,
                entityId,
                channelId,
                loopId,
                nodeId,
                leakageId: "",
              }),
            );
            setMessage("ارتباط ثبت شد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        ثبت ارتباط کانال / حلقه
      </Button>
      {locked && (
        <p>پیوند آزمایش شروع‌شده ثابت است؛ نسخه جدید را هدف‌گذاری کنید.</p>
      )}
      {message && <p role="status">{message}</p>}
      {d.links
        .filter((l) => l.kind === kind && l.entityId === entityId)
        .map((l) => (
          <p key={l.id}>
            {l.channelId && (
              <Link href={`/scale/channels/${l.channelId}`}>
                {d.channels.find((c) => c.id === l.channelId)?.name}
              </Link>
            )}
            {" · "}
            {l.loopId && (
              <Link href={`/scale/loops/${l.loopId}`}>
                {d.loops.find((x) => x.id === l.loopId)?.name}
              </Link>
            )}
            {l.nodeId && ` · ${d.nodes.find((n) => n.id === l.nodeId)?.name}`}
          </p>
        ))}
    </Panel>
  );
}
export function NetworkRelations({
  channelId,
  loopId,
}: {
  channelId?: string;
  loopId?: string;
}) {
  const { store, commit } = useScale(),
    d = N.networkData(store),
    ed = experimentData(store),
    links = d.links.filter(
      (l) =>
        (channelId ? l.channelId === channelId : true) &&
        (loopId ? l.loopId === loopId : true),
    ),
    [learning, setLearning] = useState(""),
    [message, setMessage] = useState("");
  return (
    <Panel title="شواهد، آزمایش‌ها و یادگیری مرتبط">
      {links.map((l) => {
        const collection =
          l.kind === "constraint"
            ? store.constraints
            : l.kind === "idea"
              ? store.ideas
              : l.kind === "experiment"
                ? ed.experiments
                : ed.learnings;
        const item = collection.find((e) => e.id === l.entityId);
        if (l.kind === "learning") {
          const learn = ed.learnings.find((x) => x.id === l.entityId);
          return (
            <blockquote key={l.id}>
              {learn?.statement}
              <p>{learn?.reusableInsight}</p>
              <Link href={`/scale/experiments/${learn?.experimentId}`}>
                منبع یادگیری
              </Link>
            </blockquote>
          );
        }
        const exp =
          l.kind === "experiment"
            ? ed.experiments.find((e) => e.id === l.entityId)
            : null;
        return (
          <article key={l.id}>
            <Link
              href={`/scale/${l.kind === "constraint" ? "constraints" : l.kind === "idea" ? "ideas" : "experiments"}/${l.entityId}`}
            >
              {item && "title" in item ? item.title : "منبع مرتبط"}
            </Link>
            {exp && (
              <>
                <p>
                  {exp.resultStatus
                    ? results[exp.resultStatus]
                    : "نتیجه ثبت نشده"}
                </p>
                {ed.learnings
                  .filter((x) => x.experimentId === exp.id)
                  .map((x) => (
                    <blockquote key={x.id}>{x.statement}</blockquote>
                  ))}
              </>
            )}
          </article>
        );
      })}
      {!links.length && <p>شواهد مرتبطی ثبت نشده است.</p>}
      <Select
        label="یادگیری موجود برای اتصال"
        value={learning}
        onChange={setLearning}
        empty="انتخاب یادگیری آزمایش"
        items={Object.fromEntries(ed.learnings.map((l) => [l.id, l.statement]))}
      />
      <Button
        secondary
        disabled={!learning}
        onClick={() => {
          try {
            commit(
              U.saveNetworkLink(store, {
                kind: "learning",
                entityId: learning,
                channelId: channelId ?? "",
                loopId: loopId ?? "",
                nodeId: "",
                leakageId: "",
              }),
            );
            setMessage("یادگیری موجود متصل شد؛ نسخه تکراری ساخته نشد.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        اتصال یادگیری
      </Button>
      {message && <p role="status">{message}</p>}
    </Panel>
  );
}
export function ChannelFunnelContribution({ stageId }: { stageId: string }) {
  const { store } = useScale(),
    d = N.networkData(store),
    ps = d.channelPeriods.filter(
      (p) => p.status === "completed" && p.snapshot?.funnelStageId === stageId,
    );
  return (
    <details>
      <summary>مشارکت گزارش‌شده کانال‌ها</summary>
      <p>
        دستی و جدا از شمارش قیف؛ اعداد دوره‌های متفاوت یا کمک‌کننده‌ها جمع
        نمی‌شوند.
      </p>
      {ps.map((p) => (
        <p key={p.id}>
          <Link href={`/scale/channels/${p.channelId}`}>
            {p.snapshot?.name}
          </Link>{" "}
          · {p.periodStart} تا {p.periodEnd} ·{" "}
          {p.attribution === "primary" ? "اصلی" : "کمک‌کننده"} · حجم{" "}
          {fa(p.contributedVolume)}
        </p>
      ))}
      {!ps.length && <p>مشارکتی برای این مرحله گزارش نشده است.</p>}
    </details>
  );
}
export function NetworkSummary() {
  const { store, sources } = useScale(),
    d = N.networkData(store),
    latest = d.channelPeriods
      .filter((p) => p.status === "completed")
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0],
    summary = L.channelPortfolioSummary(
      store,
      latest ? latest.periodStart + "|" + latest.periodEnd : "",
    ),
    loops = L.loopPortfolioSummary(store),
    top = d.channels.find((c) => c.id === summary.concentration.channelId);
  return (
    <Panel
      title="کانال‌ها و حلقه‌های رشد"
      caption="قیف می‌گوید مشتری چگونه ساخته می‌شود؛ حلقه می‌گوید خروجی چگونه ورودی رشد بعدی را می‌سازد."
    >
      <p>
        بیشترین سهم تقاضای ثبت‌شده: {top?.name ?? "نامشخص"} · سهم{" "}
        {fa(summary.concentration.top)}٪ · کانال در حال توسعه{" "}
        {fa(summary.scaling)} · حلقه فعال {fa(loops.active)}
      </p>
      {(summary.concentration.top ?? 0) >= 70 && (
        <p>تمرکز تقاضای واجد شرایط روی یک کانال زیاد است.</p>
      )}
      {summary.concentration.partial && (
        <p>پوشش داده هم‌دوره ناقص است؛ سهم نمایش‌داده‌شده فقط از کانال‌های دارای داده محاسبه شده است.</p>
      )}
      <p>
        حلقه نوظهور: {loops.emerging.map((l) => l.name).join("، ") || "نداریم"}{" "}
        · حلقه ضعیف: {loops.weak.map((l) => l.name).join("، ") || "نداریم"}
      </p>
      {summary.recentDecision && (
        <p>
          آخرین تصمیم: {summary.recentDecision.channelName} ·{" "}
          {N.channelDecisions[summary.recentDecision.decision]} ·{" "}
          {summary.recentDecision.reason}
        </p>
      )}
      {d.channels
        .filter((c) => c.active)
        .flatMap((c) =>
          L.channelNeedsAttention(
            store,
            c,
            sources.roles.map((r) => r.id),
          ).map((t) => (
            <p key={c.id + t}>
              {c.name}: {t}
            </p>
          )),
        )}
      {d.loops
        .filter((l) => l.status !== "archived")
        .flatMap((l) =>
          L.loopNeedsAttention(
            store,
            l,
            sources.roles.map((r) => r.id),
          ).map((t) => (
            <p key={l.id + t}>
              {l.name}: {t}
            </p>
          )),
        )}
      <div className="scale-actions">
        <Link href="/scale/channels">سبد کانال‌ها</Link>
        <Link href="/scale/loops">حلقه‌های رشد</Link>
      </div>
    </Panel>
  );
}
