import { KPIPage } from "@/components/measurement/kpi-page";
export const metadata = { title: "شاخص‌های عملکرد فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <KPIPage id={(await params).id} />;
}
