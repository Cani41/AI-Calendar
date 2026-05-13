import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/", process.env.NEXTAUTH_URL ?? "http://localhost:3000")
  );
  response.cookies.set("google_tokens", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}
