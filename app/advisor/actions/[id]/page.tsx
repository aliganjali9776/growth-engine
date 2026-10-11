import { ActionsPage } from "@/components/advisor/actions";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ActionsPage id={id} />;
}
