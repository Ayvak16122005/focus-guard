// Types for the attention detection system

export interface DetectionResult {
  faceDetected: boolean;
  status: AttentionStatus;
  attentionScore: number;
  features: FeatureVector;
  alerts: AlertType[];
}

export type AttentionStatus = "attentive" | "distracted" | "drowsy";

export type AlertType = "drowsy" | "yawning" | "looking_away" | "not_on_screen" | "prolonged_inattention";

export interface FeatureVector {
  ear: number;           // Eye Aspect Ratio
  mar: number;           // Mouth Aspect Ratio (yawning)
  perclos: number;       // Percentage of Eye Closure
  blinkRate: number;     // Blinks per minute
  headPose: HeadPose;
  gazeDeviation: number; // How far gaze is from center
  faceSize: number;      // Face size ratio (distance indicator)
}

export interface HeadPose {
  pitch: number;  // Up/down
  yaw: number;    // Left/right
  roll: number;   // Tilt
}

export interface ThresholdConfig {
  EAR_SLEEP: number;
  EAR_DROWSY: number;
  EAR_BLINK: number;
  MAR_YAWN: number;
  PERCLOS_DROWSY: number;
  HEAD_YAW_DISTRACTED: number;
  HEAD_PITCH_DISTRACTED: number;
  GAZE_DISTRACTED: number;
  MIN_FACE_RATIO: number;
  CONSECUTIVE_FRAMES_SLEEP: number;
  CONSECUTIVE_FRAMES_DROWSY: number;
  BLINK_RATE_LOW: number;
  BLINK_RATE_HIGH: number;
}

// Default thresholds based on research
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  EAR_SLEEP: 0.16,           // Eyes fully closed
  EAR_DROWSY: 0.21,          // Eyes drooping
  EAR_BLINK: 0.22,           // Normal blink threshold
  MAR_YAWN: 0.6,             // Mouth open for yawning
  PERCLOS_DROWSY: 0.15,      // 15% eye closure over time indicates drowsiness
  HEAD_YAW_DISTRACTED: 25,   // Degrees turned left/right
  HEAD_PITCH_DISTRACTED: 20, // Degrees looking up/down
  GAZE_DISTRACTED: 0.15,     // Normalized gaze deviation
  MIN_FACE_RATIO: 0.015,     // Minimum face size in frame
  CONSECUTIVE_FRAMES_SLEEP: 12,
  CONSECUTIVE_FRAMES_DROWSY: 10,
  BLINK_RATE_LOW: 5,         // Low blink rate (staring)
  BLINK_RATE_HIGH: 25,       // High blink rate (fatigue)
};
