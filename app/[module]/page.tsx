import { notFound } from "next/navigation";
import {appMode} from "@/lib/server/saas-runtime";
import {CompanyHome} from "@/components/saas/pages";
import { moduleInfo } from "@/lib/mock-data";
import { PageHeader, PreviewNote } from "@/components/ui";
import {
  ScaleView,
  ExecutionView,
  DashboardView,
  SettingsView,
} from "@/components/module-views";
const views: Record<string, React.ComponentType> = {
  scale: ScaleView,
  execution: ExecutionView,
  dashboard: DashboardView,
  settings: SettingsView,
};
export function generateStaticParams() {
  return Object.keys(views).map((module) => ({ module }));
}
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const info = moduleInfo[module];
  const View = views[module];
  if (!info || !View) notFound();
  if(appMode()==="saas")return <CompanyHome/>;
  return (
    <>
      <PageHeader {...info} />
      <PreviewNote />
      <View />
    </>
  );
}
