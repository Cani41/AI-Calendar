import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function formatFinnishDateTime(iso: string | null | undefined): string {
  if (!iso) return "tuntematon";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fi-FI", {
    timeZone: "Europe/Helsinki",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOAuthClient(tokens: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback"
  );
  oauth2Client.setCredentials(JSON.parse(tokens));
  return oauth2Client;
}

const tools: Anthropic.Tool[] = [
  {
    name: "create_calendar_event",
    description: "Luo tapahtuman Google-kalenteriin",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Tapahtuman nimi" },
        start: { type: "string", description: "Alkamisaika ISO 8601 -muodossa" },
        end: { type: "string", description: "Loppumisaika ISO 8601 -muodossa" },
        description: { type: "string", description: "Lisätiedot" },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "get_calendar_events",
    description: "Hakee tapahtumat Google-kalenterista",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Kuinka monen päivän tapahtumat haetaan, oletus 30" },
        calendar_ids: { type: "array", items: { type: "string" }, description: "Lista kalenterin ID:istä" },
      },
      required: [],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Poistaa tapahtuman Google-kalenterista",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Poistettavan tapahtuman ID" },
        event_title: { type: "string", description: "Tapahtuman nimi vahvistukseksi" },
      },
      required: ["event_id", "event_title"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Muokkaa olemassa olevan tapahtuman tietoja Google-kalenterissa",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "Muokattavan tapahtuman ID" },
        title: { type: "string", description: "Uusi nimi" },
        start: { type: "string", description: "Uusi alkamisaika ISO 8601 -muodossa" },
        end: { type: "string", description: "Uusi loppumisaika ISO 8601 -muodossa" },
        description: { type: "string", description: "Uudet lisätiedot" },
      },
      required: ["event_id"],
    },
  },
];

const ETYOVUOROT_CALENDAR_ID = "cufrl83s2cnnf4bq5t46k282ms@group.calendar.google.com";

const encoder = new TextEncoder();

