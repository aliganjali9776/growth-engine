import { StrategyDashboardPage } from "@/components/strategy/dashboard";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle } = await searchParams;
  return (
    <StrategyDashboardPage key={cycle} mode="executive" initialCycle={cycle} />
  );
}
