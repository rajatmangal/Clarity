import { NextResponse } from "next/server";
import { authorized, allowedOrigins } from "./lib/access.mjs";
export function proxy(request) {
  if (
    !allowedOrigins().some(
      (origin) => new URL(origin).host === request.headers.get("host"),
    )
  )
    return new NextResponse("Host not allowed", { status: 403 });
  if (!authorized(request.headers))
    return new NextResponse("Sign in to Clarity", {
      status: 401,
      headers: process.env.CLARITY_DESKTOP_SECRET
        ? {}
        : { "WWW-Authenticate": 'Basic realm="Clarity", charset="UTF-8"' },
    });
  return NextResponse.next();
}
