import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appMode, getSaaSRuntime } from "@/lib/server/saas-runtime";
import { authenticatedSession, activeContext } from "@/lib/server/session";
import { listOrganizations } from "@/lib/server/services/companies";
import { readTenantWorkspace } from "@/lib/server/services/workspace";
import {
  WorkspaceBridge,
  SaaSShell,
  type SaaSView,
} from "@/components/saas/shell";
import { safeReturn } from "@/lib/saas/navigation";
import { permissionForPage } from "@/lib/server/permissions";
export default async function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  if (appMode() === "local") return children;
  const requestHeaders = await headers(),
    path = safeReturn(requestHeaders.get("x-app-path")),
    pathname = path.split("?")[0];
  if (
    ["/login", "/signup"].includes(pathname) ||
    pathname.startsWith("/invite/")
  )
    return children;
  const { db, auth } = await getSaaSRuntime();
  let identity;
  try {
    identity = await authenticatedSession(
      db,
      auth,
      new Headers(requestHeaders),
    );
  } catch {
    redirect("/login?returnTo=" + encodeURIComponent(path));
  }
  const organizations = await listOrganizations(db, identity.user.id);
  const view: SaaSView = {
    user: {
      id: identity.user.id,
      name: identity.user.name,
      email: identity.user.email,
      locale: identity.user.locale,
      timezone: identity.user.timezone,
      avatarUrl: identity.user.avatarUrl,
    },
    organizations,
    current: null,
    permissions: [],
  };
  if (
    ["/organizations", "/onboarding/company", "/settings/profile"].includes(
      pathname,
    )
  )
    return (
      <SaaSShell
        view={{
          ...view,
          current:
            organizations.find(
              (o) => o.id === identity.session.activeOrganizationId,
            ) ?? null,
        }}
      >
        {children}
      </SaaSShell>
    );
  let active;
  try {
    active = await activeContext(db, auth, new Headers(requestHeaders));
  } catch {
    redirect(organizations.length ? "/organizations" : "/onboarding/company");
  }
  view.current =
    organizations.find((o) => o.id === active.context.organizationId) ?? null;
  view.permissions = active.context.permissions;
  if (!view.permissions.includes(permissionForPage(pathname)))
    return (
      <SaaSShell view={view}>
        <section role="alert" className="panel">
          <h1>دسترسی محدود</h1>
          <p>شما برای انجام این عملیات دسترسی لازم را ندارید.</p>
        </section>
      </SaaSShell>
    );
  const initial = await readTenantWorkspace(db, active.context);
  return (
    <WorkspaceBridge
      key={active.context.organizationId + identity.user.id}
      view={view}
      initial={initial}
    >
      {children}
    </WorkspaceBridge>
  );
}
