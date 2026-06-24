import { NextRequest, NextResponse } from "next/server";

import { createOAuthClient, publicOriginOf } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const oauth2Client = createOAuthClient(publicOriginOf(request));

  const state = crypto.randomUUID();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
