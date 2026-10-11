import { WeeklyWorkspace } from "@/components/strategy/weekly-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return <WeeklyWorkspace reviewId={reviewId} />;
}
