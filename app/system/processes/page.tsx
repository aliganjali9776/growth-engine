import { Suspense } from "react";
import { ProcessInventory } from "@/components/processes/inventory";
export default function Page() {
  return (
    <Suspense fallback={<p>در حال آماده‌سازی فرآیندها…</p>}>
      <ProcessInventory />
    </Suspense>
  );
}
