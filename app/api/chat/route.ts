import Anthropic from "@anthropic-ai/sdk";
import { google, calendar_v3 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type StoredCalendar = {
  id: string;
  name: string;
  primary?: boolean;
  accessRole: string;
};

const MAX_TOOL_ITERATIONS = 5;
const MODEL = "claude-sonnet-4-6";

const tools: Anthropic.Tool[] = [
  {
    name: "create_calendar_event",
    description: "Luo tapahtuman käyttäjän valitsemaan kalenteriin",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Tapahtuman nimi" },
        start: { type: "string", description: "Alkamisaika ISO 8601 -muodossa" },
        end: { type: "string", description: "Loppumisaika ISO 8601 -muodossa" },
        description: { type: "string", description: "Lisätiedot" },
        calendar_id: {
          type: "string",
          description: 'Kohdekalenterin id. Käytä "primary" pääkalenteriin tai yksi käyttäjän kalentereista. Oletus "primary".',
        },
        allow_duplicate: {
          type: "boolean",
          description: "Aseta true vain kun käyttäjä on nimenomaan vahvistanut samannimisen päällekkäisen tapahtuman lisäämisen. Oletus false — silloin samanniminen päällekkäinen tapahtuma estää lisäyksen.",
        },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "get_calendar_events",
    description: "Hakee tapahtumat yhdestä tai useammasta kalenterista",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Kuinka monelta päivältä eteenpäin haetaan, oletus 30" },
        calendar_ids: {
          type: "array",
          items: { type: "string" },
          description: 'Lista kalenterien id:istä. Oletus ["primary"].',
        },
      },
      required: [],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Poistaa tapahtuman kalenterista",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Poistettavan tapahtuman id" },
        calendar_id: { type: "string", description: 'Kalenterin id jossa tapahtuma sijaitsee. Oletus "primary".' },
      },
      required: ["event_id"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Muokkaa olemassa olevan tapahtuman tietoja",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Muokattavan tapahtuman id" },
        calendar_id: { type: "string", description: 'Kalenterin id jossa tapahtuma sijaitsee. Oletus "primary".' },
        title: { type: "string", description: "Uusi nimi" },
        start: { type: "string", description: "Uusi alkamisaika ISO 8601" },
        end: { type: "string", description: "Uusi loppumisaika ISO 8601" },
        description: { type: "string", description: "Uudet lisätiedot" },
      },
      required: ["event_id"],
    },
  },
];

function getOAuthClient(tokens: string, redirectUri: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
  oauth2Client.setCredentials(JSON.parse(tokens));
  return oauth2Client;
}

