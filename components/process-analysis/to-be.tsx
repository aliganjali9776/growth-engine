"use client";
import { useState } from "react";
import Link from "next/link";
import { useMaps } from "@/components/process-map/provider";
import { useAnalysis } from "./provider";
import { ProcessBuilder } from "@/components/process-map/builder";
import { Panel, Button } from "@/components/system/ui";
import { ProcessNav } from "./shared";
import "./analysis.css";
export function ToBePage({ id }: { id: string }) {
  const maps = useMaps(),
    analysis = useAnalysis(),
    [error, setError] = useState(""),
    asis = maps.store?.maps.find((m) => m.processId === id),
    record = analysis.store?.records.find((r) => r.processId === id);
  if (record?.toBe) return <ProcessBuilder id={id} variant="to-be" />;
  return (
    <div className="analysis-workspace">
      <ProcessNav id={id} />
      <Panel
        title="طراحی وضعیت مطلوب · TO-BE"
        caption="یک نسخه مستقل از نقشه فعلی بسازید. نقشه AS-IS حفظ می‌شود."
      >
        <p>
          نقش‌ها، زمان‌ها، اتصال‌ها و موقعیت‌ها کپی می‌شوند؛ تغییرات بعدی هر
          نسخه مستقل است.
        </p>
        <Button
          disabled={
            !asis?.steps.length ||
            !analysis.store ||
            !!analysis.error ||
            !!maps.error
          }
          onClick={() => {
            try {
              analysis.create(asis!);
            } catch (e) {
              setError(e instanceof Error ? e.message : "ساخت نسخه ممکن نشد.");
            }
          }}
        >
          ساخت نسخه TO-BE از روی AS-IS
        </Button>
        {!asis?.steps.length && (
          <Link href={`/system/processes/${id}/map`}>
            ابتدا نقشه AS-IS را ایجاد کنید
          </Link>
        )}
        {(error || analysis.error || maps.error) && (
          <p role="alert">{error || analysis.error || maps.error}</p>
        )}
      </Panel>
    </div>
  );
}
