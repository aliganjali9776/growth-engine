import { ImprovementsPage } from "@/components/measurement/improvements-page";
export const metadata = { title: "دفتر بهبود فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ImprovementsPage id={(await params).id} />;
}
