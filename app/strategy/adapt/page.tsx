import { AdaptWorkspace } from "@/components/strategy/adapt-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle } = await searchParams;
  return <AdaptWorkspace key={cycle} cycleId={cycle} />;
}
