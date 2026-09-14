import { ImplementationPage } from "@/components/process-standards/implementation-page";
export const metadata = { title: "پیاده‌سازی فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ImplementationPage id={id} />;
}
