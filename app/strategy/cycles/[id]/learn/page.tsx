import { LearnWorkspace } from "@/components/strategy/learn-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LearnWorkspace cycleId={id} />;
}
