import { Channels } from "@/components/scale/channels";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Channels key={id} id={id} />;
}
