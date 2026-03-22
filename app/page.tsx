'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const router = useRouter();
  const [meetingId, setMeetingId] = useState('');

  function handleInstantMeeting() {
    router.push(`/room/${generateRoomId()}`);
  }

  function handleJoinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const roomId = meetingId.trim();
    if (!roomId) return;

    router.push(`/room/${encodeURIComponent(roomId)}`);
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Meeting Routes Ready</p>
        <h1>livekit-meet</h1>
        <p className="copy">
          Start an instant room or join an existing one. The short route redirects through
          <code>/room/[roomId]</code> and lands on the dynamic room page at
          <code>/rooms/[roomName]</code>.
        </p>

        <form className="home-form" onSubmit={handleJoinMeeting}>
          <button className="primary-button" type="button" onClick={handleInstantMeeting}>
            Start Instant Meeting
          </button>

          <label className="field">
            <span>Meeting ID</span>
            <input
              type="text"
              name="meetingId"
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              placeholder="Enter meeting ID"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <button className="secondary-button" type="submit" disabled={!meetingId.trim()}>
            Join Meeting
          </button>
        </form>
      </section>
    </main>
  );
}
