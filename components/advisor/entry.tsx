import Link from "next/link";
export function AdvisorEntry({
  type,
  id,
}: {
  type: "process" | "objective" | "kr" | "constraint" | "experiment" | "candidate";
  id: string;
}) {
  return (
    <Link
      className="sys-text-link"
      style={{ display: "inline-flex", margin: "12px 0" }}
      href={`/advisor/workspace?context=${type}&id=${encodeURIComponent(id)}`}
    >
      از مشاور بپرس ←
    </Link>
  );
}
