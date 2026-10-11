import { CommandCenter } from "@/components/command-center/page";
import Link from "next/link";
export const metadata = { title: "مرکز فرمان سیستم | Growth Engine" };
export default function Page() {
  return (
    <>
      <Link className="sys-text-link" href="/advisor/workspace">
        خلاصه مدیریتی در مشاور ←
      </Link>
      <CommandCenter />
    </>
  );
}
