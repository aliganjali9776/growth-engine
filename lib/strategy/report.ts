import {
  contextLabels,
  todayTehran,
  type StrategyStore,
  type StrategyRole,
  type StrategyObjective,
  type StrategyCycle,
} from "./model";
export function objectiveQuality(
  o: StrategyObjective,
  cycle: StrategyCycle,
  store: StrategyStore,
  roles: StrategyRole[],
) {
  const warnings: string[] = [];
  if (!roles.some((r) => r.id === o.ownerRoleId))
    warnings.push("مالک هدف در نقش‌های سیستم تعیین نشده یا موجود نیست.");
  const p = store.priorities.find(
    (p) => p.id === o.relatedPriorityId && p.cycleId === o.cycleId,
  );
  if (!p) warnings.push("این هدف به هیچ اولویت استراتژیک متصل نیست.");
  else if (p.status !== "selected" && o.status === "active")
    warnings.push("اولویت مرتبط این هدف، در تمرکز منتخب دوره نیست.");
  if (o.startDate < cycle.startDate || o.deadline > cycle.endDate)
    warnings.push("تاریخ هدف خارج از محدوده دوره است.");
  if (/[0-9۰-۹٠-٩]/.test(o.title))
    warnings.push(
      "عنوان دارای عدد است؛ شواهد کمی معمولاً متعلق به نتیجه کلیدی‌اند.",
    );
  if (
    /^(استخدام|برگزاری|تهیه|ارسال|خرید|انجام|جلسه|راه‌اندازی کمپین)/.test(
      o.title.trim(),
    )
  )
    warnings.push(
      "عنوان به فعالیت شباهت دارد؛ تغییر مطلوب حاصل از آن را بنویسید.",
    );
  if (
    o.title.trim().length < 12 ||
    !/(رشد|تقویت|بهبود|تبدیل|توسعه|پایدار|تکرار|ساخت|کاهش|افزایش|حرفه‌ای|توانمند|وفادار)/.test(
      o.title,
    )
  )
    warnings.push(
      "عنوان احتمالاً نیازمند بازبینی است؛ روشن بودن نتیجه کیفی پایان دوره را بررسی کنید.",
    );
  return { label: warnings.length ? "نیازمند بازبینی" : "قوی", warnings };
}
export function strategyReport(
  store: StrategyStore,
  roles: StrategyRole[],
  cycleId?: string,
  today = todayTehran(),
) {
  const cycle = cycleId
    ? store.cycles.find((c) => c.id === cycleId)
    : store.cycles.find((c) => c.status === "active");
  const priorities = store.priorities
    .filter((p) => p.cycleId === cycle?.id)
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const selected = priorities.filter((p) => p.status === "selected");
  const objectives = store.objectives.filter(
    (o) => o.cycleId === cycle?.id && o.status !== "cancelled",
  );
  const active = objectives.filter((o) => o.status === "active");
  const context = store.contexts.find((c) => c.cycleId === cycle?.id);
  const choices = store.choices.filter((c) => c.cycleId === cycle?.id);
  const contextFields = Object.keys(contextLabels).filter(
    (k) => k !== "notes",
  ) as Exclude<keyof typeof contextLabels, "notes">[];
  const contextCount = contextFields.filter((k) => context?.[k].trim()).length;
  const owned = objectives.filter((o) =>
    roles.some((r) => r.id === o.ownerRoleId),
  );
  const aligned = objectives.filter((o) =>
    selected.some((p) => p.id === o.relatedPriorityId),
  );
  const ranked =
    selected.length > 0 &&
    selected[0].rank === 1 &&
    new Set(selected.map((p) => p.rank)).size === selected.length;
  const parts = [
    {
      label: "دوره فعال",
      weight: 15,
      value: cycle?.status === "active" ? 15 : 0,
    },
    { label: "زمینه استراتژی", weight: 15, value: (15 * contextCount) / 6 },
    {
      label: "اولویت‌های منتخب",
      weight: 20,
      value: 20 * Math.min(selected.length / 3, 1),
    },
    { label: "رتبه‌بندی روشن", weight: 10, value: ranked ? 10 : 0 },
    {
      label: "انتخاب تمرکز و فعلاً نه",
      weight: 10,
      value:
        (choices.some((c) => c.type === "focus") ? 5 : 0) +
        (choices.some((c) => c.type === "notNow") ? 5 : 0),
    },
    {
      label: "اهداف تعریف‌شده",
      weight: 15,
      value: 15 * Math.min(objectives.length / 3, 1),
    },
    {
      label: "مالکیت اهداف",
      weight: 10,
      value: objectives.length ? (10 * owned.length) / objectives.length : 0,
    },
    {
      label: "هم‌راستایی اهداف",
      weight: 5,
      value: objectives.length ? (5 * aligned.length) / objectives.length : 0,
    },
  ];
  const score = Math.round(parts.reduce((n, p) => n + p.value, 0));
  const findings: { id: string; text: string; href: string }[] = [];
  const base = cycle ? `/strategy/cycles/${cycle.id}` : "/strategy/cycles";
  const add = (id: string, text: string, href = base) =>
    findings.push({ id, text, href });
  if (!cycle || cycle.status !== "active")
    add("cycle", "دوره فعالی برای این نمای استراتژی وجود ندارد.");
  if (cycle) {
    if (contextCount < 6) add("context", "زمینه استراتژی هنوز کامل نیست.");
    if (!selected.length)
      add(
        "priorities",
        "اولویت‌های منتخب دوره را مشخص کنید.",
        base + "/priorities",
      );
    if (selected.length > 5)
      add(
        "focus",
        "تعداد زیاد اولویت‌ها تمرکز استراتژی را کاهش می‌دهد.",
        base + "/priorities",
      );
    if (!ranked)
      add(
        "rank",
        "اولویت شماره ۱ و رتبه‌های متمایز را مشخص کنید.",
        base + "/priorities",
      );
    selected
      .filter((p) => !p.rationale.trim())
      .forEach((p) =>
        add(
          "why-" + p.id,
          `«${p.title}» دلیل انتخاب ندارد.`,
          base + "/priorities",
        ),
      );
    if (!choices.some((c) => c.type === "notNow"))
      add("notNow", "انتخاب صریح «فعلاً انجام نمی‌دهیم» ثبت نشده است.");
    if (!objectives.length)
      add(
        "objectives",
        "اهداف دوره هنوز تعریف نشده‌اند.",
        base + "/objectives",
      );
    if (objectives.length > 5)
      add(
        "count",
        "بیش از ۵ هدف، تمرکز دوره را کاهش می‌دهد.",
        base + "/objectives",
      );
    for (const o of objectives) {
      if (o.status === "active" && !roles.some((r) => r.id === o.ownerRoleId))
        add(
          "owner-" + o.id,
          `«${o.title}»: مالک معتبر ندارد.`,
          base + "/objectives",
        );
      if (
        o.status === "active" &&
        !selected.some((p) => p.id === o.relatedPriorityId)
      )
        add(
          "align-" + o.id,
          `«${o.title}»: به اولویت منتخب متصل نیست.`,
          base + "/objectives",
        );
      if (o.startDate < cycle.startDate || o.deadline > cycle.endDate)
        add(
          "date-" + o.id,
          `«${o.title}»: تاریخ خارج از دوره است.`,
          base + "/objectives",
        );
    }
  }
  return {
    cycle,
    context,
    priorities,
    selected,
    objectives,
    active,
    choices,
    parts,
    score,
    findings,
    unaligned: objectives.length - aligned.length,
    days: cycle
      ? Math.max(
          0,
          Math.ceil((Date.parse(cycle.endDate) - Date.parse(today)) / 86400000),
        )
      : null,
    label:
      score < 40
        ? "طراحی ناقص"
        : score < 70
          ? "در حال شکل‌گیری"
          : score < 90
            ? "آماده هدف‌گذاری"
            : "ساختار استراتژی آماده است",
  };
}
