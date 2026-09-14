import { ProcessBuilder } from "@/components/process-map/builder";
export const metadata = { title: "نقشه وضعیت فعلی | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProcessBuilder key={id} id={id} />;
}
