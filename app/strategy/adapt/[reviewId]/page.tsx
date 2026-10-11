import { AdaptWorkspace } from "@/components/strategy/adapt-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return <AdaptWorkspace reviewId={reviewId} />;
}
