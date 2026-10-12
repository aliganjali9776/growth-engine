import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { sessionRuntime } from "@/lib/server/session";
import { appMode } from "@/lib/server/saas-runtime";
import {
  platformOverview,
  requirePlatformAdmin,
} from "@/lib/server/services/platform-admin";
import { PlatformAdmin } from "@/components/admin/platform-admin";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  if (appMode() !== "saas") notFound();
  const { section = [] } = await params;
  if (
    section.length > 2 ||
    (section.length &&
      ![
        "users",
        "organizations",
        "assessments",
        "access-requests",
        "audit",
      ].includes(section[0])) ||
    (section.length === 2 &&
      !["organizations", "assessments"].includes(section[0]))
  )
    notFound();
  let runtime;
  try {
    runtime = await sessionRuntime(new Headers(await headers()));
  } catch {
    redirect("/login?returnTo=%2Fadmin");
  }
  try {
    await requirePlatformAdmin(runtime.db, runtime.user.id);
  } catch {
    notFound();
  }
  return (
    <PlatformAdmin
      initial={JSON.parse(
        JSON.stringify(await platformOverview(runtime.db, runtime.user.id)),
      )}
      section={section}
    />
  );
}
