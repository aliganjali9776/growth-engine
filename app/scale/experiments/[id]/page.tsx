import { Experiments } from "@/components/scale/experiments";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Experiments key={id} id={id} />;
}
