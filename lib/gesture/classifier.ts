import { gestureEngineConfig } from '@/lib/gesture/config';
import type { HandLandmarkerResult, NormalizedLandmark } from '@/lib/gesture/mediapipe';
import {
  clamp,
  getFingerStates,
  getHandCenter,
  getNormalizedPinchDistance,
} from '@/lib/gesture/normalization';
import type { ClassifiedHandPose, GestureHand, GestureLabel } from '@/lib/gesture/types';

function getHandedness(
  handednesses: HandLandmarkerResult['handednesses'][number] | undefined,
): GestureHand {
  const category = handednesses?.[0]?.categoryName?.toLowerCase();

  return category === 'left' ? 'left' : 'right';
}

function matchConfidence(matches: boolean[], bonus = 0) {
  const score = matches.filter(Boolean).length / matches.length;

  return clamp(score + bonus, 0, 0.99);
}

function classifyGesture(
  landmarks: NormalizedLandmark[],
  hand: GestureHand,
): Omit<ClassifiedHandPose, 'landmarks' | 'hand' | 'center'> {
  const fingerStates = getFingerStates(landmarks, hand);
  const pinchDistance = getNormalizedPinchDistance(landmarks);
  const isPinch = pinchDistance < gestureEngineConfig.pinchThreshold;
  const extendedCount = Object.values(fingerStates).filter(Boolean).length;
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const indexMcp = landmarks[5];
  const wrist = landmarks[0];
  const nonThumbFolded =
    !fingerStates.index &&
    !fingerStates.middle &&
    !fingerStates.ring &&
    !fingerStates.pinky;
  const thumbVerticalLift = thumbMcp.y - thumbTip.y;
  const thumbHorizontalOffset = Math.abs(thumbTip.x - thumbMcp.x);
  const thumbRaised =
    fingerStates.thumb &&
    nonThumbFolded &&
    thumbTip.y < wrist.y - gestureEngineConfig.thumbsUpThreshold &&
    thumbVerticalLift > 0.12 &&
    thumbHorizontalOffset < 0.18;

  let gesture: GestureLabel = 'NONE';
  let confidence = 0;

  if (thumbRaised) {
    gesture = 'THUMBS_UP';
    confidence = matchConfidence(
      [
        fingerStates.thumb,
        !fingerStates.index,
        !fingerStates.middle,
        !fingerStates.ring,
        !fingerStates.pinky,
      ],
      0.06,
    );
  } else if (nonThumbFolded) {
    gesture = 'FIST';
    confidence = matchConfidence(
      [
        !fingerStates.index,
        !fingerStates.middle,
        !fingerStates.ring,
        !fingerStates.pinky,
        thumbVerticalLift < 0.12 || thumbHorizontalOffset >= 0.18,
      ],
      0.04,
    );
  } else if (isPinch) {
    gesture = 'PINCH';
    confidence = clamp(1 - pinchDistance / gestureEngineConfig.pinchThreshold + 0.12, 0, 0.99);
  } else if (
    fingerStates.index &&
    fingerStates.middle &&
    !fingerStates.ring &&
    !fingerStates.pinky
  ) {
    gesture = 'PEACE_SIGN';
    confidence = matchConfidence(
      [fingerStates.index, fingerStates.middle, !fingerStates.ring, !fingerStates.pinky],
      0.03,
    );
  } else if (
    fingerStates.index &&
    fingerStates.middle &&
    fingerStates.ring &&
    !fingerStates.pinky
  ) {
    gesture = 'THREE_FINGERS';
    confidence = matchConfidence(
      [fingerStates.index, fingerStates.middle, fingerStates.ring, !fingerStates.pinky],
      0.02,
    );
  } else if (
    fingerStates.index &&
    !fingerStates.middle &&
    !fingerStates.ring &&
    !fingerStates.pinky
  ) {
    gesture = 'INDEX_ONLY';
    confidence = matchConfidence(
      [fingerStates.index, !fingerStates.middle, !fingerStates.ring, !fingerStates.pinky],
      0.02,
    );
  } else if (extendedCount >= 4 && !isPinch) {
    gesture = 'OPEN_PALM';
    confidence = matchConfidence(
      [
        fingerStates.index,
        fingerStates.middle,
        fingerStates.ring,
        fingerStates.pinky,
        fingerStates.thumb || Math.abs(thumbTip.x - indexMcp.x) > 0.08,
      ],
      0.04,
    );
  }

  return {
    gesture,
    confidence,
    pinchDistance,
    fingerStates,
  };
}

export function classifyHands(results: HandLandmarkerResult): ClassifiedHandPose[] {
  return results.landmarks.map((landmarks, index) => {
    const hand = getHandedness(results.handednesses[index]);
    const pose = classifyGesture(landmarks, hand);

    return {
      hand,
      landmarks,
      center: getHandCenter(landmarks),
      ...pose,
    };
  });
}
