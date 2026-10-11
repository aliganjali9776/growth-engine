import type { KeyResult } from "../kr/types";
export function measurementDefinition(k: KeyResult) {
  return JSON.stringify([
    k.type,
    k.unit,
    k.startValue,
    k.targetValue,
    k.milestones.map((m) => [m.id, m.title, m.weight]),
  ]);
}
const tehranDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function reviewDate(stamp: string) {
  return tehranDateFormatter.format(new Date(stamp));
}
