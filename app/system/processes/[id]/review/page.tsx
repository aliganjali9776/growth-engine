import { ReviewPage } from "@/components/measurement/review-page";
export const metadata = { title: "مرور هفتگی فرآیند | Growth Engine" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ReviewPage id={(await params).id} />;
}
