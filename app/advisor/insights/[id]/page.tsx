import { InsightsPage } from "@/components/advisor/insights";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InsightsPage id={id} />;
}
