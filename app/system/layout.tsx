import { SystemProvider } from "@/components/system/provider";
import { ProcessMapsProvider } from "@/components/process-map/provider";
import { AnalysisProvider } from "@/components/process-analysis/provider";
import { StandardsProvider } from "@/components/process-standards/provider";
import { MeasurementProvider } from "@/components/measurement/provider";
export const metadata = { title: "سیستم | Growth Engine" };
export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SystemProvider>
      <ProcessMapsProvider>
        <AnalysisProvider>
          <StandardsProvider>
            <MeasurementProvider>{children}</MeasurementProvider>
          </StandardsProvider>
        </AnalysisProvider>
      </ProcessMapsProvider>
    </SystemProvider>
  );
}
