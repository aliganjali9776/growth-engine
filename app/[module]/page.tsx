import { notFound } from "next/navigation";
import { moduleInfo } from "@/lib/mock-data";
import { PageHeader, PreviewNote } from "@/components/ui";
import {
  StrategyView,
  ScaleView,
  ExecutionView,
  DashboardView,
  SettingsView,
} from "@/components/module-views";
const views: Record<string, React.ComponentType> = {
  strategy: StrategyView,
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
  return (
    <>
      <PageHeader {...info} />
      <PreviewNote />
      <View />
    </>
  );
}
