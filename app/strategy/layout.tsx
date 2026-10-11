import { StrategyProvider } from "@/components/strategy/provider";
import { Suspense } from "react";
export const metadata = { title: "استراتژی | Growth Engine" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p role="status">در حال خواندن استراتژی…</p>}>
      <StrategyProvider>{children}</StrategyProvider>
    </Suspense>
  );
}
