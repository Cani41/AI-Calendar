import { NextRequest, NextResponse } from "next/server";

import { googleCookieOptions } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const clearOptions = { ...googleCookieOptions, maxAge: 0 };

  for (const name of ["google_tokens", "bantu_calendars"]) {
    response.cookies.set(name, "", clearOptions);
  }

  return response;
}
