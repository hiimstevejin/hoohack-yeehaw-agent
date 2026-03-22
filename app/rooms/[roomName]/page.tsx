import Link from 'next/link';

export default async function RoomPage({
  params
}: {
  params: Promise<{ roomName: string }>;
}) {
  const { roomName } = await params;

  return (
    <main className="page-shell">
      <section className="hero-card room-card">
        <p className="eyebrow">Dynamic Room</p>
        <h1>{roomName}</h1>
        <p className="copy">
          This room page is served from the dynamic route at <code>/rooms/[roomName]</code>.
        </p>
        <div className="room-actions">
          <Link className="primary-button" href="/">
            Back Home
          </Link>
          <Link className="secondary-button link-button" href={`/room/${encodeURIComponent(roomName)}`}>
            Reload Via Short Route
          </Link>
        </div>
      </section>
    </main>
  );
}
