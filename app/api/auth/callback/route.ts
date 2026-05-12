import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NEXTAUTH_URL + "/api/auth/callback"
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const { tokens } = await oauth2Client.getToken(code);
  
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("google_tokens", JSON.stringify(tokens), {
    httpOnly: true,
    secure: false,
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}