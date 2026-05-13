"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const updatedMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: updatedMessages }),
    });

    const data = await res.json();
    setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
    setLoading(false);
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
    /* Outer shell — very dark, fills the screen */
    <div className="flex h-screen bg-[#05050a] text-white font-[450] justify-center items-center p-5">

      {/* Chat column — max 800 px, own bg + border + rounded corners */}
      <div className="flex flex-col w-full max-w-[800px] h-full bg-[#0e0e16] border border-white/10 rounded-2xl overflow-hidden">

        {/* Header */}
        <header className="flex-none px-6 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold tracking-wide">
            AI
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-none">Kalenteri-assistentti</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">valmis</p>
          </div>
        </header>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-5 py-8 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 mt-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-xl mb-2">
                📅
              </div>
              <p className="text-gray-300 font-medium">Mitä haluaisit tehdä?</p>
              <p className="text-gray-500 text-sm">Voit lisätä, hakea tai poistaa tapahtumia kalenteristasi.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-none w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold mb-0.5">
                  AI
                </div>
              )}

              <div
                className={`max-w-[72%] text-[14px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white px-4 py-2.5 rounded-[20px] rounded-br-[4px] shadow-md"
                    : "bg-[#181826] text-gray-100 px-4 py-3 rounded-[20px] rounded-bl-[4px] border border-white/8 shadow-md prose prose-invert prose-sm max-w-none"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="flex-none w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold mb-0.5">
                AI
              </div>
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
        <div className="flex-none border-t border-white/10 px-5 py-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end bg-[#181826] border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-blue-500/50 transition-colors">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent text-white resize-none outline-none text-[14px] leading-relaxed overflow-hidden placeholder:text-gray-500 font-[450]"
                rows={1}
                placeholder="Kirjoita viesti… (Enter lähettää, Shift+Enter uusi rivi)"
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex-none w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-blue-600 hover:bg-blue-500 disabled:bg-[#1e1e2e] disabled:text-gray-600 text-white shadow-sm"
              aria-label="Lähetä"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-600 mt-2">Enter lähettää · Shift+Enter uusi rivi</p>
        </div>

      </div>
    </div>
  );
}
