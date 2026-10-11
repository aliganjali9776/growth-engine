import { StrategyDashboardPage } from "@/components/strategy/dashboard";
import Link from "next/link";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle } = await searchParams;
  return (
    <>
      <Link className="sys-text-link" href="/advisor/workspace">
        خلاصه مدیریتی در مشاور ←
      </Link>
      <StrategyDashboardPage
        key={cycle}
        mode="dashboard"
        initialCycle={cycle}
      />
    </>
  );
}
