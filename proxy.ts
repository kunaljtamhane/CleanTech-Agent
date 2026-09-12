import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const onChat = req.nextUrl.pathname.startsWith("/chat");

  if (onChat && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/chat/:path*"],
};
