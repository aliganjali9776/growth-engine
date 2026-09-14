import type { ProcessMap } from "../maps/model";
import type { SystemData, ProcessStep } from "../types";
import {
  mapMetrics,
  mapCompleteness,
  mapWarnings,
  stepOwner,
  founderStep,
  isHandoff,
  operational,
} from "../maps/logic";
import { reachable, loopSteps, completionBlockedBy } from "./graph";
export const categories = {
  eliminate: "حذف",
  simplify: "ساده‌سازی",
  delegate: "تفویض",
  automate: "اتوماسیون",
};
export type Category = keyof typeof categories;
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function severity(n: number) {
  return n >= 75 ? "بحرانی" : n >= 50 ? "زیاد" : n >= 25 ? "متوسط" : "کم";
}
export const percent = (n: number, d: number) => (d ? (100 * n) / d : 0);
export function frictionScore(map: ProcessMap, system: SystemData) {
  const m = mapMetrics(map, system),
    c = mapCompleteness(map, system),
    ops = map.steps.filter(operational),
    n = ops.length;
  const invalid = new Set(
    mapWarnings(map, system)
      .filter((w) =>
        ["disconnected", "incoming", "outgoing", "decision"].includes(w.code),
      )
      .map((w) => w.stepId),
  );
  const components = [
    {
      key: "wait",
      label: "انتظار",
      weight: 30,
      value: clamp(m.waitingRatio / 100),
      rule: "نسبت انتظار به مجموع زمان ثبت‌شده",
    },
    {
      key: "founder",
      label: "بنیان‌گذار",
      weight: 20,
      value: clamp(ops.filter((s) => founderStep(system, s)).length / (n || 1)),
      rule: "سهم مراحل عملیاتی وابسته به بنیان‌گذار",
    },
    {
      key: "rework",
      label: "بازکاری",
      weight: 15,
      value: clamp(
        ops.reduce((a, s) => a + s.reworkProbability, 0) / (100 * (n || 1)),
      ),
      rule: "میانگین احتمال بازکاری مراحل عملیاتی",
    },
    {
      key: "handoff",
      label: "تحویل",
      weight: 15,
      value: clamp(m.handoffs / Math.max(1, map.connections.length)),
      rule: "تحویل‌ها تقسیم بر تعداد اتصال‌ها؛ سقف ۱",
    },
    {
      key: "decision",
      label: "پیچیدگی تصمیم",
      weight: 10,
      value: clamp(
        map.steps
          .filter((s) => s.type === "decision")
          .reduce(
            (a, s) =>
              a +
              Math.max(
                1,
                map.connections.filter((e) => e.sourceStepId === s.id).length -
                  1,
              ),
            0,
          ) / (n || 1),
      ),
      rule: "جمع بیشینهٔ ۱ و (شاخه‌ها منهای ۱)، تقسیم بر مراحل عملیاتی",
    },
    {
      key: "structure",
      label: "مالکیت و ساختار",
      weight: 10,
      value: clamp(
        (1 -
          c.owner / 100 +
          (1 - c.connection / 100) +
          invalid.size / (n || 1)) /
          3,
      ),
      rule: "میانگین شکاف مالکیت، شکاف مسیر شروع تا پایان و سهم مراحل دارای ایراد ساختاری",
    },
  ];
  const score = Math.round(
    components.reduce((a, x) => a + x.value * x.weight, 0),
  );
  return {
    score,
    level: severity(score),
    components,
    provisional: c.time < 100 || c.connection < 100 || !n,
  };
}
export interface Finding {
  id: string;
  stepId: string;
  title: string;
  reason: string;
  metric: string;
  category: Category;
  benefit: string;
  severity: string;
  score: number;
}
export function analyzeProcess(map: ProcessMap, system: SystemData) {
  const metrics = mapMetrics(map, system),
    ops = map.steps.filter(operational),
    loops = loopSteps(map),
    process = system.processes.find((p) => p.id === map.processId),
    maxWait = Math.max(1, ...map.steps.map((s) => s.waitTimeMinutes ?? 0)),
    maxWork = Math.max(1, ...map.steps.map((s) => s.workTimeMinutes ?? 0));
  const handoffEdges = map.connections.filter((e) => isHandoff(map, e));
  const ownership = system.roles
    .map((role) => ({
      role,
      steps: ops.filter((s) => s.ownerRoleId === role.id),
    }))
    .filter((x) => x.steps.length)
    .sort(
      (a, b) =>
        b.steps.length - a.steps.length || a.role.id.localeCompare(b.role.id),
    );
  const bottlenecks = ops
    .map((step) => {
      const incoming = map.connections.filter(
          (e) => e.targetStepId === step.id,
        ).length,
        downstream = reachable(map, step.id).size - 1;
      const parts = [
        {
          label: "انتظار",
          weight: 35,
          value: (step.waitTimeMinutes ?? 0) / maxWait,
        },
        {
          label: "بنیان‌گذار",
          weight: 20,
          value: founderStep(system, step) ? 1 : 0,
        },
        { label: "بازکاری", weight: 15, value: step.reworkProbability / 100 },
        {
          label: "وابستگی گراف",
          weight: 15,
          value:
            (clamp(incoming / 3) +
              clamp(downstream / Math.max(1, map.steps.length - 1))) /
            2,
        },
        {
          label: "کار",
          weight: 10,
          value: (step.workTimeMinutes ?? 0) / maxWork,
        },
        {
          label: "تحویل",
          weight: 5,
          value:
            handoffEdges.some(
              (e) => e.sourceStepId === step.id || e.targetStepId === step.id,
            ) ||
            step.handoff ||
            step.type === "handoff"
              ? 1
              : 0,
        },
      ];
      const score = Math.round(
        parts.reduce((a, p) => a + p.value * p.weight, 0),
      );
      return {
        step,
        score,
        severity: severity(score),
        parts,
        incoming,
        downstream,
        category: (founderStep(system, step)
          ? "delegate"
          : "simplify") as Category,
      };
    })
    .filter((b) => b.score >= 25)
    .sort((a, b) => b.score - a.score || a.step.id.localeCompare(b.step.id));
  const findings: Finding[] = [];
  const add = (
    s: ProcessStep,
    kind: string,
    title: string,
    reason: string,
    metric: string,
    category: Category,
    score: number,
    benefit: string,
  ) =>
    findings.push({
      id: `${s.id}-${kind}`,
      stepId: s.id,
      title,
      reason,
      metric,
      category,
      score,
      severity: severity(score),
      benefit,
    });
  for (const s of ops) {
    const outgoing = map.connections.filter((e) => e.sourceStepId === s.id),
      wait = s.waitTimeMinutes ?? 0,
      owner = stepOwner(system, s).role;
    if (wait >= 60 || (wait > 0 && wait / maxWait >= 0.5))
      add(
        s,
        "wait",
        "کاهش انتظار",
        `انتظار ثبت‌شده حداقل ۶۰ دقیقه یا نصف بیشترین انتظار نقشه است.`,
        `${wait} دقیقه · ${Math.round(percent(wait, metrics.wait))}٪ از انتظار`,
        "simplify",
        wait >= 240 ? 75 : 50,
        "بررسی صف و معیار تحویل برای کاهش انتظار",
      );
    if (founderStep(system, s))
      add(
        s,
        "founder",
        "کاندید تفویض",
        owner?.isFounderRole
          ? "نقش بنیان‌گذار مالک این مرحله عملیاتی است."
          : "وابستگی به بنیان‌گذار برای این مرحله ثبت شده است.",
        `انتظار ${wait} دقیقه`,
        "delegate",
        wait >= 120 ? 85 : 55,
        "بررسی حدود اختیار و امکان واگذاری تصمیم؛ بدون تغییر خودکار مالک",
      );
    if (s.reworkProbability >= 50)
      add(
        s,
        "rework",
        "کاهش بازکاری",
        "احتمال بازکاری ثبت‌شده حداقل ۵۰٪ است.",
        `${s.reworkProbability}٪`,
        "simplify",
        s.reworkProbability >= 75 ? 80 : 60,
        "شفاف‌کردن ورودی و معیار پذیرش پیش از اجرا",
      );
    if (loops.has(s.id))
      add(
        s,
        "loop",
        "مرور مسیر برگشت",
        "این مرحله عضو یک چرخه جهت‌دار است؛ تعداد اجرای واقعی حلقه مشخص نیست.",
        "حلقه در ساختار نقشه",
        "simplify",
        45,
        "بررسی علت برگشت و شرایط خروج از حلقه",
      );
    if (s.type === "decision" && outgoing.length < 2)
      add(
        s,
        "branch",
        "بازبینی ضرورت تصمیم",
        "تصمیم کمتر از دو مقصد خروجی متمایز دارد.",
        `${outgoing.length} شاخه`,
        "simplify",
        60,
        "تکمیل شاخه مفقود یا تبدیل تصمیم به اقدام پس از بررسی",
      );
    if (s.type === "decision" && outgoing.length > 3)
      add(
        s,
        "complex",
        "ساده‌سازی شاخه‌ها",
        "این تصمیم بیش از سه مسیر خروجی دارد.",
        `${outgoing.length} شاخه`,
        "simplify",
        55,
        "شفاف‌کردن قواعد تصمیم و کاهش پیچیدگی",
      );
    const duplicate = ops.find(
      (x) =>
        x.id < s.id &&
        x.type === s.type &&
        x.title.trim() === s.title.trim() &&
        x.ownerRoleId === s.ownerRoleId &&
        x.input.trim() === s.input.trim() &&
        x.output.trim() === s.output.trim(),
    );
    if (duplicate)
      add(
        s,
        "duplicate",
        "بررسی کاندید حذف",
        "عنوان، نوع، مالک، ورودی و خروجی با مرحله دیگری یکسان است؛ این شباهت به‌تنهایی اثبات زائدبودن نیست.",
        duplicate.title,
        "eliminate",
        40,
        "بررسی ضرورت هر دو مرحله پیش از حذف",
      );
    if (
      s.type === "action" &&
      process?.frequency === 3 &&
      owner &&
      !owner.isFounderRole &&
      s.input.trim() &&
      s.output.trim() &&
      (s.workTimeMinutes ?? 0) >= 10 &&
      s.reworkProbability <= 25
    )
      add(
        s,
        "automation",
        "کاندید اتوماسیون",
        "فرآیند پرتکرار، اقدام با مالک مشخص، ورودی/خروجی ثبت‌شده و بازکاری حداکثر ۲۵٪ است.",
        `${s.workTimeMinutes} دقیقه کار`,
        "automate",
        40,
        "بررسی قابلیت خودکارسازی کار تکراری؛ هنوز اتوماسیونی اجرا نمی‌شود",
      );
    if (!owner)
      add(
        s,
        "owner",
        "تعیین مالک مرحله",
        "نقش مالک معتبر ثبت نشده است.",
        "بدون مالک",
        "delegate",
        65,
        "تعیین مسئولیت روشن قبل از بازطراحی",
      );
    if (
      ownership.some(
        (x) =>
          x.role.id === s.ownerRoleId &&
          x.steps.length >= 4 &&
          x.steps.length / Math.max(1, ops.length) >= 0.5,
      )
    )
      add(
        s,
        "concentration",
        "مرور تمرکز مالکیت",
        "حداقل چهار مرحله و نیمی از مراحل عملیاتی بر عهده یک نقش است.",
        "تمرکز نقش؛ نه اندازه‌گیری ظرفیت واقعی",
        "delegate",
        45,
        "مرور ظرفیت و امکان توزیع مسئولیت",
      );
  }
  findings.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const founder = map.steps.filter((s) => founderStep(system, s));
  const transitions = handoffEdges.map((e) => {
    const a = map.steps.find((s) => s.id === e.sourceStepId)!,
      b = map.steps.find((s) => s.id === e.targetStepId)!;
    return {
      edge: e,
      from: stepOwner(system, a).role,
      to: stepOwner(system, b).role,
    };
  });
  const returns = transitions.filter((t) =>
    transitions.some((o) => o.from?.id === t.to?.id && o.to?.id === t.from?.id),
  );
  return {
    metrics,
    friction: frictionScore(map, system),
    bottlenecks,
    findings,
    ownership,
    loops: [...loops],
    waiting: map.steps
      .filter((s) => (s.waitTimeMinutes ?? 0) > 0)
      .sort((a, b) => (b.waitTimeMinutes ?? 0) - (a.waitTimeMinutes ?? 0))
      .map((s) => ({
        step: s,
        waitShare: percent(s.waitTimeMinutes ?? 0, metrics.wait),
        cycleShare: percent(s.waitTimeMinutes ?? 0, metrics.cycle),
      })),
    handoffs: {
      transitions,
      crossDepartment: transitions.filter(
        (t) => t.from && t.to && t.from.departmentId !== t.to.departmentId,
      ).length,
      backAndForth: returns.length,
      uniqueOwners: ownership.length,
    },
    founder: {
      steps: founder,
      wait: founder.reduce((n, s) => n + (s.waitTimeMinutes ?? 0), 0),
      decisions: founder.filter((s) => s.type === "decision").length,
      blocking: founder.filter((s) => completionBlockedBy(map, s.id)).length,
    },
    decisions: map.steps
      .filter((s) => s.type === "decision")
      .map((s) => ({
        step: s,
        branches: map.connections.filter((e) => e.sourceStepId === s.id).length,
        loop: loops.has(s.id),
        founder: founderStep(system, s),
      })),
  };
}
