"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Drawer, Panel, PageTitle } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Owner, fa } from "./shared";
import * as M from "@/lib/scale/model";
import { ideaPriority, ideaReadiness, ideaQuality } from "@/lib/scale/logic";
import { saveIdea } from "@/lib/scale/persistence";
import { ConvertIdeaButton, ExperimentLinks } from "./experiments";
import { FunnelEntityContext } from "./funnel";
import { NetworkEntityContext } from "./network-shared";
import { IdeaDecision } from "./experiment-review";
function Editor({
  initial,
  quick,
  close,
}: {
  initial: M.GrowthIdea;
  quick: boolean;
  close: () => void;
}) {
  const { store, commit } = useScale(),
    [idea, setIdea] = useState(initial),
    [error, setError] = useState("");
  const change = (k: keyof M.GrowthIdea, v: unknown) =>
    setIdea({ ...idea, [k]: v });
  const readiness = ideaReadiness(idea, store);
  return (
    <Drawer
      open
      onClose={close}
      title={quick ? "ثبت سریع ایده" : "تکمیل ایده رشد"}
      description="ایده یک احتمال برای مداخله است، نه نتیجه اثبات‌شده."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(saveIdea(store, idea));
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد");
          }
        }}
      >
        <Text
          required
          label="عنوان ایده"
          value={idea.title}
          onChange={(v) => change("title", v)}
        />
        <Text
          area
          label="شرح کوتاه"
          value={idea.description}
          onChange={(v) => change("description", v)}
        />
        <Select
          label="منبع ایده"
          value={idea.source}
          items={M.ideaSources}
          onChange={(v) => change("source", v)}
        />
        {!quick && (
          <>
            <Select
              label="گلوگاه مرتبط"
              value={idea.constraintId}
              empty="بدون گلوگاه"
              items={Object.fromEntries(
                store.constraints.map((c) => [
                  c.id,
                  `${c.title} · ${M.constraintStatuses[c.status]}`,
                ]),
              )}
              onChange={(v) => change("constraintId", v)}
            />
            <Select
              label="اهرم رشد"
              value={idea.leverId}
              empty="بدون اهرم"
              items={Object.fromEntries(
                store.levers
                  .filter((l) => l.active || l.id === idea.leverId)
                  .map((l) => [l.id, l.name]),
              )}
              onChange={(v) => change("leverId", v)}
            />
            <Text
              area
              label="منطق مداخله (جایگزین اهرم)"
              value={idea.intervention}
              onChange={(v) => change("intervention", v)}
            />
            <Text
              area
              label="چرا ممکن است اثر کند؟"
              value={idea.rationale}
              onChange={(v) => change("rationale", v)}
            />
            <div className="scale-grid">
              <Select
                label="اثر مورد انتظار"
                value={idea.expectedImpact}
                items={{ unknown: "نامشخص", ...M.levels }}
                onChange={(v) => change("expectedImpact", v)}
              />
              <Select
                label="اطمینان به ایده"
                value={idea.confidence ?? ""}
                empty="هنوز ارزیابی نشده"
                items={M.levels}
                onChange={(v) => change("confidence", v || null)}
              />
              <Select
                label="تلاش مورد نیاز"
                value={idea.effort ?? ""}
                empty="هنوز ارزیابی نشده"
                items={M.levels}
                onChange={(v) => change("effort", v || null)}
              />
              <Text
                label="هزینه تخمینی و واحد (اختیاری)"
                value={idea.estimatedCost}
                onChange={(v) => change("estimatedCost", v)}
              />
            </div>
            <Text
              area
              label="شواهد پشتیبان ایده"
              value={idea.evidence}
              onChange={(v) => change("evidence", v)}
            />
            <Text
              label="مفهوم شاخص موفقیت / جهت شواهد"
              value={idea.successMetric}
              onChange={(v) => change("successMetric", v)}
            />
            <Owner
              value={idea.ownerRoleId}
              onChange={(v) => change("ownerRoleId", v)}
            />
            <Select
              label="وضعیت ایده"
              value={idea.status}
              items={Object.fromEntries(
                Object.entries(M.ideaStatuses).filter(
                  ([k]) =>
                    !["experiment", "validated"].includes(k) ||
                    k === idea.status,
                ),
              )}
              onChange={(v) => change("status", v)}
            />
            <p className="scale-notice">
              شروع آزمایش و تصمیم مستند درباره ایده از فضای آزمایش انجام
              می‌شوند. اطمینان، میزان شواهد است؛ احتمال موفقیت نیست.
            </p>
            <p>
              اولویت پیشنهادی: <strong>{ideaPriority(idea).category}</strong>
            </p>
            <p>
              {readiness.ready
                ? "ساختار لازم برای طراحی آزمایش کامل است."
                : `برای آمادگی تکمیل کنید: ${readiness.missing.join("، ")}`}
            </p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <Button type="submit">{quick ? "ثبت در ورودی" : "ذخیره ایده"}</Button>
      </form>
    </Drawer>
  );
}
export function Ideas({ id }: { id?: string }) {
  const { store, sources } = useScale(),
    [edit, setEdit] = useState<M.GrowthIdea | null>(null),
    [quick, setQuick] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [constraint, setConstraint] = useState(""),
    [sort, setSort] = useState("recent");
  const idea = store.ideas.find((i) => i.id === id);
  if (id && !idea)
    return (
      <Panel title="ایده پیدا نشد">
        <Link href="/scale/ideas">بازگشت به ایده‌ها</Link>
      </Panel>
    );
  const rows = store.ideas
    .filter(
      (i) =>
        (!status || i.status === status) &&
        (!constraint || i.constraintId === constraint) &&
        i.title.includes(search),
    )
    .sort((a, b) =>
      sort === "priority"
        ? (ideaPriority(b).score ?? -1) - (ideaPriority(a).score ?? -1) ||
          a.id.localeCompare(b.id)
        : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
  const open = (i: M.GrowthIdea, q = false) => {
    setQuick(q);
    setEdit(i);
  };
  return (
    <>
      <PageTitle
        title={idea ? idea.title : "ایده‌های رشد"}
        description="ثبت سریع امروز؛ ارزیابی مستند پیش از آزمایش. تعداد زیاد ایده به‌تنهایی مسئله نیست."
        onAdd={() => open(idea ?? M.newIdea(), !idea)}
        addLabel={idea ? "تکمیل ایده" : "ثبت سریع ایده"}
      />
      {idea ? (
        <>
          {idea.status === "ready" && <ConvertIdeaButton ideaId={idea.id} />}
          <ExperimentLinks ideaId={idea.id} />
          <FunnelEntityContext kind="idea" entityId={idea.id} />
          <NetworkEntityContext kind="idea" entityId={idea.id} />
          <IdeaDecision ideaId={idea.id} />
          <Panel title="منطق و شواهد">
            <p>{idea.description || "شرح ثبت نشده"}</p>
            <div className="scale-tags">
              <span>{M.ideaStatuses[idea.status]}</span>
              <span>{M.ideaSources[idea.source]}</span>
              <span>{ideaPriority(idea).category}</span>
            </div>
            <p>
              گلوگاه:{" "}
              {idea.constraintId ? (
                <Link href={`/scale/constraints/${idea.constraintId}`}>
                  {store.constraints.find((c) => c.id === idea.constraintId)
                    ?.title ?? "پیوند نامعتبر"}
                </Link>
              ) : (
                "پیوند ندارد"
              )}
            </p>
            <p>
              اهرم:{" "}
              {store.levers.find((l) => l.id === idea.leverId)?.name ??
                "انتخاب نشده"}
            </p>
            <p>منطق مداخله: {idea.intervention || "ثبت نشده"}</p>
            <p>چرا ممکن است اثر کند: {idea.rationale || "ثبت نشده"}</p>
            <p>شواهد: {idea.evidence || "ثبت نشده"}</p>
            <p>
              مسئول:{" "}
              {sources.roles.find((r) => r.id === idea.ownerRoleId)?.title ??
                "انتخاب نشده / منبع موجود نیست"}
            </p>
            <p>هزینه: {idea.estimatedCost || "نامشخص"}</p>
          </Panel>
          <Panel title="اولویت و آمادگی">
            <div className="scale-grid">
              <p>
                اثر:{" "}
                {idea.expectedImpact === "unknown"
                  ? "نامشخص"
                  : M.levels[idea.expectedImpact]}
              </p>
              <p>
                اطمینان:{" "}
                {idea.confidence ? M.levels[idea.confidence] : "نامشخص"}
              </p>
              <p>تلاش: {idea.effort ? M.levels[idea.effort] : "نامشخص"}</p>
            </div>
            <h3>{ideaPriority(idea).category}</h3>
            <p>{ideaQuality(idea, store)}</p>
            <p>مفهوم شاخص موفقیت: {idea.successMetric || "ثبت نشده"}</p>
            {!ideaReadiness(idea, store).ready && (
              <p>نیازمند: {ideaReadiness(idea, store).missing.join("، ")}</p>
            )}
            <details>
              <summary>منطق اولویت‌بندی</summary>
              <p>
                اثر و اطمینان: کم ۱، متوسط ۲، زیاد ۳. ضریب تلاش: کم ۳، متوسط ۲،
                زیاد ۱. حاصل‌ضرب ۱۸ تا ۲۷ بسیار قوی، ۱۰ تا ۱۷ مناسب، ۵ تا ۹
                نیازمند شواهد و ۱ تا ۴ اولویت پایین است. داده مفقود امتیاز
                ندارد. این راهنمای گفتگوست، نه برآورد احتمال.
              </p>
            </details>
            {sources.capacity.some((p) => p.risk) && (
              <p className="scale-notice">
                شواهد سیستم ریسک عملیاتی نشان می‌دهد. ظرفیت تحویل را پیش از
                افزایش حجم بررسی کنید؛ ثبت ایده محدود نشده است.
              </p>
            )}
          </Panel>
          <Panel title="سابقه وضعیت">
            {idea.history.map((h, i) => (
              <p key={i}>
                {new Date(h.at).toLocaleString("fa-IR", {
                  timeZone: "Asia/Tehran",
                })}{" "}
                ·{" "}
                {h.from
                  ? M.ideaStatuses[h.from as keyof typeof M.ideaStatuses]
                  : "ثبت اولیه"}{" "}
                ← {M.ideaStatuses[h.to]}
              </p>
            ))}
          </Panel>
        </>
      ) : (
        <>
          <div className="scale-stats">
            {[
              ["همه ایده‌ها", store.ideas.length],
              ["ورودی", store.ideas.filter((i) => i.status === "inbox").length],
              [
                "در حال بررسی",
                store.ideas.filter((i) => i.status === "review").length,
              ],
              [
                "آماده آزمایش",
                store.ideas.filter(
                  (i) => i.status === "ready" && ideaReadiness(i, store).ready,
                ).length,
              ],
            ].map(([label, count]) => (
              <div className="scale-card" key={label}>
                <small>{label}</small>
                <strong>{fa(count as number)}</strong>
              </div>
            ))}
          </div>
          <div className="scale-grid">
            <Text label="جست‌وجوی ایده" value={search} onChange={setSearch} />
            <Select
              label="مرحله ایده"
              value={status}
              empty="همه مراحل"
              items={M.ideaStatuses}
              onChange={setStatus}
            />
            <Select
              label="فیلتر گلوگاه"
              value={constraint}
              empty="همه گلوگاه‌ها"
              items={Object.fromEntries(
                store.constraints.map((c) => [c.id, c.title]),
              )}
              onChange={setConstraint}
            />
            <Select
              label="مرتب‌سازی"
              value={sort}
              items={{ recent: "آخرین تغییر", priority: "اولویت پیشنهادی" }}
              onChange={setSort}
            />
          </div>
          <div className="scale-grid">
            {rows.map((i) => (
              <article className="scale-card" key={i.id}>
                <small>
                  {M.ideaStatuses[i.status]} · {M.ideaSources[i.source]}
                </small>
                <h3>
                  <Link href={`/scale/ideas/${i.id}`}>{i.title}</Link>
                </h3>
                <p>{ideaPriority(i).category}</p>
                <p className="scale-muted">
                  {store.constraints.find((c) => c.id === i.constraintId)
                    ?.title ?? "هنوز به گلوگاه متصل نیست"}
                </p>
                <Button secondary onClick={() => open(i)}>
                  تکمیل ایده
                </Button>
              </article>
            ))}
          </div>
          {!rows.length && <p>ایده‌ای با این شرایط وجود ندارد.</p>}
        </>
      )}
      {edit && (
        <Editor
          initial={edit}
          key={edit.id}
          quick={quick}
          close={() => setEdit(null)}
        />
      )}
    </>
  );
}
