// Feature extraction from facial landmarks
import { FeatureVector, HeadPose, DEFAULT_THRESHOLDS } from "./types";

// MediaPipe Face Mesh landmark indices
const LANDMARKS = {
  // Left eye
  LEFT_EYE: [33, 160, 158, 133, 153, 144],
  LEFT_EYE_CENTER: 468,
  // Right eye
  RIGHT_EYE: [362, 385, 387, 263, 373, 380],
  RIGHT_EYE_CENTER: 473,
  // Mouth
  MOUTH_TOP: 13,
  MOUTH_BOTTOM: 14,
  MOUTH_LEFT: 78,
  MOUTH_RIGHT: 308,
  MOUTH_INNER_TOP: 82,
  MOUTH_INNER_BOTTOM: 87,
  // Nose and face reference points
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
  CHIN: 152,
  FOREHEAD: 10,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
  // Iris for gaze tracking
  LEFT_IRIS: [468, 469, 470, 471, 472],
  RIGHT_IRIS: [473, 474, 475, 476, 477],
};

// Calculate Eye Aspect Ratio (EAR)
export const calculateEAR = (landmarks: any[], eyeIndices: number[]): number => {
  try {
    const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((i) => landmarks[i]);
    
    // Vertical distances
    const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    
    // Horizontal distance
    const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
    
    if (h === 0) return 0.3; // Default open eye value
    return (v1 + v2) / (2.0 * h);
  } catch {
    return 0.3;
  }
};

// Calculate Mouth Aspect Ratio (MAR) for yawning detection
export const calculateMAR = (landmarks: any[]): number => {
  try {
    const mouthTop = landmarks[LANDMARKS.MOUTH_TOP];
    const mouthBottom = landmarks[LANDMARKS.MOUTH_BOTTOM];
    const mouthLeft = landmarks[LANDMARKS.MOUTH_LEFT];
    const mouthRight = landmarks[LANDMARKS.MOUTH_RIGHT];
    const innerTop = landmarks[LANDMARKS.MOUTH_INNER_TOP];
    const innerBottom = landmarks[LANDMARKS.MOUTH_INNER_BOTTOM];
    
    // Vertical mouth opening
    const verticalOuter = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);
    const verticalInner = Math.hypot(innerTop.x - innerBottom.x, innerTop.y - innerBottom.y);
    const vertical = (verticalOuter + verticalInner) / 2;
    
    // Horizontal mouth width
    const horizontal = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
    
    if (horizontal === 0) return 0;
    return vertical / horizontal;
  } catch {
    return 0;
  }
};

// Calculate head pose estimation
export const calculateHeadPose = (landmarks: any[], imageWidth: number, imageHeight: number): HeadPose => {
  try {
    const nose = landmarks[LANDMARKS.NOSE_TIP];
    const noseBridge = landmarks[LANDMARKS.NOSE_BRIDGE];
    const chin = landmarks[LANDMARKS.CHIN];
    const forehead = landmarks[LANDMARKS.FOREHEAD];
    const leftEar = landmarks[LANDMARKS.LEFT_EAR];
    const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
    
    // Calculate face center
    const faceCenter = {
      x: (leftEar.x + rightEar.x) / 2,
      y: (forehead.y + chin.y) / 2,
    };
    
    // Yaw (left/right rotation) - based on nose position relative to ear midpoint
    const earMidX = (leftEar.x + rightEar.x) / 2;
    const noseDeviationX = (nose.x - earMidX) * imageWidth;
    const faceWidth = Math.abs(rightEar.x - leftEar.x) * imageWidth;
    const yaw = faceWidth > 0 ? (noseDeviationX / faceWidth) * 90 : 0;
    
    // Pitch (up/down) - based on nose tip relative to nose bridge
    const faceHeight = Math.abs(chin.y - forehead.y) * imageHeight;
    const noseDeviationY = (nose.y - noseBridge.y) * imageHeight;
    const pitch = faceHeight > 0 ? (noseDeviationY / faceHeight) * 60 - 15 : 0;
    
    // Roll (tilt) - based on ear alignment
    const earDeltaY = (rightEar.y - leftEar.y) * imageHeight;
    const earDeltaX = (rightEar.x - leftEar.x) * imageWidth;
    const roll = Math.atan2(earDeltaY, earDeltaX) * (180 / Math.PI);
    
    return { pitch, yaw, roll };
  } catch {
    return { pitch: 0, yaw: 0, roll: 0 };
  }
};

// Calculate gaze deviation using iris position
export const calculateGazeDeviation = (landmarks: any[]): number => {
  try {
    // Get eye corners and iris centers
    const leftEyeLeft = landmarks[LANDMARKS.LEFT_EYE[0]];
    const leftEyeRight = landmarks[LANDMARKS.LEFT_EYE[3]];
    const rightEyeLeft = landmarks[LANDMARKS.RIGHT_EYE[0]];
    const rightEyeRight = landmarks[LANDMARKS.RIGHT_EYE[3]];
    
    // Iris centers (if available, indices 468 and 473)
    const leftIris = landmarks[468] || { x: (leftEyeLeft.x + leftEyeRight.x) / 2, y: (leftEyeLeft.y + leftEyeRight.y) / 2 };
    const rightIris = landmarks[473] || { x: (rightEyeLeft.x + rightEyeRight.x) / 2, y: (rightEyeLeft.y + rightEyeRight.y) / 2 };
    
    // Calculate expected center positions
    const leftEyeCenter = {
      x: (leftEyeLeft.x + leftEyeRight.x) / 2,
      y: (leftEyeLeft.y + leftEyeRight.y) / 2,
    };
    const rightEyeCenter = {
      x: (rightEyeLeft.x + rightEyeRight.x) / 2,
      y: (rightEyeLeft.y + rightEyeRight.y) / 2,
    };
    
    // Calculate deviation from center
    const leftDeviation = Math.hypot(leftIris.x - leftEyeCenter.x, leftIris.y - leftEyeCenter.y);
    const rightDeviation = Math.hypot(rightIris.x - rightEyeCenter.x, rightIris.y - rightEyeCenter.y);
    
    // Normalize by eye width
    const leftEyeWidth = Math.abs(leftEyeRight.x - leftEyeLeft.x);
    const rightEyeWidth = Math.abs(rightEyeRight.x - rightEyeLeft.x);
    
    const leftNormalized = leftEyeWidth > 0 ? leftDeviation / leftEyeWidth : 0;
    const rightNormalized = rightEyeWidth > 0 ? rightDeviation / rightEyeWidth : 0;
    
    return (leftNormalized + rightNormalized) / 2;
  } catch {
    return 0;
  }
};

// Extract all features from landmarks
export const extractFeatures = (
  landmarks: any[],
  imageWidth: number,
  imageHeight: number,
  faceBox: { width: number; height: number },
  perclos: number,
  blinkRate: number
): FeatureVector => {
  const leftEAR = calculateEAR(landmarks, LANDMARKS.LEFT_EYE);
  const rightEAR = calculateEAR(landmarks, LANDMARKS.RIGHT_EYE);
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  const mar = calculateMAR(landmarks);
  const headPose = calculateHeadPose(landmarks, imageWidth, imageHeight);
  const gazeDeviation = calculateGazeDeviation(landmarks);
  
  const faceSize = (faceBox.width * faceBox.height) / (imageWidth * imageHeight);
  
  return {
    ear: avgEAR,
    mar,
    perclos,
    blinkRate,
    headPose,
    gazeDeviation,
    faceSize,
  };
};

export { LANDMARKS };
