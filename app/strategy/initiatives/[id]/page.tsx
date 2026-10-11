import { InitiativeWorkspace } from "@/components/strategy/initiative-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InitiativeWorkspace id={id} />;
}
