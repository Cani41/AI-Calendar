import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/", process.env.NEXTAUTH_URL ?? "http://localhost:3000")
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  for (const name of ["google_tokens", "bantu_calendars"]) {
    response.cookies.set(name, "", cookieOptions);
  }

  return response;
}
