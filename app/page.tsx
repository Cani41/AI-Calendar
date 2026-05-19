"use client";

import { useEffect, useState } from "react";

const errorMessages: Record<string, string> = {
  state_mismatch: "Kirjautumisistunto vanheni — yritä uudelleen.",
  auth_failed: "Kirjautuminen epäonnistui — yritä uudelleen.",
  missing_code: "Kirjautuminen keskeytyi — yritä uudelleen.",
};

function BantuLogo() {
  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <div className="absolute inset-0 bg-blue-500/25 blur-2xl rounded-full" />
      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-blue-950/60">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Calendar body */}
          <rect x="3" y="7" width="22" height="20" rx="3" stroke="white" strokeWidth="1.6" fill="none" strokeOpacity="0.9"/>
          {/* Top bar */}
          <rect x="3" y="7" width="22" height="7" rx="3" fill="white" fillOpacity="0.15"/>
          <line x1="3" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.4" strokeOpacity="0.5"/>
          {/* Binding pins */}
          <line x1="9" y1="5" x2="9" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="19" y1="5" x2="19" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          {/* Date dots */}
          <circle cx="9" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="14" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="19" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="9" cy="24" r="1.3" fill="white" fillOpacity="0.7"/>
          <circle cx="14" cy="24" r="1.3" fill="white" fillOpacity="0.7"/>
          {/* Sparkle — AI indicator, top-right corner */}
          <path
            d="M28 4 L29.1 7.9 L33 9 L29.1 10.1 L28 14 L26.9 10.1 L23 9 L26.9 7.9 Z"
            fill="white"
            opacity="0.95"
          />
        </svg>
      </div>
    </div>
  );
}

const features = [
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Luonnollinen kieli",
    desc: "Luo tapahtumia kirjoittamalla tai puhumalla suomeksi",
  },
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    title: "Google Kalenteri",
    desc: "Synkronoi suoraan Google-kalenteriisi reaaliajassa",
  },
  {
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: "Älykäs ajoitus",
    desc: "Bantu ehdottaa parhaat ajat kokouksille ja tehtäville",
  },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err && errorMessages[err]) setErrorKey(err);
  }, []);

  return (
    <div className="flex h-dvh bg-[#05050a] text-white font-[450] justify-center items-center sm:p-5">
      <div className="flex flex-col w-full max-w-[480px] h-full sm:h-auto bg-[#0e0e16] sm:border sm:border-white/10 sm:rounded-2xl overflow-y-auto justify-center items-center gap-7 p-8 sm:py-10">

        {/* Logo */}
        <BantuLogo />

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[28px] font-bold tracking-tight mb-2">Bantu</h1>
          <p className="text-gray-400 text-[13px] leading-relaxed max-w-[300px] mx-auto">
            Kalenteriavustaja, joka ymmärtää luonnollista kieltä. Hallitse aikatauluasi yhdellä viestillä.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]"
            >
              <div className="text-blue-400 mt-0.5">{f.icon}</div>
              <span className="text-[11px] font-semibold text-white/85 leading-tight">{f.title}</span>
              <span className="text-[10px] text-gray-500 leading-snug">{f.desc}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          {errorKey && (
            <p className="text-amber-400 text-[11px] text-center">{errorMessages[errorKey]}</p>
          )}
          <a
            href="/api/auth/google"
            onClick={() => setLoading(true)}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              loading
                ? "bg-blue-700 text-blue-300 cursor-wait"
                : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white"
            }`}
          >
            {loading ? (
              <>
                <span className="flex gap-[3px] items-center">
                  <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
                Ohjataan Google-kirjautumiseen…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
                </svg>
                Kirjaudu Google-tilillä
              </>
            )}
          </a>
          <p className="text-[11px] text-gray-600">Ilmainen · Ei luottokorttia tarvita</p>
        </div>

      </div>
    </div>
  );
}
