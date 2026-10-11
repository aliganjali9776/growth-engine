import { KeyResultsPage } from "@/components/strategy/kr-views";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; kr?: string }>;
}) {
  const { cycle, kr } = await searchParams;
  return (
    <KeyResultsPage
      key={`${cycle}:${kr}`}
      initialCycleId={cycle}
      initialKRId={kr}
    />
  );
}
