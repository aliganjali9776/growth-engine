import { ScaleDashboard } from "@/components/scale/dashboard";
import Link from "next/link";
export default function Page() {
  return (
    <>
      <Link className="sys-text-link" href="/advisor/workspace">
        خلاصه مدیریتی در مشاور ←
      </Link>
      <ScaleDashboard />
    </>
  );
}
