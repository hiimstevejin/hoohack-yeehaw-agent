export const gestureEngineConfig = {
  minGestureConfidence: 0.72,
  stabilityWindowMs: 140,
  openPalmHoldMs: 1000,
  fistHoldMs: 1000,
  peaceSignHoldMs: 750,
  cooldownMs: 900,
  pinchThreshold: 0.34,
  thumbsUpThreshold: 0.18,
  handLossTimeoutMs: 350,
} as const;
