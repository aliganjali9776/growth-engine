import { ReadinessWorkspace } from "@/components/scale/readiness";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  return (
    <ReadinessWorkspace
      initialSource={typeof p.source === "string" ? p.source : undefined}
      initialSourceId={typeof p.sourceId === "string" ? p.sourceId : undefined}
    />
  );
}
