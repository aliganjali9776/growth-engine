import { AdaptWorkspace } from "@/components/strategy/adapt-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdaptWorkspace cycleId={id} />;
}
