// Multi-feature attention state classifier
import { AttentionStatus, FeatureVector, AlertType, DEFAULT_THRESHOLDS } from "./types";
import { temporalTracker } from "./temporalTracker";

interface ClassificationResult {
  status: AttentionStatus;
  attentionScore: number;
  alerts: AlertType[];
  confidence: number;
}

// Weighted scoring for different features
const WEIGHTS = {
  ear: 0.30,      // Eye openness is primary indicator
  perclos: 0.20,  // Prolonged eye closure
  mar: 0.10,      // Yawning
  headPose: 0.20, // Head position
  gaze: 0.15,     // Where they're looking
  blinkRate: 0.05, // Blink frequency
};

export const classifyAttentionState = (features: FeatureVector): ClassificationResult => {
  const alerts: AlertType[] = [];
  let status: AttentionStatus = "attentive";
  let attentionScore = 100;
  
  // Update temporal tracker
  const { isBlink } = temporalTracker.updateEAR(features.ear);
  temporalTracker.updateMAR(features.mar);
  
  // Get temporal metrics
  const perclos = temporalTracker.calculatePERCLOS();
  const blinkRate = temporalTracker.getBlinkRate();
  const recentAvgEAR = temporalTracker.getRecentAvgEAR();
  const { isSleeping, isDrowsy } = temporalTracker.updateDrowsyState(features.ear);
  const isYawning = temporalTracker.isYawning(features.mar);
  
  // Check head pose distraction
  const headDistracted = 
    Math.abs(features.headPose.yaw) > DEFAULT_THRESHOLDS.HEAD_YAW_DISTRACTED ||
    Math.abs(features.headPose.pitch) > DEFAULT_THRESHOLDS.HEAD_PITCH_DISTRACTED;
  
  // Check gaze distraction
  const gazeDistracted = features.gazeDeviation > DEFAULT_THRESHOLDS.GAZE_DISTRACTED;
  
  // Update distraction state with temporal filtering
  const sustainedDistraction = temporalTracker.updateDistractedState(headDistracted || gazeDistracted);
  
  // Classification logic with priority
  
  // PRIORITY 1: SLEEPING (highest priority)
  if (isSleeping || (recentAvgEAR < DEFAULT_THRESHOLDS.EAR_SLEEP && perclos > 0.4)) {
    status = "drowsy";
    attentionScore = 5;
    alerts.push("drowsy");
  }
  // PRIORITY 2: DROWSY (sustained eye closure or high PERCLOS)
  else if (isDrowsy || perclos > DEFAULT_THRESHOLDS.PERCLOS_DROWSY) {
    status = "drowsy";
    attentionScore = 25;
    alerts.push("drowsy");
  }
  // PRIORITY 3: YAWNING (indicator of fatigue)
  else if (isYawning) {
    status = "drowsy";
    attentionScore = 40;
    alerts.push("yawning");
  }
  // PRIORITY 4: LOOKING AWAY (sustained)
  else if (sustainedDistraction) {
    status = "distracted";
    attentionScore = 50;
    alerts.push("looking_away");
  }
  // PRIORITY 5: BRIEF DISTRACTION
  else if (headDistracted || gazeDistracted) {
    status = "distracted";
    attentionScore = 70;
  }
  // ATTENTIVE - Fine-tune score based on features
  else {
    status = "attentive";
    
    // Calculate attention score based on multiple factors
    let score = 100;
    
    // Penalize for slight head deviation
    const headPenalty = (Math.abs(features.headPose.yaw) + Math.abs(features.headPose.pitch)) * 0.5;
    score -= Math.min(headPenalty, 15);
    
    // Penalize for gaze deviation
    const gazePenalty = features.gazeDeviation * 100;
    score -= Math.min(gazePenalty, 10);
    
    // Penalize for low EAR (droopy eyes)
    if (features.ear < 0.25) {
      score -= (0.25 - features.ear) * 100;
    }
    
    // Penalize for abnormal blink rate
    if (blinkRate < DEFAULT_THRESHOLDS.BLINK_RATE_LOW || blinkRate > DEFAULT_THRESHOLDS.BLINK_RATE_HIGH) {
      score -= 5;
    }
    
    attentionScore = Math.max(70, Math.round(score));
  }
  
  // Check for prolonged inattention
  if (status !== "attentive" && temporalTracker.getStatusDuration() > 60000) {
    alerts.push("prolonged_inattention");
  }
  
  // Calculate confidence based on feature quality
  const confidence = calculateConfidence(features);
  
  // Update status in tracker
  temporalTracker.updateStatus(status);
  
  return {
    status,
    attentionScore,
    alerts,
    confidence,
  };
};

// Calculate confidence in classification
const calculateConfidence = (features: FeatureVector): number => {
  let confidence = 100;
  
  // Lower confidence for small face size (far from camera)
  if (features.faceSize < 0.03) {
    confidence -= 20;
  } else if (features.faceSize < 0.05) {
    confidence -= 10;
  }
  
  // Lower confidence for extreme head poses
  if (Math.abs(features.headPose.yaw) > 40 || Math.abs(features.headPose.pitch) > 30) {
    confidence -= 15;
  }
  
  return Math.max(50, confidence);
};

// Reset classifier state (call when starting new session)
export const resetClassifier = (): void => {
  temporalTracker.reset();
};
