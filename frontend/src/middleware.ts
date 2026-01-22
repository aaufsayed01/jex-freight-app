import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/quotes/:path*",
    "/staff/:path*",
    "/admin/:path*",
  ],
};



