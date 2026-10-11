import { notFound, redirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "report") redirect("/strategy/reports");
  notFound();
}
