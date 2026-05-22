import type Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "create_calendar_event",
    description: "Luo tapahtuman käyttäjän valitsemaan kalenteriin",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Tapahtuman nimi" },
        start: {
          type: "string",
          description:
            'Alkamisaika. Kellotapahtumalle ISO 8601 -muodossa (esim. "2026-07-15T10:00:00"). Koko päivän tapahtumalle pelkkä päivämäärä (esim. "2026-07-15").',
        },
        end: {
          type: "string",
          description:
            'Loppumisaika. Kellotapahtumalle ISO 8601 -muodossa. Koko päivän tapahtumalle EKSKLUSIIVINEN loppupäivä — esim. tapahtumalle joka kestää 15.–25.7. käytä end="2026-07-26".',
        },
        description: { type: "string", description: "Lisätiedot" },
        calendar_id: {
          type: "string",
          description:
            'Kohdekalenterin id. Käytä "primary" pääkalenteriin tai yksi käyttäjän kalentereista. Oletus "primary".',
        },
        all_day: {
          type: "boolean",
          description:
            "Aseta true kun tapahtuma kestää koko päivän tai useita kokonaisia päiviä (esim. lomat, syntymäpäivät, varaukset). Oletus false (kellonaikoja sisältävä tapahtuma).",
        },
        allow_duplicate: {
          type: "boolean",
          description:
            "Aseta true vain kun käyttäjä on nimenomaan vahvistanut samannimisen päällekkäisen tapahtuman lisäämisen. Oletus false — silloin samanniminen päällekkäinen tapahtuma estää lisäyksen.",
        },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "get_calendar_events",
    description:
      "Hakee tapahtumat yhdestä tai useammasta kalenterista. Tukee menneitä ja tulevia hakuja sekä tekstihakua.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description:
            'Aikaikkunan alku ISO 8601 -muodossa tai päivämääränä. Oletus = nyt (vain tulevat tapahtumat). Anna menneisyydessä oleva arvo (esim. "2026-01-01") jos käyttäjä kysyy menneitä tapahtumia.',
        },
        to: {
          type: "string",
          description:
            "Aikaikkunan loppu ISO 8601 -muodossa tai päivämääränä. Oletus = 30 päivää from:sta eteenpäin.",
        },
        query: {
          type: "string",
          description:
            'Vapaa tekstihaku tapahtuman otsikosta, kuvauksesta, sijainnista ja osallistujista. Käytä kun käyttäjä etsii tapahtumaa nimeltä, esim. "Mikon tapaaminen" tai "Pariisi". Älä käytä jos haet kaikkia tapahtumia aikaikkunalta.',
        },
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
        calendar_id: {
          type: "string",
          description: 'Kalenterin id jossa tapahtuma sijaitsee. Oletus "primary".',
        },
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
        calendar_id: {
          type: "string",
          description: 'Kalenterin id jossa tapahtuma sijaitsee. Oletus "primary".',
        },
        title: { type: "string", description: "Uusi nimi" },
        start: {
          type: "string",
          description:
            'Uusi alkamisaika. Kellotapahtumalle ISO 8601, koko päivän tapahtumalle pelkkä päivämäärä ("YYYY-MM-DD").',
        },
        end: {
          type: "string",
          description: "Uusi loppumisaika. Koko päivän tapahtumalla EKSKLUSIIVINEN loppupäivä.",
        },
        description: { type: "string", description: "Uudet lisätiedot" },
        all_day: {
          type: "boolean",
          description:
            "Aseta true jos tapahtuma muunnetaan koko päivän tapahtumaksi tai uudet päivät ovat koko päivän formaatissa.",
        },
      },
      required: ["event_id"],
    },
    cache_control: { type: "ephemeral" },
  },
];
