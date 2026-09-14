import { ComparePage } from "@/components/process-analysis/compare-page";
export const metadata = { title: "مقایسه فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ComparePage id={(await params).id} />;
}
