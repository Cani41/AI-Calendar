# Bantu

Manage your calendar with natural language. Bantu is an AI-powered calendar assistant at [bantu.fi](https://bantu.fi).

## Features

- Manage your Google Calendar through natural-language chat
- Claude (Anthropic) tool calling wired to Google Calendar operations
- Google OAuth2 sign-in
- Light/dark theme and installable PWA
- Self-hosted, with push-to-deploy to [bantu.fi](https://bantu.fi) via GitHub Actions

## Tech stack

- [Next.js](https://nextjs.org) – full-stack framework
- Google OAuth – authentication
- Google Calendar API – calendar management
- Claude (Anthropic) – natural language processing

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Set up your environment variables first (see below).

## Environment variables

The app reads these from `.env.local` (gitignored, placeholders only, never real values):

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API access |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

Create `.env.local` in the project root:

```bash
ANTHROPIC_API_KEY=your-key-here
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

Hallitse kalenteriasi luonnollisella kielellä. Bantu on tekoälypohjainen kalenteriassistentti osoitteessa [bantu.fi](https://bantu.fi).

## Ominaisuudet

- Hallitse Google-kalenteriasi luonnollisella kielellä chatin kautta
- Claude (Anthropic) tool calling kytkettynä Google Calendar -toimintoihin
- Google OAuth2 -kirjautuminen
- Vaalea/tumma teema ja asennettava PWA
- Itse hostattu, automaattinen julkaisu osoitteeseen [bantu.fi](https://bantu.fi) GitHub Actionsilla

## Teknologiat

- [Next.js](https://nextjs.org) – full-stack-kehys
- Google OAuth – kirjautuminen
- Google Calendar API – kalenterin hallinta
- Claude (Anthropic) – luonnollisen kielen käsittely

## Kehitys

```bash
npm install
npm run dev
```

Avaa [http://localhost:3000](http://localhost:3000) selaimessa. Aseta ensin ympäristömuuttujat (katso alla).

## Ympäristömuuttujat

Sovellus lukee nämä `.env.local`-tiedostosta (gitignorattu, vain paikkamerkit, ei oikeita arvoja):

| Muuttuja | Tarkoitus |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API -pääsy |
| `GOOGLE_CLIENT_ID` | Google OAuth -client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth -client secret |

Luo `.env.local` projektin juureen:

```bash
ANTHROPIC_API_KEY=your-key-here
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```
