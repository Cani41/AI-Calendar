"use client";

import { useEffect, useState } from "react";

const errorMessages: Record<string, string> = {
  state_mismatch: "Kirjautumisistunto vanheni — yritä uudelleen.",
  auth_failed: "Kirjautuminen epäonnistui — yritä uudelleen.",
  missing_code: "Kirjautuminen keskeytyi — yritä uudelleen.",
};

function BantuIcon({ size = 88 }: { size?: number }) {
  return (
    <div
      className="app-icon relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 34 34"
        fill="none"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <rect
          x="3"
          y="7"
          width="22"
          height="20"
          rx="3.2"
          stroke="white"
          strokeWidth="1.6"
          fill="none"
          strokeOpacity="0.95"
        />
        <rect x="3" y="7" width="22" height="7" rx="3.2" fill="white" fillOpacity="0.18" />
        <line x1="3" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.3" strokeOpacity="0.55" />
        <line x1="9" y1="5" x2="9" y2="9" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
        <line x1="19" y1="5" x2="19" y2="9" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="9" cy="19" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="14" cy="19" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="19" cy="19" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="9" cy="24" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="14" cy="24" r="1.35" fill="white" fillOpacity="0.85" />
        <path
          d="M28 4 L29.1 7.9 L33 9 L29.1 10.1 L28 14 L26.9 10.1 L23 9 L26.9 7.9 Z"
          fill="white"
          opacity="0.98"
        />
      </svg>
    </div>
  );
}

const features = [
  {
    title: "Luonnollinen kieli",
    desc: "Kirjoita kuten puhuisit.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" />
      </svg>
    ),
  },
  {
    title: "Google Kalenteri",
    desc: "Reaaliaikainen synkka.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: "Älykäs ajoitus",
    desc: "Bantu löytää oikean hetken.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (err && errorMessages[err]) setErrorKey(err);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="aurora" />
      <div className="aurora-warm" />

      <div className="relative z-10 h-full w-full flex items-center justify-center px-6">
        <div className="w-full max-w-[460px] flex flex-col items-center text-center">

          {/* Icon */}
          <div className="reveal" style={{ animationDelay: "60ms" }}>
            <BantuIcon size={92} />
          </div>

          {/* Wordmark & tagline */}
          <h1
            className="reveal mt-9 text-[64px] sm:text-[72px] font-semibold tracking-display-tight leading-[0.95]"
            style={{ animationDelay: "180ms" }}
          >
            Bantu
          </h1>
          <p
            className="reveal mt-4 text-[17px] leading-[1.5] text-[color:var(--color-ink-soft)] max-w-[360px]"
            style={{ animationDelay: "280ms" }}
          >
            Kalenteriavustaja, joka ymmärtää sinua.
            <br className="hidden sm:block" />
            Hallitse aikatauluasi yhdellä viestillä.
          </p>

          {/* CTA */}
          <div
            className="reveal mt-10 w-full flex flex-col items-center"
            style={{ animationDelay: "400ms" }}
          >
            {errorKey && (
              <p className="mb-3 text-[13px] text-rose-600/90">
                {errorMessages[errorKey]}
              </p>
            )}
            <a
              href="/api/auth/google"
              onClick={() => setLoading(true)}
              aria-busy={loading}
              className={`group lift relative w-full inline-flex items-center justify-center gap-2.5 h-[52px] rounded-full px-6 text-[15px] font-medium tracking-tight
                ${loading
                  ? "bg-[color:var(--color-ink)]/85 text-white cursor-wait"
                  : "bg-[color:var(--color-ink)] text-white hover:bg-black"
                }
                shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_-8px_rgba(0,0,0,0.25)]
                hover:shadow-[0_1px_2px_rgba(0,0,0,0.1),0_14px_36px_-10px_rgba(0,0,0,0.35)]
                active:translate-y-[0.5px] transition`}
            >
              {loading ? (
                <>
                  <span className="flex gap-[5px] items-center">
                    <span className="dot bg-white/80" />
                    <span className="dot bg-white/80" style={{ animationDelay: "150ms" }} />
                    <span className="dot bg-white/80" style={{ animationDelay: "300ms" }} />
                  </span>
                  <span>Ohjataan Googleen…</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" />
                  </svg>
                  <span>Jatka Googlella</span>
                </>
              )}
            </a>
            <p className="mt-3 text-[12px] text-[color:var(--color-ink-faint)]">
              Ilmainen · Ei luottokorttia tarvita
            </p>
          </div>

          {/* Feature triplet */}
          <div
            className="reveal mt-14 w-full grid grid-cols-3 gap-3"
            style={{ animationDelay: "520ms" }}
          >
            {features.map((f, i) => (
              <div
                key={f.title}
                className="glass rounded-2xl px-3 py-4 flex flex-col items-center text-center gap-2"
                style={{ animationDelay: `${560 + i * 90}ms` }}
              >
                <div className="text-[color:var(--color-accent)]">{f.icon}</div>
                <div className="mt-0.5 text-[12.5px] font-semibold tracking-tight text-[color:var(--color-ink)]">
                  {f.title}
                </div>
                <div className="text-[11.5px] leading-snug text-[color:var(--color-ink-soft)]">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Footnote */}
          <p
            className="reveal mt-10 text-[11px] text-[color:var(--color-ink-faint)] tracking-wide"
            style={{ animationDelay: "780ms" }}
          >
            Suunniteltu suomeksi ajatellen
          </p>
        </div>
      </div>
    </main>
  );
}