function send(obj: object): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: NextRequest) {
  const { messages, image } = await request.json();
  const tokens = request.cookies.get("google_tokens")?.value;

  if (!tokens) {
    return NextResponse.json({ reply: "Kirjaudu ensin Google-tilille.", relogin: true });
  }

  const auth = getOAuthClient(tokens);
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

  const systemPrompt = `Olet Bantu, avulias kalenteri-assistentti. Tänään on ${new Date().toISOString()}.
Vastaa aina suomeksi.

KALENTERIEN ID:T:
- Tapahtumat (omat tapahtumat): santerikananen@gmail.com
- Elisa Työvuorot: cufrl83s2cnnf4bq5t46k282ms@group.calendar.google.com
- Suomen juhlapyhät: fi.finnish#holiday@group.v.calendar.google.com
- SISU (yliopisto): m0g359q6bvk035bf17d7e80gh361k9lb@import.calendar.google.com

TÄRKEÄT SÄÄNNÖT:
- Uudet tapahtumat lisätään aina Tapahtumat-kalenteriin (santerikananen@gmail.com).
- Jos käyttäjä kysyy omista tapahtumistaan tai mitä on tulossa, hae Tapahtumat-kalenterista.
- Jos käyttäjä kysyy työvuoroista, hae Elisa Työvuorot -kalenterista.
- Jos käyttäjä kysyy juhlapyhistä tai merkkipäivistä, hae Suomen juhlapyhät -kalenterista.
- Jos käyttäjä kysyy koulusta tai opinnoista, hae SISU-kalenterista.
- Jos käyttäjä kysyy kaikesta tai "mitä minulla on", hae kaikista paitsi sanna.kananen1@gmail.com.
- Jos käyttäjä mainitsee matkan tai tapahtuman jossa on alkamis- ja loppumisaika, lisää YKSI tapahtuma.
- Hotellivaraukset ja matkat ovat aina yksittäisiä pitkäkestoisia tapahtumia.
- Jos loppuaikaa ei ole määritelty, käytä päivän loppua (23:59).
- Älä käytä emojeita missään vastauksissa.
- Varmista että kaikki tapahtumat luodaan Europe/Helsinki-aikavyöhykkeessä ellei muuta mainita.
- Nimeä tapahtumat yksinkertaisesti, esim. kaupungin nimi tai tapahtuman nimi suoraan otsikoksi.
- Jos käyttäjä pyytää poistamaan tapahtuman, hae ensin tapahtumat get_calendar_events-työkalulla ja sitten poista oikea tapahtuma delete_calendar_event-työkalulla.
- Jos käyttäjä pyytää muokkaamaan tapahtumaa, hae ensin tapahtumat get_calendar_events-työkalulla ja sitten muokkaa oikeaa tapahtumaa update_calendar_event-työkalulla.
- Jos käyttäjä kiittää eikä pyydä mitään tehtävää, vastaa "Ole hyvä!" ja kysy voitko auttaa muissa asioissa. Listaa lyhyesti mitä voit tehdä, esimerkiksi:
  • Lisätä tapahtumia kalenteriin
  • Hakea tulevia tapahtumia
  • Muokata tai poistaa tapahtumia
  • Kertoa työvuoroista, juhlapyhistä tai opinnoista`;

  async function* generate(): AsyncGenerator<Uint8Array> {
    try {
      // Image handling
      if (image) {
        const visionResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: image.data,
                },
              },
              {
                type: "text",
                text: `Analysoi tämä työvuorolista. Tunnista kaikki työvuorot ja palauta ne täsmälleen tässä JSON-muodossa, ei mitään muuta tekstiä:
{
  "shifts": [
    { "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM" }
  ]
}
Tänään on ${new Date().toISOString().slice(0, 10)}. Jos kuvassa ei näy vuotta, käytä kuluvaa vuotta. Jos et löydä työvuoroja, palauta { "shifts": [] }.`,
              },
            ],
          }],
        });

        const raw = visionResponse.content[0].type === "text" ? visionResponse.content[0].text : "";
        let shifts: { date: string; startTime: string; endTime: string }[] = [];

        try {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) shifts = JSON.parse(match[0]).shifts ?? [];
        } catch {
          yield send({ type: "delta", text: "En pystynyt lukemaan työvuoroja kuvasta. Varmista että kuva on selkeä työvuorolista." });
          yield send({ type: "done" });
          return;
        }

        if (shifts.length === 0) {
          yield send({ type: "delta", text: "En löytänyt kuvasta työvuoroja. Varmista että kuva sisältää työvuorolistan." });
          yield send({ type: "done" });
          return;
        }

        let created = 0;
        const failed: string[] = [];

        for (const shift of shifts) {
          try {
            await calendar.events.insert({
              calendarId: ETYOVUOROT_CALENDAR_ID,
              requestBody: {
                summary: "Työvuoro",
                start: { dateTime: `${shift.date}T${shift.startTime}:00`, timeZone: "Europe/Helsinki" },
                end: { dateTime: `${shift.date}T${shift.endTime}:00`, timeZone: "Europe/Helsinki" },
              },
            });
            created++;
          } catch {
            failed.push(`${shift.date} ${shift.startTime}–${shift.endTime}`);
          }
        }

        let reply = `Tunnistin kuvasta **${shifts.length} työvuoroa** ja lisäsin **${created}** Elisa Työvuorot -kalenteriin.`;
        if (failed.length > 0) {
          reply += `\n\nEpäonnistui:\n${failed.map((f) => `- ${f}`).join("\n")}`;
        }

        const shiftList = shifts
          .map((s) => `- ${formatFinnishDateTime(`${s.date}T${s.startTime}:00`).replace(",", "")} – ${s.endTime}`)
          .join("\n");
        reply += `\n\n**Lisätyt vuorot:**\n${shiftList}`;

        yield send({ type: "delta", text: reply });
        yield send({ type: "done" });
        return;
      }

      const anthropicMessages: Anthropic.MessageParam[] = messages.map(
        (m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })
      );

      // First call — stream text directly if Claude responds with text,
      // or collect tool use blocks if it calls a tool.
      const firstStream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        tools,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      let firstHasText = false;

      for await (const event of firstStream) {
        if (event.type === "content_block_start" && event.content_block.type === "text") {
          firstHasText = true;
        }
        if (event.type === "content_block_delta" && event.delta.type === "text_delta" && firstHasText) {
          yield send({ type: "delta", text: event.delta.text });
        }
      }

      const firstResponse = await firstStream.finalMessage();

      // Execute any tool calls from the first response
      const toolResults: Anthropic.MessageParam[] = [];
      let directReply = "";

      for (const block of firstResponse.content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "create_calendar_event") {
          const input = block.input as { title: string; start: string; end: string; description?: string };

          const startDate = new Date(input.start);
          const dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(startDate);
          dayEnd.setHours(23, 59, 59, 999);

          const existing = await calendar.events.list({
            calendarId: "primary",
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
            singleEvents: true,
          });

          const duplicate = existing.data.items?.find(
            (e) => e.summary?.toLowerCase() === input.title.toLowerCase()
          );

          if (duplicate) {
            const dupStart = duplicate.start?.dateTime || duplicate.start?.date;
            const dupEnd = duplicate.end?.dateTime || duplicate.end?.date;
            directReply =
              `Samankaltainen tapahtuma löytyy jo kalenteristasi:\n\n` +
              `**${duplicate.summary}**\n` +
              `Alkaa: ${formatFinnishDateTime(dupStart)}\n` +
              `Päättyy: ${formatFinnishDateTime(dupEnd)}` +
              (duplicate.description ? `\nLisätiedot: ${duplicate.description}` : "");
          } else {
            await calendar.events.insert({
              calendarId: "primary",
              requestBody: {
                summary: input.title,
                description: input.description,
                start: { dateTime: input.start, timeZone: "Europe/Helsinki" },
                end: { dateTime: input.end, timeZone: "Europe/Helsinki" },
              },
            });
            directReply = `Tapahtuma "${input.title}" lisätty kalenteriin.`;
          }

        } else if (block.name === "get_calendar_events") {
          const input = block.input as { days?: number; calendar_ids?: string[] };
          const days = input.days || 30;
          const timeMax = new Date();
          timeMax.setDate(timeMax.getDate() + days);

          const calendarIds = input.calendar_ids || ["primary"];
          const allEvents: object[] = [];

          for (const calId of calendarIds) {
            const events = await calendar.events.list({
              calendarId: calId,
              timeMin: new Date().toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: true,
              orderBy: "startTime",
            });

            const eventList = events.data.items?.map((e) => ({
              id: e.id,
              title: e.summary,
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
            }));

            if (eventList && eventList.length > 0) {
              allEvents.push(...eventList);
            }
          }

          toolResults.push({
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(allEvents),
            }],
          });

        } else if (block.name === "delete_calendar_event") {
          const input = block.input as { event_id: string; event_title: string };
          await calendar.events.delete({ calendarId: "primary", eventId: input.event_id });
          directReply = `Tapahtuma "${input.event_title}" poistettu kalenterista.`;

        } else if (block.name === "update_calendar_event") {
          const input = block.input as { event_id: string; title?: string; start?: string; end?: string; description?: string };
          const patch: Record<string, unknown> = {};
          if (input.title) patch.summary = input.title;
          if (input.description !== undefined) patch.description = input.description;
          if (input.start) patch.start = { dateTime: input.start, timeZone: "Europe/Helsinki" };
          if (input.end) patch.end = { dateTime: input.end, timeZone: "Europe/Helsinki" };
          await calendar.events.patch({ calendarId: "primary", eventId: input.event_id, requestBody: patch });
          directReply = "Tapahtuma päivitetty.";
        }
      }

      if (directReply) {
        yield send({ type: "delta", text: directReply });
      } else if (toolResults.length > 0) {
        // Follow-up call after get_calendar_events — stream the formatted response
        const followUpStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          tools,
          system: `Olet Bantu, avulias kalenteri-assistentti. Tänään on ${new Date().toISOString()}. Vastaa aina suomeksi. Älä käytä emojeita.`,
          messages: [
            ...anthropicMessages,
            { role: "assistant", content: firstResponse.content },
            ...toolResults,
          ],
        });

        let followUpHasText = false;

        for await (const event of followUpStream) {
          if (event.type === "content_block_start" && event.content_block.type === "text") {
            followUpHasText = true;
          }
          if (event.type === "content_block_delta" && event.delta.type === "text_delta" && followUpHasText) {
            yield send({ type: "delta", text: event.delta.text });
          }
        }

        const followUpResponse = await followUpStream.finalMessage();

        // Handle delete/update tool calls in the follow-up (e.g. delete after get)
        let followUpDirectReply = "";
        for (const block of followUpResponse.content) {
          if (block.type !== "tool_use") continue;

          if (block.name === "delete_calendar_event") {
            const input = block.input as { event_id: string; event_title: string };
            await calendar.events.delete({ calendarId: "primary", eventId: input.event_id });
            followUpDirectReply = `Tapahtuma "${input.event_title}" poistettu kalenterista.`;
          } else if (block.name === "update_calendar_event") {
            const input = block.input as { event_id: string; title?: string; start?: string; end?: string; description?: string };
            const patch: Record<string, unknown> = {};
            if (input.title) patch.summary = input.title;
            if (input.description !== undefined) patch.description = input.description;
            if (input.start) patch.start = { dateTime: input.start, timeZone: "Europe/Helsinki" };
            if (input.end) patch.end = { dateTime: input.end, timeZone: "Europe/Helsinki" };
            await calendar.events.patch({ calendarId: "primary", eventId: input.event_id, requestBody: patch });
            followUpDirectReply = "Tapahtuma päivitetty.";
          }
        }

        if (followUpDirectReply) {
          yield send({ type: "delta", text: followUpDirectReply });
        }
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
