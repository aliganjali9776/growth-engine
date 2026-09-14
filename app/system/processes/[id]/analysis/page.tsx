import { AnalysisPage } from "@/components/process-analysis/analysis-page";
export const metadata = { title: "تحلیل فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AnalysisPage id={(await params).id} />;
}
