import type { AgentEvidence } from "../types";
export function missingMetricMessage(
  question: string,
  evidence: AgentEvidence[],
) {
  const definitions = [
    { pattern: /\bcac\b|هزینه جذب مشتری/i, key: "cac", label: "CAC" },
    { pattern: /\bltv\b|ارزش طول عمر مشتری/i, key: "ltv", label: "LTV" },
    {
      pattern: /market\s*share|سهم بازار/i,
      key: "marketShare",
      label: "سهم بازار",
    },
    {
      pattern: /employee\s*productivity|بهره.?وری کارکنان/i,
      key: "employeeProductivity",
      label: "بهره‌وری کارکنان",
    },
  ];
  const metric = definitions.find((m) => m.pattern.test(question));
  if (!metric) return null;
  const measured = evidence.some(
    (e) =>
      e.evidenceType === "Metric" &&
      e.value &&
      typeof e.value === "object" &&
      !Array.isArray(e.value) &&
      typeof (e.value as Record<string, unknown>)[metric.key] === "number" &&
      Number.isFinite((e.value as Record<string, unknown>)[metric.key]),
  );
  return measured
    ? null
    : `${metric.label} در شواهد منتخب موجود نیست؛ داده کافی برای اعلام این شاخص وجود ندارد. ابتدا داده همان دوره و منبع را اندازه‌گیری کنید؛ هدف یا سناریو جایگزین عملکرد واقعی نیست.`;
}
