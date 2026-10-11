import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    process.env.NODE_ENV === "production" &&
    (path === "/dev" ||
      path.startsWith("/dev/") ||
      path === "/api/dev" ||
      path.startsWith("/api/dev/"))
  )
    return new NextResponse("Not Found", { status: 404 });
  const publicRoute =
    path === "/login" ||
    path === "/signup" ||
    path.startsWith("/invite/") ||
    path.startsWith("/api/");
  if (
    (process.env.APP_MODE ?? "saas") === "saas" &&
    !publicRoute &&
    !getSessionCookie(request)
  ) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("returnTo", path);
    return NextResponse.redirect(destination);
  }
  const headers = new Headers(request.headers);
  headers.set("x-app-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
