"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim()) return;
    setLoading(true);
    setResponse("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    setResponse(data.reply);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-8">AI Calendar Assistant</h1>
      <div className="w-full max-w-xl">
        <textarea
          className="w-full bg-gray-800 rounded-xl p-4 text-white mb-4 resize-none"
          rows={4}
          placeholder="Esim: Lisaa hammaslaakari ensi tiistaille klo 14"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 font-semibold py-3 rounded-xl transition"
        >
          {loading ? "Kasitellaan..." : "Laheta"}
        </button>
        {response && (
          <div className="mt-6 bg-gray-800 rounded-xl p-4 text-gray-200 prose prose-invert max-w-none">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  );
}