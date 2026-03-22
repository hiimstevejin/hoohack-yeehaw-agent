import type { NormalizedLandmark } from '@/lib/gesture/mediapipe';

export type GestureHand = 'left' | 'right';

export type GestureType =
  | 'OPEN_PALM'
  | 'FIST'
  | 'PINCH'
  | 'PEACE_SIGN'
  | 'THREE_FINGERS'
  | 'INDEX_ONLY'
  | 'THUMBS_UP';

export type GestureLabel = GestureType | 'NONE';

export type InteractionMode =
  | 'IDLE'
  | 'NAVIGATION'
  | 'ANNOTATION_MODE'
  | 'DRAWING'
  | 'ERASING'
  | 'AI_LISTENING'
  | 'CHART_INTERACTION';

export type GestureRecognizedEvent = {
  type: 'GESTURE_RECOGNIZED';
  payload: {
    gesture: GestureLabel;
    confidence: number;
    hand: GestureHand;
    holdMs: number;
  };
};

export type GestureLostEvent = {
  type: 'GESTURE_LOST';
  payload: {
    previousGesture?: string;
  };
};

export type GestureAction =
  | 'ENTER_ANNOTATION_MODE'
  | 'ACTIVATE_AI_LISTENING'
  | 'EXIT_MODE';

export type GestureActionEmittedEvent = {
  type: 'GESTURE_ACTION_EMITTED';
  payload: {
    action: GestureAction;
    mode: InteractionMode;
  };
};

export type LocalGestureEvent =
  | GestureRecognizedEvent
  | GestureLostEvent
  | GestureActionEmittedEvent;

export type ClassifiedHandPose = {
  hand: GestureHand;
  landmarks: NormalizedLandmark[];
  center: { x: number; y: number };
  gesture: GestureLabel;
  confidence: number;
  pinchDistance: number;
  fingerStates: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
};

export type GestureEngineFrame = {
  timestamp: number;
  stableGesture: GestureLabel;
  rawGesture: GestureLabel;
  confidence: number;
  holdMs: number;
  dominantHand: GestureHand | null;
  mode: InteractionMode;
  handCount: number;
  trackingActive: boolean;
  events: LocalGestureEvent[];
  primaryPose: ClassifiedHandPose | null;
  poses: ClassifiedHandPose[];
};

export type GestureTrackerState = {
  stableGesture: GestureLabel;
  stableSince: number;
  lastRecognizedGesture: GestureLabel;
  lastEmittedActionAt: number;
  baseMode: Exclude<InteractionMode, 'DRAWING' | 'ERASING'>;
};

export type GestureEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export type GestureEngineState = {
  status: GestureEngineStatus;
  error: string | null;
  frame: GestureEngineFrame | null;
};
