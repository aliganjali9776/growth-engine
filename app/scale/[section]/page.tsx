import { Levers, FutureScale } from "@/components/scale/home";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "levers") return <Levers />;
  const titles: Record<string, string> = {
    experiments: "آزمایش‌های رشد",
    funnel: "قیف رشد",
    loops: "موتورهای رشد",
    reports: "گزارش رشد",
  };
  if (!titles[section]) notFound();
  return <FutureScale title={titles[section]} />;
}
