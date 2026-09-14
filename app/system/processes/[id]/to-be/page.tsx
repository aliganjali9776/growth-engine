import { ToBePage } from "@/components/process-analysis/to-be";
export const metadata = { title: "طراحی TO-BE | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ToBePage key={id} id={id} />;
}
