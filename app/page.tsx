export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-2">AI Calendar Assistant</h1>
      <p className="text-gray-400 mb-8">Hallitse kalenteriasi luonnollisella kielella</p>
      <a
        href="/api/auth/google"
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
      >
        Kirjaudu Google-tililla
      </a>
    </main>
  );
}