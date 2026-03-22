import { getWelcomeMessage } from "@/src/lib/getWelcomeMessage";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Boilerplate Ready</p>
        <h1>livekit-meet</h1>
        <p className="copy">{getWelcomeMessage()}</p>
      </section>
    </main>
  );
}
