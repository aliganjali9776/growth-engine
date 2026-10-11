import { Ideas } from "@/components/scale/ideas";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Ideas id={id} />;
}
