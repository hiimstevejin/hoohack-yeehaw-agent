import { gestureEngineConfig } from './config';
import type {
  ClassifiedHandPose,
  GestureAction,
  GestureEngineFrame,
  GestureLabel,
  GestureTrackerState,
  InteractionMode,
  LocalGestureEvent,
} from './types';

function createRecognizedEvent(pose: ClassifiedHandPose, holdMs: number): LocalGestureEvent {
  return {
    type: 'GESTURE_RECOGNIZED',
    payload: {
      gesture: pose.gesture,
      confidence: Number(pose.confidence.toFixed(2)),
      hand: pose.hand,
      holdMs: Math.max(0, Math.round(holdMs)),
    },
  };
}

function createLostEvent(previousGesture?: string): LocalGestureEvent {
  return {
    type: 'GESTURE_LOST',
    payload: {
      previousGesture,
    },
  };
}

function createActionEvent(action: GestureAction, mode: InteractionMode): LocalGestureEvent {
  return {
    type: 'GESTURE_ACTION_EMITTED',
    payload: {
      action,
      mode,
    },
  };
}

function deriveMode(baseMode: GestureTrackerState['baseMode'], gesture: GestureLabel) {
  if (baseMode === 'ANNOTATION_MODE' && gesture === 'PINCH') {
    return 'DRAWING';
  }

  if (baseMode === 'ANNOTATION_MODE' && gesture === 'THREE_FINGERS') {
    return 'ERASING';
  }

  return baseMode;
}

function getActionForGesture(
  gesture: GestureLabel,
  holdMs: number,
  state: GestureTrackerState,
  timestamp: number,
) {
  if (timestamp - state.lastEmittedActionAt < gestureEngineConfig.cooldownMs) {
    return null;
  }

  if (gesture === 'FIST' && state.baseMode === 'ANNOTATION_MODE') {
    if (holdMs >= gestureEngineConfig.fistHoldMs) {
      return {
        action: 'ACTIVATE_AI_LISTENING' as const,
        nextBaseMode: 'AI_LISTENING' as const,
      };
    }
  }

  if (gesture === 'OPEN_PALM') {
    if (state.baseMode === 'AI_LISTENING' && holdMs >= gestureEngineConfig.openPalmHoldMs) {
      return {
        action: 'EXIT_MODE' as const,
        nextBaseMode: 'ANNOTATION_MODE' as const,
      };
    }
  }

  return null;
}

export function createInitialGestureTrackerState(): GestureTrackerState {
  return {
    stableGesture: 'NONE',
    stableSince: 0,
    lastRecognizedGesture: 'NONE',
    lastEmittedActionAt: -Infinity,
    baseMode: 'ANNOTATION_MODE',
  };
}

export function reduceGestureFrame({
  poses,
  timestamp,
  state,
}: {
  poses: ClassifiedHandPose[];
  timestamp: number;
  state: GestureTrackerState;
}): GestureEngineFrame {
  const primaryPose =
    poses
      .filter((pose) => pose.confidence >= gestureEngineConfig.minGestureConfidence)
      .sort((left, right) => right.confidence - left.confidence)[0] ?? null;
  const events: LocalGestureEvent[] = [];

  if (!primaryPose) {
    if (state.lastRecognizedGesture !== 'NONE') {
      events.push(createLostEvent(state.lastRecognizedGesture));
    }

    state.stableGesture = 'NONE';
    state.stableSince = timestamp;
    state.lastRecognizedGesture = 'NONE';

    return {
      timestamp,
      stableGesture: 'NONE',
      rawGesture: 'NONE',
      confidence: 0,
      holdMs: 0,
      dominantHand: poses[0]?.hand ?? null,
      mode: state.baseMode,
      handCount: poses.length,
      trackingActive: poses.length > 0,
      events,
      primaryPose,
      poses,
    };
  }

  if (state.stableGesture !== primaryPose.gesture) {
    state.stableGesture = primaryPose.gesture;
    state.stableSince = timestamp;
  }

  const holdMs = timestamp - state.stableSince;

  if (holdMs >= gestureEngineConfig.stabilityWindowMs) {
    if (state.lastRecognizedGesture !== primaryPose.gesture) {
      events.push(createRecognizedEvent(primaryPose, holdMs));
      state.lastRecognizedGesture = primaryPose.gesture;
    }

    const action = getActionForGesture(primaryPose.gesture, holdMs, state, timestamp);

    if (action) {
      state.baseMode = action.nextBaseMode;
      state.lastEmittedActionAt = timestamp;
      events.push(createActionEvent(action.action, state.baseMode));
    }
  }

  const mode = deriveMode(state.baseMode, primaryPose.gesture);

  return {
    timestamp,
    stableGesture: holdMs >= gestureEngineConfig.stabilityWindowMs ? primaryPose.gesture : 'NONE',
    rawGesture: primaryPose.gesture,
    confidence: primaryPose.confidence,
    holdMs,
    dominantHand: primaryPose.hand,
    mode,
    handCount: poses.length,
    trackingActive: true,
    events,
    primaryPose,
    poses,
  };
}
