import { InitiativeWorkspace } from "@/components/strategy/initiative-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; objective?: string; kr?: string }>;
}) {
  const q = await searchParams;
  return (
    <InitiativeWorkspace
      initialCycleId={typeof q.cycle === "string" ? q.cycle : ""}
      initialObjectiveId={typeof q.objective === "string" ? q.objective : ""}
      initialKRId={typeof q.kr === "string" ? q.kr : ""}
    />
  );
}
