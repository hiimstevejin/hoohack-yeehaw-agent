import type { NormalizedLandmark } from '@/lib/gesture/mediapipe';

import type { GestureHand } from '@/lib/gesture/types';

type FingerStates = {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
};

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export function getHandCenter(landmarks: NormalizedLandmark[]) {
  const total = landmarks.reduce(
    (accumulator, landmark) => ({
      x: accumulator.x + landmark.x,
      y: accumulator.y + landmark.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / landmarks.length,
    y: total.y / landmarks.length,
  };
}

function getHandSize(landmarks: NormalizedLandmark[]) {
  return (
    distance(landmarks[0], landmarks[9]) +
    distance(landmarks[0], landmarks[5]) +
    distance(landmarks[5], landmarks[17])
  );
}

export function getNormalizedPinchDistance(landmarks: NormalizedLandmark[]) {
  const handSize = getHandSize(landmarks);

  if (handSize === 0) {
    return 1;
  }

  return distance(landmarks[4], landmarks[8]) / handSize;
}

function isFingerExtended(
  landmarks: NormalizedLandmark[],
  tipIndex: number,
  pipIndex: number,
  mcpIndex: number,
) {
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];

  return tip.y < pip.y && pip.y < mcp.y;
}

function isThumbExtended(landmarks: NormalizedLandmark[], handedness: GestureHand) {
  const tip = landmarks[4];
  const ip = landmarks[3];
  const mcp = landmarks[2];
  const wrist = landmarks[0];
  const thumbHorizontal =
    handedness === 'right'
      ? tip.x < ip.x - 0.015 && ip.x < mcp.x - 0.015
      : tip.x > ip.x + 0.015 && ip.x > mcp.x + 0.015;
  const thumbVertical = tip.y < wrist.y - 0.07 && tip.y < mcp.y - 0.05;

  return thumbHorizontal || thumbVertical;
}

export function getFingerStates(
  landmarks: NormalizedLandmark[],
  handedness: GestureHand,
): FingerStates {
  return {
    thumb: isThumbExtended(landmarks, handedness),
    index: isFingerExtended(landmarks, 8, 6, 5),
    middle: isFingerExtended(landmarks, 12, 10, 9),
    ring: isFingerExtended(landmarks, 16, 14, 13),
    pinky: isFingerExtended(landmarks, 20, 18, 17),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
