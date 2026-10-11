import { StrategyWorkspace } from "@/components/strategy/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; objectiveId: string }>;
}) {
  const { id, objectiveId } = await params;
  return (
    <StrategyWorkspace
      mode="objective"
      cycleId={id}
      objectiveId={objectiveId}
    />
  );
}
