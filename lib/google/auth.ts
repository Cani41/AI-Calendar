import { google } from "googleapis";

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
