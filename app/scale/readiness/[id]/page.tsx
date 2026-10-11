import { ReadinessWorkspace } from "@/components/scale/readiness";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReadinessWorkspace key={id} candidateId={id} />;
}
