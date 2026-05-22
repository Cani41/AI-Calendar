import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import { tools } from "@/lib/anthropic/tools";
import { buildSystemPrompt } from "@/lib/anthropic/system-prompt";
import { executeTool } from "@/lib/google/calendar-tools";
import {
  createOAuthClient,
  googleTokensSetCookieHeader,
  type StoredCalendar,
} from "@/lib/google/auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_TOOL_ITERATIONS = 5;
const MODEL = "claude-sonnet-4-6";

const encoder = new TextEncoder();

function send(obj: object): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: NextRequest) {
  const { messages, image } = await request.json();
  const tokensRaw = request.cookies.get("google_tokens")?.value;
  const calendarsCookie = request.cookies.get("bantu_calendars")?.value;

  if (!tokensRaw) {
    return NextResponse.json({ reply: "Kirjaudu ensin Google-tilille.", relogin: true });
  }

  let parsedTokens: { expiry_date?: number; access_token?: string; refresh_token?: string };
  try {
    parsedTokens = JSON.parse(tokensRaw);
  } catch {
    return NextResponse.json({ reply: "Kirjaudu ensin Google-tilille.", relogin: true });
  }

  const auth = createOAuthClient(request.nextUrl.origin);
  auth.setCredentials(parsedTokens);
  let refreshedTokens: string | null = null;

  if (parsedTokens.expiry_date && parsedTokens.expiry_date < Date.now() + 60_000) {
    try {
      const { credentials } = await auth.refreshAccessToken();
      auth.setCredentials(credentials);
      refreshedTokens = JSON.stringify(credentials);
    } catch {
      return NextResponse.json({
        reply: "Istuntosi on vanhentunut. Ole hyvä ja kirjaudu uudelleen.",
        relogin: true,
      });
    }
  }

  const calendar = google.calendar({ version: "v3", auth });

  let calendars: StoredCalendar[] = [];
  if (calendarsCookie) {
    try {
      calendars = JSON.parse(calendarsCookie);
    } catch (err) {
      console.error("Failed to parse bantu_calendars cookie", err);
    }
  }

  const streamHeaders = new Headers({
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  if (refreshedTokens) {
    streamHeaders.append("Set-Cookie", googleTokensSetCookieHeader(refreshedTokens));
  }

  const systemPrompt = buildSystemPrompt(calendars);

  const anthropicMessages: Anthropic.MessageParam[] = messages.map(
    (m: { role: string; content: string }, i: number) => {
      if (i === messages.length - 1 && m.role === "user" && image) {
        return {
          role: "user" as const,
          content: [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: image.data,
              },
            },
            {
              type: "text" as const,
              text: m.content || "Mitä tapahtumia näet tässä kuvassa?",
            },
          ],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    },
  );

  async function* generate(): AsyncGenerator<Uint8Array> {
    try {
      const conversation: Anthropic.MessageParam[] = [...anthropicMessages];

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 2000,
          tools,
          system: systemPrompt,
          messages: conversation,
        });

        let hasText = false;
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "text") {
            hasText = true;
          }
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            hasText
          ) {
            yield send({ type: "delta", text: event.delta.text });
          }
        }

        const response = await stream.finalMessage();
        conversation.push({ role: "assistant", content: response.content });

        const toolUseBlocks = response.content.filter(
          (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
        );
        const toolResultBlocks = await Promise.all(
          toolUseBlocks.map(async (block) => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: await executeTool(block, calendar),
          })),
        );

        if (toolResultBlocks.length === 0) break;
        conversation.push({ role: "user", content: toolResultBlocks });
      }

      yield send({ type: "done" });
    } catch (error) {
      console.error("Stream error:", error);
      yield send({ type: "error", message: "Verkkovirhe — tarkista yhteytesi ja yritä uudelleen." });
    }
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      for await (const chunk of generate()) {
        await writer.write(chunk);
      }
      await writer.close();
    } catch {
      await writer.abort().catch(() => {});
    }
  })();

  return new Response(readable, { headers: streamHeaders });
}
