import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section-card">
      <h1>این صفحه پیدا نشد.</h1>
      <p className="muted">از منوی اصلی، بخش موردنظر را انتخاب کنید.</p>
      <Link className="button" href="/">
        بازگشت به خانه
      </Link>
    </section>
  );
}
