"use client";
import { useEffect, useState } from "react";
import { saasRequest, useSaaS } from "@/components/saas/shell";
import {
  agentActionPermissionMap,
  agentActionLabels,
} from "@/lib/saas/agent-action-permissions";
export default function AuthorizedActionsPage() {
  const view = useSaaS();
  const [data, setData] = useState<{ actions: any[]; approvals: any[] }>({
    actions: [],
    approvals: [],
  });
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [capabilityId, setCapability] = useState("strategy.createInitiative");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const organizationId = view?.current?.id;
  async function load() {
    if (!organizationId) return;
    const r = await fetch("/api/saas?operation=agentActions", {
      headers: { "x-organization-id": organizationId },
    });
    if (!r.ok) throw Error("شما برای انجام این عملیات دسترسی لازم را ندارید.");
    setData(await r.json());
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [organizationId]);
  async function perform(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await saasRequest(body, organizationId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  if (!view) return <p>این مسیر به فضای شرکتی نیاز دارد.</p>;
  const canPrepare = view.permissions.includes("agent.prepare");
  const canApprove = view.permissions.includes("agent.approve");
  return (
    <section className="saas-card">
      <h1>آماده‌سازی و تأیید شرکتی</h1>
      <p>
        پیش‌نویس‌ها بین اعضای مجاز شرکت مشترک هستند. آماده‌سازی و تأیید هیچ
        تغییری در داده‌های کسب‌وکار ایجاد نمی‌کند.
      </p>
      {error && <p role="alert">{error}</p>}
      {canPrepare ? (
        <form
          className="saas-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              perform({
                operation: "prepareAgentAction",
                capabilityId,
                title,
                payload: { title, notes },
              });
            } catch {
              setError("ساختار پیش‌نویس معتبر نیست.");
            }
          }}
        >
          <label className="saas-field">
            نوع اقدام
            <select
              value={capabilityId}
              onChange={(e) => setCapability(e.target.value)}
            >
              {Object.keys(agentActionPermissionMap).map((id) => (
                <option key={id} value={id}>
                  {agentActionLabels[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="saas-field">
            عنوان
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="saas-field">
            شرح پیشنهاد
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button className="saas-primary" disabled={busy}>
            آماده‌سازی برای بررسی
          </button>
        </form>
      ) : (
        <p>نقش شما اجازه آماده‌سازی ندارد.</p>
      )}
      <ul>
        {data.actions.map((action) => (
          <li key={action.id}>
            <strong>{action.title}</strong>
            <p>
              وضعیت:{" "}
              {action.status === "Approved"
                ? "تأییدشده"
                : action.status === "Rejected"
                  ? "ردشده"
                  : "پیش‌نویس"}{" "}
              · آماده‌کننده: {action.preparedByName}
            </p>
            {data.approvals
              .filter((a) => a.actionId === action.id)
              .map((a) => (
                <p key={a.id}>
                  تأییدکننده: {a.approvedByName} ·{" "}
                  {a.decision === "Approved" ? "تأییدشده" : "ردشده"}
                </p>
              ))}
            {canApprove && action.status === "Draft" && (
              <button
                className="saas-primary"
                disabled={busy}
                onClick={() =>
                  perform({
                    operation: "approveAgentAction",
                    actionId: action.id,
                    revision: action.revision,
                    decision: "Approved",
                  })
                }
              >
                تأیید پیش‌نویس
              </button>
            )}
            <p>اجرای واقعی تا مهاجرت اجرای سروری غیرفعال است.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
