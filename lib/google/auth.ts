import { google } from "googleapis";
import type { NextRequest } from "next/server";

export type StoredCalendar = {
  id: string;
  name: string;
  primary?: boolean;
  accessRole: string;
};

export function createOAuthClient(origin: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${origin}/api/auth/callback`,
  );
}

// Behind a reverse proxy `request.nextUrl.origin` reflects the upstream
// (e.g. http://localhost:3000), not the public URL the browser saw. Trust the
// proxy's X-Forwarded-* headers when present, falling back to the request URL
// for direct hits (local dev without a proxy).
export function publicOriginOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(/:$/, "");
  return `${proto}://${host}`;
}

export const GOOGLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const googleCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: GOOGLE_COOKIE_MAX_AGE,
};

export function googleTokensSetCookieHeader(value: string): string {
  const o = googleCookieOptions;
  const parts = [
    `google_tokens=${encodeURIComponent(value)}`,
    "HttpOnly",
    `Max-Age=${o.maxAge}`,
    `Path=${o.path}`,
    "SameSite=Lax",
  ];
  if (o.secure) parts.push("Secure");
  return parts.join("; ");
}
