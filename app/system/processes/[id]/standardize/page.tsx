import { StandardizePage } from "@/components/process-standards/standardize-page";
export const metadata = { title: "استانداردسازی فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StandardizePage id={id} />;
}
