"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // document.documentElement ei ole saatavilla SSR-passissa, joten luetaan
    // teema-luokka effectissä ennen ensimmäistä asiakaspuolen renderiä.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage ei käytettävissä
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Vaihda vaaleaan teemaan" : "Vaihda tummaan teemaan"}
      title={dark ? "Vaalea tila" : "Tumma tila"}
      className={`relative w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition ${className}`}
    >
      {/* Sun */}
      <span className="theme-icon" data-show={mounted ? !dark : true}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </span>
      {/* Moon */}
      <span className="theme-icon" data-show={mounted ? dark : false}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        </svg>
      </span>
    </button>
  );
}
