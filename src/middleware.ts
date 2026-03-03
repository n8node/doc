import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    if (req.nextauth.token && req.nextUrl.pathname.startsWith("/admin")) {
      if (req.nextauth.token.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
