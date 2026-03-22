'use client';

import * as React from 'react';

import type { GestureVoiceInvocationState } from '@/lib/ai/useGestureVoiceInvocation';
import type { VoiceAgentSessionController } from '@/lib/ai/useVoiceAgentSession';
import type { ScreenHighlightControllerState } from '@/lib/gesture/useScreenHighlightController';
import { useGestureEngine } from '@/lib/gesture/useGestureEngine';

function Metric(props: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.2rem',
        padding: '0.75rem',
        borderRadius: '14px',
        background: 'rgba(255, 255, 255, 0.04)',
      }}
    >
      <span
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.08em',
          opacity: 0.68,
          textTransform: 'uppercase',
        }}
      >
        {props.label}
      </span>
      <strong style={{ fontSize: '0.95rem' }}>{props.value}</strong>
    </div>
  );
}

export function GestureStatusPanel(props: {
  sourceVideoElement: HTMLVideoElement | null;
  gesture: ReturnType<typeof useGestureEngine>;
  controllerState?: ScreenHighlightControllerState;
  voiceSession?: Pick<VoiceAgentSessionController, 'sessionSource' | 'sessionState'>;
  gestureInvocation?: GestureVoiceInvocationState;
}) {
  const { gesture } = props;
  const frame = gesture.state.frame;
  const workflowState =
    frame?.mode === 'AI_LISTENING'
      ? 'Voice agent active'
      : frame?.mode === 'ERASING'
        ? 'Erasing highlights'
        : frame?.mode === 'DRAWING'
          ? 'Highlighting shared screen'
          : 'Annotation ready';

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <strong style={{ fontSize: '1rem' }}>Screen Highlight + Voice Control</strong>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.45 }}>
          Hand tracking stays focused on highlighting the shared screen and invoking the voice
          agent. Annotation mode is the default resting state.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        <Metric label="Engine" value={gesture.state.status} />
        <Metric label="Workflow" value={workflowState} />
        <Metric label="Raw Gesture" value={frame?.rawGesture ?? 'NONE'} />
        <Metric label="Stable Gesture" value={frame?.stableGesture ?? 'NONE'} />
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.65rem',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        <Metric label="Confidence" value={frame ? frame.confidence.toFixed(2) : '0.00'} />
        <Metric label="Hands" value={String(frame?.handCount ?? 0)} />
      </div>

      {props.controllerState ? (
        <div
          style={{
            display: 'grid',
            gap: '0.65rem',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          }}
        >
          <Metric label="Target" value={props.controllerState.targetSurfaceId ? 'Screen share live' : 'No target'} />
          <Metric label="Controller" value={props.controllerState.status} />
        </div>
      ) : null}

      {props.voiceSession ? (
        <div
          style={{
            display: 'grid',
            gap: '0.65rem',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          }}
        >
          <Metric label="Voice State" value={props.voiceSession.sessionState} />
          <Metric label="Voice Trigger" value={props.voiceSession.sessionSource ?? 'waiting'} />
        </div>
      ) : null}

      {gesture.state.error ? (
        <p style={{ margin: 0, color: '#ffb4a0', lineHeight: 1.45 }}>{gesture.state.error}</p>
      ) : props.sourceVideoElement ? (
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.45 }}>
          Gesture detection is reading from the real local LiveKit camera preview and drawing the
          hand trace directly on top of your camera tile.
        </p>
      ) : (
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.45 }}>
          Waiting for the local LiveKit camera preview before starting gesture detection and the
          on-camera tracing overlay.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gap: '0.35rem',
          padding: '0.8rem',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          color: 'rgba(255, 255, 255, 0.76)',
          fontSize: '0.84rem',
          lineHeight: 1.45,
        }}
      >
        <div>`PINCH`: highlight shared screen</div>
        <div>`THREE_FINGERS`: erase highlights</div>
        <div>`FIST`: invoke voice agent</div>
        <div>`OPEN_PALM`: stop AI and return to annotation mode</div>
        {props.gestureInvocation?.isCoolingDown ? (
          <div>
            Gesture voice cooldown: {Math.ceil(props.gestureInvocation.cooldownRemainingMs / 1000)}s
          </div>
        ) : null}
      </div>

    </div>
  );
}
