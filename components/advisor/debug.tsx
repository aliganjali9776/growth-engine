"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useEffect, useState } from "react";
import { readAdvisor } from "@/lib/advisor-storage";
export function AdvisorDebug() {
  const [data, setData] = useState<unknown>(null);
  function refresh() {
    const s = readAdvisor(businessStorage).store.session;
    const r = s?.messages.filter((m) => m.response).at(-1)?.response;
    fetch("/api/advisor")
      .then((x) => x.json())
      .then((status) =>
        setData({
          selectedContext: s?.currentContext ?? null,
          evidenceCount: s?.lastPacket?.evidence.length ?? 0,
          provider: r?.provider ?? status.provider,
          model: r?.model ?? status.model,
          promptVersion: r?.promptVersion ?? status.promptVersion,
          schemaValidated: r?.schemaValidated ?? false,
          capabilityIds: s?.lastCapabilities ?? [],
          contextPacket: s?.lastPacket ?? null,
          audit: s?.audit ?? [],
        }),
      )
      .catch(() => setData({ error: "اتصال برقرار نشد" }));
  }
  useEffect(refresh, []);
  return (
    <section
      style={{
        padding: 24,
        border: "1px solid #e7eae9",
        margin: 24,
        borderRadius: 8,
      }}
    >
      <h2>Build 6B · Advisor debug</h2>
      <p>فقط زمینه منتخب و وضعیت مدل؛ بدون کلید یا داده کامل کسب‌وکار.</p>
      <button className="button secondary" onClick={refresh}>
        بازخوانی وضعیت مشاور
      </button>
      <details>
        <summary>جزئیات زمینه و اعتبارسنجی</summary>
        <pre
          dir="ltr"
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: 11,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </section>
  );
}
