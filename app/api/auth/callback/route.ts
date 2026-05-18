import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

type StoredCalendar = {
  id: string;
  name: string;
  primary?: true;
  accessRole: string;
};

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback"
  );

  let tokens;
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
  } catch {
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
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
  } catch {
    // Calendar list fetch failed — chat will fall back to "primary" only.
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("google_tokens", JSON.stringify(tokens), cookieOptions);
  response.cookies.set("bantu_calendars", JSON.stringify(calendars), cookieOptions);

  return response;
}
