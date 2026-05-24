import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Bantu",
  description: "Hallitse kalenteriasi luonnollisella kielellä",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bantu",
  },
};

// Inline script runs before paint: resolves theme (localStorage > system),
// applies .dark class, and sets the theme-color meta to match the *chosen*
// theme (not the system preference) so the iOS/Safari URL bar matches.
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = t === 'dark' || (!t && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
    var color = dark ? '#0a0a0c' : '#fbfbfd';
    var old = document.querySelector('meta[name="theme-color"]');
    if (old) old.parentNode.removeChild(old);
    var m = document.createElement('meta');
    m.setAttribute('name', 'theme-color');
    m.setAttribute('content', color);
    document.head.appendChild(m);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#fbfbfd" />
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full overflow-hidden bg-[color:var(--color-canvas)] text-[color:var(--color-ink)]">
        {children}
      </body>
    </html>
  );
}
