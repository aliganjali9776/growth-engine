import { Loops } from "@/components/scale/loops";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Loops key={id} id={id} />;
}
