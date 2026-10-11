import { headers } from "next/headers";
import { getSaaSRuntime, appMode } from "@/lib/server/saas-runtime";
import { authenticatedSession } from "@/lib/server/session";
import { invitationInfo } from "@/lib/server/services/companies";
import { InvitationPage } from "@/components/saas/pages";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (appMode() !== "saas")
    return <InvitationPage token={token} invitation={null} userEmail={null} />;
  const { db, auth } = await getSaaSRuntime();
  let invitation = null,
    userEmail = null;
  try {
    invitation = await invitationInfo(db, token);
  } catch {
    /* invalid tokens have one safe state */
  }
  try {
    userEmail = (
      await authenticatedSession(db, auth, new Headers(await headers()))
    ).user.email;
  } catch {
    /* public acceptance entry */
  }
  return (
    <InvitationPage
      token={token}
      invitation={invitation}
      userEmail={userEmail}
    />
  );
}
