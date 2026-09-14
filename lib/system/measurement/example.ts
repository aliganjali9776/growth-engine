import { newKPI, type MeasurementRecord, today } from "./model";
export function exampleKPIs(r: MeasurementRecord) {
  if (r.kpis.length)
    throw new Error("نمونه فقط برای فرآیند بدون شاخص قابل افزودن است.");
  const definitions: [
    string,
    "increase" | "decrease",
    number,
    number,
    string,
    number[],
  ][] = [
    ["زمان متوسط ارسال پروپوزال", "decrease", 18, 4, "ساعت", [15, 10, 7]],
    ["نرخ تبدیل پروپوزال به قرارداد", "increase", 22, 35, "درصد", [24, 27, 30]],
    ["Follow-up به‌موقع", "increase", 55, 90, "درصد", [60, 72, 83]],
    [
      "قراردادهای بدون دخالت مستقیم مدیرعامل",
      "increase",
      30,
      80,
      "درصد",
      [35, 48, 65],
    ],
  ];
  const kpis = definitions.map(
    ([name, direction, baselineValue, targetValue, unit]) => ({
      ...newKPI(r.processId),
      name,
      direction,
      baselineValue,
      targetValue,
      unit,
      ownerRoleId: "r1",
      status: "active" as const,
      description: "داده آموزشی نمونه؛ اندازه‌گیری واقعی شرکت نیست.",
    }),
  );
  const entries = kpis.flatMap((k, i) =>
    definitions[i][5].map((value, j) => ({
      id: crypto.randomUUID(),
      kpiId: k.id,
      processId: r.processId,
      value,
      periodDate: new Date(Date.parse(today()) - (2 - j) * 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      note: "نمونه آموزشی",
      confidence: "medium" as const,
      enteredAt: new Date().toISOString(),
    })),
  );
  return { ...r, kpis, entries };
}
