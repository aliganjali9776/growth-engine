import { WeeklyWorkspace } from "@/components/strategy/weekly-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle } = await searchParams;
  return <WeeklyWorkspace key={cycle} initialCycleId={cycle} />;
}
