"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import ThemeToggle from "../_components/ThemeToggle";

function BantuAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="app-icon flex items-center justify-center flex-none"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 34 34" fill="none" style={{ width: size * 0.58, height: size * 0.58 }}>
        <rect x="3" y="7" width="22" height="20" rx="3.2" stroke="white" strokeWidth="1.6" fill="none" strokeOpacity="0.95" />
        <rect x="3" y="7" width="22" height="7" rx="3.2" fill="white" fillOpacity="0.18" />
        <line x1="3" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.3" strokeOpacity="0.55" />
        <line x1="9" y1="5" x2="9" y2="9" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
        <line x1="19" y1="5" x2="19" y2="9" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="9" cy="19" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="14" cy="19" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="19" cy="19" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="9" cy="24" r="1.35" fill="white" fillOpacity="0.85" />
        <circle cx="14" cy="24" r="1.35" fill="white" fillOpacity="0.85" />
        <path d="M28 4 L29.1 7.9 L33 9 L29.1 10.1 L28 14 L26.9 10.1 L23 9 L26.9 7.9 Z" fill="white" opacity="0.98" />
      </svg>
    </div>
  );
}

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
};

type PendingImage = {
  data: string;
  mediaType: string;
  url: string;
};

const STORAGE_KEY = "chat_history";

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // sessionStorage ei käytettävissä
    }
  }, []);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCharsRef = useRef("");
  const charIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (charIntervalRef.current) clearInterval(charIntervalRef.current);
    };
  }, []);

  function startCharAnimation() {
    if (charIntervalRef.current !== null) return;
    charIntervalRef.current = setInterval(() => {
      if (!pendingCharsRef.current) {
        clearInterval(charIntervalRef.current!);
        charIntervalRef.current = null;
        return;
      }
      const q = pendingCharsRef.current.length;
      const count = q > 100 ? 4 : q > 40 ? 2 : 1;
      const chars = pendingCharsRef.current.slice(0, count);
      pendingCharsRef.current = pendingCharsRef.current.slice(count);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, content: last.content + chars }];
      });
    }, 12);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    try {
      const toSave = messages.map((m) => ({ role: m.role, content: m.content }));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // sessionStorage ei käytettävissä
    }
  }, [messages]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Kuva on liian suuri. Maksimikoko on 5 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPendingImage({
        data: dataUrl.split(",")[1],
        mediaType: file.type,
        url: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    const userMessage: Message = {
      role: "user",
      content: text,
      imageUrl: pendingImage?.url,
    };

    const updatedMessages: Message[] = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    if (charIntervalRef.current) {
      clearInterval(charIntervalRef.current);
      charIntervalRef.current = null;
    }
    pendingCharsRef.current = "";

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          image: pendingImage
            ? { data: pendingImage.data, mediaType: pendingImage.mediaType }
            : undefined,
        }),
      });

      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
        if (data.relogin) setTimeout(() => (window.location.href = "/"), 2000);
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: { type: string; text?: string; message?: string };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "delta" && event.text) {
            if (!assistantAdded) {
              setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
              setLoading(false);
              assistantAdded = true;
            }
            pendingCharsRef.current += event.text;
            startCharAnimation();
          } else if (event.type === "error") {
            setMessages((prev) => [...prev, { role: "assistant", content: event.message ?? "Tuntematon virhe." }]);
            setLoading(false);
          }
        }
      }

      if (!assistantAdded) setLoading(false);
    } catch {
      setMessages([...updatedMessages, {
        role: "assistant",
        content: "Verkkovirhe — tarkista yhteytesi ja yritä uudelleen.",
      }]);
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  const canSend = !loading && (!!input.trim() || !!pendingImage);

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="aurora" />
      <div className="aurora-warm" />

      <div className="relative z-10 h-full w-full flex justify-center sm:p-5">
        <div className="relative flex flex-col w-full max-w-[820px] h-full sm:rounded-[28px] overflow-hidden glass-strong">

          {/* Header — floating glass bar */}
          <header className="flex-none flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 border-b border-[color:var(--color-hairline-soft)]">
            <BantuAvatar size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold tracking-tight leading-none">Bantu</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-[2px] rounded-md bg-[color:var(--color-ink)]/[0.06] text-[color:var(--color-ink-soft)]">
                  Dev
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    loading ? "bg-[color:var(--color-accent)]" : "bg-emerald-500"
                  }`}
                />
                <p className="text-[11.5px] text-[color:var(--color-ink-soft)] leading-none">
                  {loading ? "ajattelee…" : "valmis"}
                </p>
              </div>
            </div>
            <ThemeToggle />
            <a
              href="/api/auth/logout"
              aria-label="Kirjaudu ulos"
              className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] transition-colors w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-2 sm:text-[12.5px] rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center"
            >
              <svg className="sm:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Kirjaudu ulos</span>
            </a>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-2">
                <div
                  className="reveal mb-6"
                  style={{ animationDelay: "60ms" }}
                >
                  <BantuAvatar size={64} />
                </div>
                <h2
                  className="reveal text-[28px] sm:text-[32px] font-semibold tracking-display leading-tight"
                  style={{ animationDelay: "180ms" }}
                >
                  Hei. Mitä järjestellään?
                </h2>
                <p
                  className="reveal mt-2 max-w-[360px] text-[14.5px] text-[color:var(--color-ink-soft)] leading-relaxed"
                  style={{ animationDelay: "280ms" }}
                >
                  Lisää, hae tai siirrä tapahtumia luonnollisella kielellä — tai lähetä kuva aikataulusta.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-end gap-2 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    } bubble-in`}
                  >
                    {msg.role === "assistant" && <BantuAvatar size={26} />}

                    <div
                      className={`max-w-[85%] sm:max-w-[70%] text-[14.5px] leading-relaxed ${
                        msg.role === "user"
                          ? "bubble-out rounded-[22px] rounded-br-[6px] overflow-hidden"
                          : "glass rounded-[22px] rounded-bl-[6px] overflow-hidden text-[color:var(--color-ink)] prose-bantu"
                      }`}
                    >
                      {msg.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.imageUrl}
                          alt="Lähetetty kuva"
                          className="w-full max-w-[280px] block"
                        />
                      )}
                      {msg.content && (
                        <div className={msg.imageUrl ? "px-4 py-2.5" : "px-4 py-2.5"}>
                          {msg.role === "assistant"
                            ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                            : msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-end gap-2 justify-start bubble-in">
                    <BantuAvatar size={26} />
                    <div className="glass rounded-[22px] rounded-bl-[6px] px-4 py-3.5">
                      <span className="flex gap-[5px] items-center">
                        <span className="dot" />
                        <span className="dot" style={{ animationDelay: "150ms" }} />
                        <span className="dot" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div
            className="flex-none px-3 sm:px-5 pt-3 border-t border-[color:var(--color-hairline-soft)]"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {pendingImage && (
              <div className="relative inline-block mb-2 ml-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.url}
                  alt="Esikatselu"
                  className="h-16 w-16 object-cover rounded-2xl border border-[color:var(--color-hairline)]"
                />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] flex items-center justify-center shadow"
                  aria-label="Poista kuva"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="lift flex-none w-11 h-11 rounded-full flex items-center justify-center text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition disabled:opacity-40"
                aria-label="Lisää kuva"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="flex-1 flex items-end glass rounded-3xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-[color:var(--color-accent)]/40 transition">
                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-transparent resize-none outline-none text-[16px] leading-relaxed overflow-hidden placeholder:text-[color:var(--color-ink-faint)] text-[color:var(--color-ink)] py-1.5"
                  rows={1}
                  placeholder={pendingImage ? "Lisää viesti kuvaan…" : "Kysy Bantulta"}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <button
                onClick={sendMessage}
                disabled={!canSend}
                className={`flex-none w-11 h-11 rounded-full flex items-center justify-center transition
                  ${canSend
                    ? "bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-deep)] text-white shadow-[0_1px_2px_rgba(0,80,200,0.18),0_8px_22px_-6px_rgba(0,80,200,0.45)] active:translate-y-[0.5px]"
                    : "bg-black/[0.06] dark:bg-white/[0.06] text-[color:var(--color-ink-faint)]"
                  }`}
                aria-label="Lähetä"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
            <p className="hidden sm:block text-center text-[11px] text-[color:var(--color-ink-faint)] mt-2.5">
              Enter lähettää · Shift+Enter uusi rivi
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
