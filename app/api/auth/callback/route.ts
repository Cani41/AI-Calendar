import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import {
  createOAuthClient,
  googleCookieOptions,
  publicOriginOf,
  type StoredCalendar,
} from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("oauth_state")?.value;

  const clearStateCookie = (res: NextResponse) =>
    res.cookies.set("oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

  if (!code) {
    const res = NextResponse.redirect(new URL("/?error=missing_code", publicOriginOf(request)));
    clearStateCookie(res);
    return res;
  }

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    const res = NextResponse.redirect(new URL("/?error=state_mismatch", publicOriginOf(request)));
    clearStateCookie(res);
    return res;
  }

  const oauth2Client = createOAuthClient(publicOriginOf(request));

  let tokens;
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
  } catch {
    const res = NextResponse.redirect(new URL("/?error=auth_failed", publicOriginOf(request)));
    clearStateCookie(res);
    return res;
  }

  oauth2Client.setCredentials(tokens);

  let calendars: StoredCalendar[] = [];
  try {
    const calendarApi = google.calendar({ version: "v3", auth: oauth2Client });
    const list = await calendarApi.calendarList.list({ maxResults: 100 });
    calendars = (list.data.items ?? [])
      .filter((c) => c.id && (c.summaryOverride || c.summary))
      .map((c) => ({
        id: c.id!,
        name: c.summaryOverride || c.summary!,
        ...(c.primary ? { primary: true as const } : {}),
        accessRole: c.accessRole ?? "reader",
      }));
  } catch (err) {
    console.error("Failed to fetch calendar list", err);
  }

  const response = NextResponse.redirect(new URL("/dashboard", publicOriginOf(request)));
  response.cookies.set("google_tokens", JSON.stringify(tokens), googleCookieOptions);
  response.cookies.set("bantu_calendars", JSON.stringify(calendars), googleCookieOptions);
  clearStateCookie(response);

  return response;
}