function buildSystemPrompt(calendars: StoredCalendar[]): string {
  const helsinkiNow = new Date().toLocaleString("fi-FI", {
    timeZone: "Europe/Helsinki",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isoNow = new Date().toISOString();

  const calendarLines =
    calendars.length > 0
      ? calendars
          .map((c) => {
            const labels: string[] = [];
            if (c.primary) labels.push("oletus, primary");
            if (c.accessRole === "reader") labels.push("vain luku");
            const labelStr = labels.length ? ` (${labels.join(", ")})` : "";
            return `- ${c.name}${labelStr} — id: ${c.id}`;
          })
          .join("\n")
      : '- Ei kalenteritietoja saatavilla. Käytä id-arvoa "primary".';

  return `Olet Bantu, avulias kalenteri-assistentti. Vastaa aina suomeksi. Älä käytä emojeita.

AIKA:
- Nyt on ${helsinkiNow} (Europe/Helsinki)
- ISO-muodossa: ${isoNow}
- Käytä aina Europe/Helsinki-aikavyöhykettä tapahtumien luonnissa, ellei käyttäjä erikseen pyydä muuta.

KÄYTTÄJÄN KALENTERIT:
${calendarLines}

OHJEET:
- Uudet tapahtumat lisätään oletuksena käyttäjän pääkalenteriin (calendar_id="primary"), ellei käyttäjä erikseen mainitse toista kalenteria nimellä.
- Kun käyttäjä viittaa kalenteriin nimellä (esim. "työvuorot", "juhlapyhät", "opinnot"), valitse oikea kalenteri yllä olevasta listasta nimen perusteella ja käytä sen id:tä.
- Älä yritä luoda tai muokata tapahtumia kalenteriin jonka accessRole on "vain luku".
- Jos käyttäjä kysyy yleisesti tapahtumiaan ilman kalenterirajausta, hae omistuksessa olevista kalentereista (ei jaetuista vain-luku-kalentereista).
- Hotellivaraukset, matkat ja yöpymiset ovat YKSI pitkäkestoinen tapahtuma — älä jaa niitä päiväksi kerrallaan.
- Jos loppuaikaa ei mainita ja kyse on yhdestä aktiviteetista, käytä yhden tunnin oletusta.
- Nimeä tapahtumat lyhyesti ja selkeästi.
- Jos käyttäjä pyytää poistamaan tai muokkaamaan tapahtumaa, hae ensin get_calendar_events:lla oikean kalenterin id ja event_id, ja käytä niitä sitten poistossa/muokkauksessa.
- Jos create_calendar_event palauttaa status="duplicate", älä yritä lisätä uudelleen samoin parametrein. Kerro käyttäjälle löytyneestä päällekkäisestä tapahtumasta ja kysy haluaako hän silti lisätä uuden — vasta vahvistuksen jälkeen kutsu uudelleen parametrilla allow_duplicate=true.

KUVAN KÄSITTELY:
- Jos viestissä on kuva ja siinä näkyy mitä tahansa tapahtumia, menoja, työvuoroja, aikatauluja, lippuja tai kutsuja, tunnista ne kaikki.
- Jos käyttäjä on kertonut viestissään mihin kalenteriin tapahtumat lisätään, lisää ne suoraan create_calendar_event-työkalulla.
- Jos kohdekalenteri ei ole selvä, listaa ensin tunnistetut tapahtumat lyhyesti ja kysy käyttäjältä mihin kalenteriin lisätään. Älä lisää mitään ennen vastausta.

KOHTELIAISUUS:
- Jos käyttäjä kiittää ilman pyyntöä, vastaa "Ole hyvä!" ja kysy voitko auttaa muissa asioissa. Listaa lyhyesti mitä voit tehdä:
  • Lisätä tapahtumia kalenteriin
  • Hakea tulevia tapahtumia
  • Muokata tai poistaa tapahtumia
  • Lukea kuvasta tapahtumia, menoja tai aikatauluja`;
}

async function executeTool(
  block: { id: string; name: string; input: unknown },
  calendar: calendar_v3.Calendar
): Promise<string> {
  try {
    if (block.name === "create_calendar_event") {
      const input = block.input as {
        title: string;
        start: string;
        end: string;
        description?: string;
        calendar_id?: string;
        allow_duplicate?: boolean;
      };
      const calId = input.calendar_id || "primary";

      if (!input.allow_duplicate) {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
        const newTitle = normalize(input.title);

        const existing = await calendar.events.list({
          calendarId: calId,
          timeMin: input.start,
          timeMax: input.end,
          singleEvents: true,
        });

        const duplicate = existing.data.items?.find(
          (e) => e.summary && normalize(e.summary) === newTitle
        );

        if (duplicate) {
          return JSON.stringify({
            status: "duplicate",
            message:
              "Samanniminen ja päällekkäinen tapahtuma löytyi. Kerro käyttäjälle ja kysy halutaanko silti lisätä — jos kyllä, kutsu uudelleen parametrilla allow_duplicate=true.",
            existing: {
              id: duplicate.id,
              title: duplicate.summary,
              start: duplicate.start?.dateTime || duplicate.start?.date,
              end: duplicate.end?.dateTime || duplicate.end?.date,
              description: duplicate.description,
            },
          });
        }
      }

      const created = await calendar.events.insert({
        calendarId: calId,
        requestBody: {
          summary: input.title,
          description: input.description,
          start: { dateTime: input.start, timeZone: "Europe/Helsinki" },
          end: { dateTime: input.end, timeZone: "Europe/Helsinki" },
        },
      });

      return JSON.stringify({
        status: "created",
        id: created.data.id,
        title: input.title,
        start: input.start,
        end: input.end,
        calendar_id: calId,
      });
    }

    if (block.name === "get_calendar_events") {
      const input = block.input as { days?: number; calendar_ids?: string[] };
      const days = input.days ?? 30;
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + days);

      const ids = input.calendar_ids?.length ? input.calendar_ids : ["primary"];
      const all: object[] = [];

      for (const id of ids) {
        try {
          const events = await calendar.events.list({
            calendarId: id,
            timeMin: new Date().toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
          });
          for (const e of events.data.items ?? []) {
            all.push({
              id: e.id,
              title: e.summary,
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
              calendar_id: id,
            });
          }
        } catch {
          // skip inaccessible calendar
        }
      }

      return JSON.stringify(all);
    }

    if (block.name === "delete_calendar_event") {
      const input = block.input as { event_id: string; calendar_id?: string };
      const calId = input.calendar_id || "primary";
      await calendar.events.delete({ calendarId: calId, eventId: input.event_id });
      return JSON.stringify({ status: "deleted", event_id: input.event_id });
    }

    if (block.name === "update_calendar_event") {
      const input = block.input as {
        event_id: string;
        calendar_id?: string;
        title?: string;
        start?: string;
        end?: string;
        description?: string;
      };
      const calId = input.calendar_id || "primary";
      const patch: Record<string, unknown> = {};
      if (input.title) patch.summary = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.start) patch.start = { dateTime: input.start, timeZone: "Europe/Helsinki" };
      if (input.end) patch.end = { dateTime: input.end, timeZone: "Europe/Helsinki" };
      await calendar.events.patch({ calendarId: calId, eventId: input.event_id, requestBody: patch });
      return JSON.stringify({ status: "updated", event_id: input.event_id });
    }

    return JSON.stringify({ status: "error", message: `Tuntematon työkalu: ${block.name}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tuntematon virhe";
    return JSON.stringify({ status: "error", message });
  }
}

const encoder = new TextEncoder();

function send(obj: object): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: NextRequest) {
  const { messages, image } = await request.json();
  const tokens = request.cookies.get("google_tokens")?.value;
  const calendarsCookie = request.cookies.get("bantu_calendars")?.value;

  if (!tokens) {
    return NextResponse.json({ reply: "Kirjaudu ensin Google-tilille.", relogin: true });
  }

  const auth = getOAuthClient(tokens, `${request.nextUrl.origin}/api/auth/callback`);
  let refreshedTokens: string | null = null;
  const parsed = JSON.parse(tokens);

  if (parsed.expiry_date && parsed.expiry_date < Date.now() + 60_000) {
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
    } catch {
      // ignore — fall back to primary-only behavior
    }
  }

  const streamHeaders = new Headers({
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  if (refreshedTokens) {
    const prod = process.env.NODE_ENV === "production";
    streamHeaders.append(
      "Set-Cookie",
      `google_tokens=${encodeURIComponent(refreshedTokens)}; HttpOnly; Max-Age=${60 * 60 * 24 * 7}; Path=/; SameSite=Lax${prod ? "; Secure" : ""}`
    );
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
    }
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

        const toolResultBlocks: Array<{
          type: "tool_result";
          tool_use_id: string;
          content: string;
        }> = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const result = await executeTool(block, calendar);
          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }

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
