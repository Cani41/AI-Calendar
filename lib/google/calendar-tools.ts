import { calendar_v3 } from "googleapis";

function buildEventTime(value: string, allDay: boolean): calendar_v3.Schema$EventDateTime {
  return allDay
    ? { date: value.slice(0, 10) }
    : { dateTime: value, timeZone: "Europe/Helsinki" };
}

function toISOTimestamp(s: string): string {
  return new Date(s.includes("T") ? s : `${s}T00:00:00Z`).toISOString();
}

export async function executeTool(
  block: { name: string; input: unknown },
  calendar: calendar_v3.Calendar,
): Promise<string> {
  try {
    if (block.name === "create_calendar_event") {
      const input = block.input as {
        title: string;
        start: string;
        end: string;
        description?: string;
        calendar_id?: string;
        all_day?: boolean;
        allow_duplicate?: boolean;
      };
      const calId = input.calendar_id || "primary";
      const allDay = input.all_day ?? false;

      if (!input.allow_duplicate) {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
        const newTitle = normalize(input.title);

        const existing = await calendar.events.list({
          calendarId: calId,
          timeMin: toISOTimestamp(input.start),
          timeMax: toISOTimestamp(input.end),
          q: input.title,
          maxResults: 50,
          singleEvents: true,
        });

        const duplicate = existing.data.items?.find(
          (e) => e.summary && normalize(e.summary) === newTitle,
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
          start: buildEventTime(input.start, allDay),
          end: buildEventTime(input.end, allDay),
        },
      });

      return JSON.stringify({
        status: "created",
        id: created.data.id,
        title: input.title,
        start: input.start,
        end: input.end,
        all_day: allDay,
        calendar_id: calId,
      });
    }

    if (block.name === "get_calendar_events") {
      const input = block.input as {
        from?: string;
        to?: string;
        query?: string;
        calendar_ids?: string[];
      };

      const timeMin = input.from ? toISOTimestamp(input.from) : new Date().toISOString();
      const timeMax = input.to
        ? toISOTimestamp(input.to)
        : new Date(new Date(timeMin).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const ids = input.calendar_ids?.length ? input.calendar_ids : ["primary"];
      const all: object[] = [];

      const lists = await Promise.all(
        ids.map((id) =>
          calendar.events
            .list({
              calendarId: id,
              timeMin,
              timeMax,
              q: input.query,
              maxResults: 100,
              singleEvents: true,
              orderBy: "startTime",
            })
            .then((res) => ({ id, items: res.data.items ?? [] }))
            .catch(() => ({ id, items: [] as calendar_v3.Schema$Event[] })),
        ),
      );

      for (const { id, items } of lists) {
        for (const e of items) {
          all.push({
            id: e.id,
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            all_day: !!e.start?.date && !e.start?.dateTime,
            location: e.location,
            description: e.description,
            calendar_id: id,
          });
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
        all_day?: boolean;
      };
      const calId = input.calendar_id || "primary";
      const allDay = input.all_day ?? false;
      const patch: Record<string, unknown> = {};
      if (input.title) patch.summary = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.start) patch.start = buildEventTime(input.start, allDay);
      if (input.end) patch.end = buildEventTime(input.end, allDay);
      await calendar.events.patch({
        calendarId: calId,
        eventId: input.event_id,
        requestBody: patch,
      });
      return JSON.stringify({ status: "updated", event_id: input.event_id });
    }

    return JSON.stringify({ status: "error", message: `Tuntematon työkalu: ${block.name}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tuntematon virhe";
    return JSON.stringify({ status: "error", message });
  }
}
