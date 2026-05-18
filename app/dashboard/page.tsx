"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

function BantuAvatar({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center flex-none ${className}`}>
      <svg viewBox="0 0 34 34" fill="none" className="w-[58%] h-[58%]">
        <rect x="3" y="7" width="22" height="20" rx="3" stroke="white" strokeWidth="1.6" fill="none" strokeOpacity="0.9"/>
        <rect x="3" y="7" width="22" height="7" rx="3" fill="white" fillOpacity="0.15"/>
        <line x1="3" y1="14" x2="25" y2="14" stroke="white" strokeWidth="1.4" strokeOpacity="0.5"/>
        <line x1="9" y1="5" x2="9" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="19" y1="5" x2="19" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="9" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
        <circle cx="14" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
        <circle cx="19" cy="19" r="1.3" fill="white" fillOpacity="0.7"/>
        <circle cx="9" cy="24" r="1.3" fill="white" fillOpacity="0.7"/>
        <circle cx="14" cy="24" r="1.3" fill="white" fillOpacity="0.7"/>
        <path d="M28 4 L29.1 7.9 L33 9 L29.1 10.1 L28 14 L26.9 10.1 L23 9 L26.9 7.9 Z" fill="white" opacity="0.95"/>
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
  data: string;      // base64 ilman data URL -etuliitettä
  mediaType: string;
  url: string;       // data URL esikatselua varten
};

export default function Dashboard() {
  const STORAGE_KEY = "chat_history";

  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
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
      // Adaptive speed: drain faster when falling behind
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
      // Ei tallenneta base64-kuvia sessionStorageen
      const toSave = messages.map(({ imageUrl: _, ...m }) => m);
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

    // Reset typewriter state from any previous message
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
          messages: updatedMessages.map(({ imageUrl: _, ...m }) => m),
          image: pendingImage
            ? { data: pendingImage.data, mediaType: pendingImage.mediaType }
            : undefined,
        }),
      });

      // Auth errors come back as plain JSON
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
        if (data.relogin) setTimeout(() => (window.location.href = "/"), 2000);
        setLoading(false);
        return;
      }

      // NDJSON stream
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

  return (
    <div className="flex h-dvh bg-[#05050a] text-white font-[450] justify-center items-center sm:p-5">
      <div className="flex flex-col w-full max-w-[800px] h-full bg-[#0e0e16] sm:border sm:border-white/10 sm:rounded-2xl overflow-hidden">

        {/* Header */}
        <header className="flex-none px-6 py-4 border-b border-white/10 flex items-center gap-3">
          <BantuAvatar className="w-8 h-8" />
          <div className="flex-1">
            <h1 className="text-[15px] font-semibold leading-none">Bantu</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">{loading ? "kirjoittaa…" : "valmis"}</p>
          </div>
          <a
            href="/api/auth/logout"
            className="text-[12px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            Kirjaudu ulos
          </a>
        </header>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 sm:px-5 sm:py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 mt-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-xl mb-2">
                📅
              </div>
              <p className="text-gray-300 font-medium">Mitä haluaisit tehdä?</p>
              <p className="text-gray-500 text-sm">
                Voit lisätä, hakea tai poistaa tapahtumia — tai lähetä kuva työvuorolistasta.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <BantuAvatar className="w-7 h-7 mb-0.5" />
              )}

              <div className={`max-w-[85%] sm:max-w-[72%] text-[14px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-[20px] rounded-br-[4px] shadow-md overflow-hidden"
                  : "bg-[#181826] text-gray-100 px-4 py-3 rounded-[20px] rounded-bl-[4px] border border-white/8 shadow-md prose prose-invert prose-sm max-w-none"
              }`}>
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Lähetetty kuva"
                    className="w-full max-w-[260px] rounded-[16px] rounded-br-[4px] block"
                  />
                )}
                {msg.content && (
                  <div className={msg.imageUrl ? "px-4 py-2" : "px-4 py-2.5"}>
                    {msg.role === "assistant"
                      ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                      : msg.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <BantuAvatar className="w-7 h-7 mb-0.5" />
              <div className="bg-[#181826] border border-white/8 rounded-[20px] rounded-bl-[4px] px-4 py-3.5 shadow-md">
                <span className="flex gap-[5px] items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:160ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:320ms]" />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex-none border-t border-white/10 px-3 pt-4 sm:px-5 sm:pt-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >

          {/* Kuvan esikatselu */}
          {pendingImage && (
            <div className="relative inline-block mb-2 ml-1">
              <img
                src={pendingImage.url}
                alt="Esikatselu"
                className="h-16 w-16 object-cover rounded-xl border border-white/10"
              />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
                aria-label="Poista kuva"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2.5">
            {/* Kuvan lähetyspainike */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex-none w-12 h-12 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all text-gray-400 hover:text-gray-200 hover:bg-white/5 disabled:opacity-40"
              aria-label="Lisää kuva"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex-1 flex items-end bg-[#181826] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-white resize-none outline-none text-[16px] leading-relaxed overflow-hidden placeholder:text-gray-500 font-[450]"
                rows={1}
                placeholder={pendingImage ? "Lisää viesti kuvaan (valinnainen)…" : "Kirjoita Bantulle…"}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !pendingImage)}
              className="flex-none w-12 h-12 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e1e2e] disabled:text-gray-600 text-white shadow-sm"
              aria-label="Lähetä"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>
          <p className="hidden sm:block text-center text-[11px] text-gray-600 mt-2">
            Enter lähettää · Shift+Enter uusi rivi · Kuvakkeella voit lähettää työvuorolistan
          </p>
        </div>

      </div>
    </div>
  );
}
