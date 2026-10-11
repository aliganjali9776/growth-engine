"use client";
export default function ErrorPage({reset}:{reset:()=>void}){
  return <section className="saas-card" style={{maxWidth:620,margin:"60px auto"}}><h1>ارتباط با فضای مدیریت برقرار نشد</h1><p>سامانه یا پایگاه داده موقتاً در دسترس نیست. اطلاعات حساس خطا نمایش داده نمی‌شود.</p><button className="saas-primary" onClick={reset}>تلاش دوباره</button></section>;
}
