import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
];

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const tokens = request.cookies.get("google_tokens")?.value;

    if (!tokens) {
      return NextResponse.json({ reply: "Kirjaudu ensin Google-tilille." });
    }

    const auth = getOAuthClient(tokens);
    const calendar = google.calendar({ version: "v3", auth });

    const anthropicMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      tools,
      system: `Olet avulias kalenteri-assistentti. Tänään on ${new Date().toISOString()}.
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
- Jos käyttäjä pyytää poistamaan tapahtuman, hae ensin tapahtumat get_calendar_events-työkalulla ja sitten poista oikea tapahtuma delete_calendar_event-työkalulla.`,
      messages: anthropicMessages,
    });

    let reply = "";
    const toolResults: Anthropic.MessageParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        reply = block.text;
      } else if (block.type === "tool_use") {
        if (block.name === "create_calendar_event") {
          const input = block.input as {
            title: string;
            start: string;
            end: string;
            description?: string;
          };

          await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
              summary: input.title,
              description: input.description,
              start: { dateTime: input.start, timeZone: "Europe/Helsinki" },
              end: { dateTime: input.end, timeZone: "Europe/Helsinki" },
            },
          });

          reply = `Tapahtuma "${input.title}" lisatty kalenteriin.`;

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

          await calendar.events.delete({
            calendarId: "primary",
            eventId: input.event_id,
          });

          reply = `Tapahtuma "${input.event_title}" poistettu kalenterista.`;
        }
      }
    }

    if (toolResults.length > 0) {
      const followUp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        tools,
        system: `Olet avulias kalenteri-assistentti. Vastaa aina suomeksi. Älä käytä emojeita.`,
        messages: [
          ...anthropicMessages,
          { role: "assistant", content: response.content },
          ...toolResults,
        ],
      });

      for (const block of followUp.content) {
        if (block.type === "text") reply = block.text;
        else if (block.type === "tool_use" && block.name === "delete_calendar_event") {
          const input = block.input as { event_id: string; event_title: string };
          await calendar.events.delete({
            calendarId: "primary",
            eventId: input.event_id,
          });
          reply = `Tapahtuma "${input.event_title}" poistettu kalenterista.`;
        }
      }
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ reply: "Virhe: " + String(error) }, { status: 500 });
  }
}