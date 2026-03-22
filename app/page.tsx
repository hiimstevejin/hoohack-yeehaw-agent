'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

export default function Page() {
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
    <main className={styles.main} data-lk-theme="default">
      <section className={styles.hero}>
        <div className={styles.brand}>
          <div className={styles.titleRow}>
            <span className={styles.cameraBadge} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M15 8.5V7a2 2 0 0 0-2-2H5A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l4.4 3.1c.66.47 1.6 0 1.6-.81V6.21c0-.81-.94-1.28-1.6-.81L15 8.5Z" />
              </svg>
            </span>
            <h1 className={styles.title}>Wild West Meet</h1>
          </div>
          <p className={styles.subtitle}>Premium video conferencing with a cinematic touch</p>
        </div>

        <form className={styles.card} onSubmit={handleJoinMeeting}>
          <button className={styles.primaryButton} type="button" onClick={handleInstantMeeting}>
            <span className={styles.buttonIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M15 8.5V7a2 2 0 0 0-2-2H5A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.5l4.4 3.1c.66.47 1.6 0 1.6-.81V6.21c0-.81-.94-1.28-1.6-.81L15 8.5Z" />
              </svg>
            </span>
            Start Instant Meeting
          </button>

          <div className={styles.divider} aria-hidden="true">
            <span />
            <strong>or</strong>
            <span />
          </div>

          <label className={styles.field}>
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

          <button className={styles.secondaryButton} type="submit" disabled={!meetingId.trim()}>
            Join Meeting
          </button>
        </form>
      </section>
    </main>
  );
}
