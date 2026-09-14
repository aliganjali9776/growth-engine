import type { SystemData } from "../types";
import {
  emptyMap,
  newStep,
  type MapStore,
  type ProcessConnection,
} from "./model";
import { autoLayout } from "./layout";
export function seedMaps(system: SystemData): MapStore {
  const p = system.processes.find((p) => p.id === "p6" && p.code === "P006");
  if (!p) return { version: 1, maps: [] };
  const map = emptyMap(p.id);
  const specs: [
    string,
    "start" | "action" | "decision" | "handoff" | "end",
    string,
    number,
    number,
  ][] = [
    ["شروع درخواست", "start", "", 0, 0],
    ["دریافت درخواست پروپوزال", "action", "r6", 10, 0],
    ["بررسی نیاز مشتری", "action", "r6", 30, 60],
    ["آماده‌سازی پیشنهاد", "action", "r6", 45, 120],
    ["تعیین قیمت", "action", "r1", 20, 60],
    ["آیا تخفیف نیاز است؟", "decision", "r1", 5, 0],
    ["تأیید مدیرعامل", "action", "r0", 5, 240],
    ["ارسال پروپوزال", "handoff", "r6", 10, 30],
    ["پیگیری مشتری", "action", "r6", 15, 1440],
    ["آیا مشتری تأیید کرد؟", "decision", "r1", 10, 0],
    ["مذاکره", "action", "r1", 30, 120],
    ["امضای قرارداد", "action", "r1", 20, 480],
    ["پایان قرارداد", "end", "", 0, 0],
  ];
  map.steps = specs.map(([title, type, owner, work, wait], i) => ({
    ...newStep(p.id, `proposal-${i}`),
    title,
    type,
    ownerRoleId: system.roles.some((r) => r.id === owner) ? owner : undefined,
    workTimeMinutes: work,
    waitTimeMinutes: wait,
    handoff: type === "handoff",
    reworkProbability: i === 10 ? 50 : 0,
    notes:
      i === 6
        ? "نمونه: تأیید تخفیف خارج از اختیار مدیر فروش"
        : "نمونه قابل ویرایش؛ زمان واقعی تیم را ثبت کنید.",
  }));
  const links: [number, number, string][] = [
    [0, 1, ""],
    [1, 2, ""],
    [2, 3, ""],
    [3, 4, ""],
    [4, 5, ""],
    [5, 6, "بله"],
    [5, 7, "خیر"],
    [6, 7, "تأیید شد"],
    [7, 8, ""],
    [8, 9, ""],
    [9, 10, "خیر"],
    [9, 11, "بله"],
    [10, 8, "پیشنهاد اصلاح‌شده"],
    [11, 12, ""],
  ];
  map.connections = links.map(([a, b, label], i): ProcessConnection => ({
    id: `proposal-edge-${i}`,
    processId: p.id,
    sourceStepId: `proposal-${a}`,
    targetStepId: `proposal-${b}`,
    label,
    condition: "",
    type: "sequence",
  }));
  return { version: 1, maps: [autoLayout(map)] };
}
