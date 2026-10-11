import { Constraints } from "@/components/scale/constraints";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Constraints id={id} />;
}
