import { AgentLab } from "@/components/agent/lab";
import { AdvisorDebug } from "@/components/advisor/debug";
import { InsightsPage } from "@/components/advisor/insights";
import { ActionsPage } from "@/components/advisor/actions";
export default function Page() {
  return (
    <>
      <ActionsPage debug />
      <InsightsPage debug />
      <AdvisorDebug />
      <AgentLab />
    </>
  );
}
