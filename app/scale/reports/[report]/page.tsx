import { ScaleDashboard } from "@/components/scale/dashboard";
import { notFound } from "next/navigation";
const reports = [
  "constraints",
  "ideas",
  "experiments",
  "learnings",
  "funnel",
  "revenue",
  "channels",
  "concentration",
  "loops",
  "readiness",
  "capacity",
  "decisions",
];
export default async function Page({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report } = await params;
  if (!reports.includes(report)) notFound();
  return <ScaleDashboard key={report} report={report} />;
}
