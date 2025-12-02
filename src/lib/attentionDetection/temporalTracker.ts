// Temporal tracking for PERCLOS, blink detection, and state persistence
import { DEFAULT_THRESHOLDS } from "./types";

const HISTORY_SIZE = 90; // Track ~3 seconds at 30fps
const PERCLOS_WINDOW = 30; // 1 second window for PERCLOS
const BLINK_DURATION_MIN = 3; // Minimum frames for a blink
const BLINK_DURATION_MAX = 15; // Maximum frames for a normal blink

class TemporalTracker {
  private earHistory: number[] = [];
  private marHistory: number[] = [];
  private blinkTimestamps: number[] = [];
  private lastBlinkFrame = 0;
  private inBlink = false;
  private blinkStartFrame = 0;
  private frameCount = 0;
  
  // Consecutive frame counters
  private consecutiveDrowsyFrames = 0;
  private consecutiveSleepFrames = 0;
  private consecutiveYawnFrames = 0;
  private consecutiveDistractedFrames = 0;
  private consecutiveNoFaceFrames = 0;
  
  // State persistence
  private lastStatus: "attentive" | "distracted" | "drowsy" = "attentive";
  private statusChangeTimestamp = Date.now();

  reset(): void {
    this.earHistory = [];
    this.marHistory = [];
    this.blinkTimestamps = [];
    this.consecutiveDrowsyFrames = 0;
    this.consecutiveSleepFrames = 0;
    this.consecutiveYawnFrames = 0;
    this.consecutiveDistractedFrames = 0;
    this.consecutiveNoFaceFrames = 0;
    this.frameCount = 0;
    this.inBlink = false;
  }

  incrementNoFaceFrames(): number {
    this.consecutiveNoFaceFrames++;
    // Reset eye tracking when face not detected
    this.earHistory = [];
    this.consecutiveDrowsyFrames = 0;
    this.consecutiveSleepFrames = 0;
    return this.consecutiveNoFaceFrames;
  }

  resetNoFaceFrames(): void {
    this.consecutiveNoFaceFrames = 0;
  }

  // Update EAR history and detect blinks
  updateEAR(ear: number): { isBlink: boolean; blinkDuration: number } {
    this.frameCount++;
    this.earHistory.push(ear);
    if (this.earHistory.length > HISTORY_SIZE) {
      this.earHistory.shift();
    }

    let isBlink = false;
    let blinkDuration = 0;

    // Blink detection with hysteresis
    if (!this.inBlink && ear < DEFAULT_THRESHOLDS.EAR_BLINK) {
      this.inBlink = true;
      this.blinkStartFrame = this.frameCount;
    } else if (this.inBlink && ear >= DEFAULT_THRESHOLDS.EAR_BLINK + 0.02) {
      // Eye reopened
      blinkDuration = this.frameCount - this.blinkStartFrame;
      
      // Only count as blink if duration is within normal range
      if (blinkDuration >= BLINK_DURATION_MIN && blinkDuration <= BLINK_DURATION_MAX) {
        isBlink = true;
        this.blinkTimestamps.push(Date.now());
        // Keep only last 60 seconds of blinks
        const oneMinuteAgo = Date.now() - 60000;
        this.blinkTimestamps = this.blinkTimestamps.filter(t => t > oneMinuteAgo);
      }
      
      this.inBlink = false;
    }

    return { isBlink, blinkDuration };
  }

  // Calculate PERCLOS (Percentage of Eye Closure)
  calculatePERCLOS(): number {
    if (this.earHistory.length < PERCLOS_WINDOW) return 0;
    
    const recentEAR = this.earHistory.slice(-PERCLOS_WINDOW);
    const closedFrames = recentEAR.filter(ear => ear < DEFAULT_THRESHOLDS.EAR_DROWSY).length;
    
    return closedFrames / PERCLOS_WINDOW;
  }

  // Get blink rate (blinks per minute)
  getBlinkRate(): number {
    const oneMinuteAgo = Date.now() - 60000;
    const recentBlinks = this.blinkTimestamps.filter(t => t > oneMinuteAgo);
    return recentBlinks.length;
  }

  // Get average EAR over recent frames
  getRecentAvgEAR(frames: number = 15): number {
    if (this.earHistory.length === 0) return 0.3;
    const recent = this.earHistory.slice(-frames);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  // Update MAR history for yawning detection
  updateMAR(mar: number): void {
    this.marHistory.push(mar);
    if (this.marHistory.length > HISTORY_SIZE) {
      this.marHistory.shift();
    }
  }

  // Check for sustained yawning
  isYawning(currentMAR: number): boolean {
    if (currentMAR > DEFAULT_THRESHOLDS.MAR_YAWN) {
      this.consecutiveYawnFrames++;
      return this.consecutiveYawnFrames >= 8; // ~0.25 seconds of yawning
    } else {
      this.consecutiveYawnFrames = Math.max(0, this.consecutiveYawnFrames - 2);
      return false;
    }
  }

  // Track drowsy state
  updateDrowsyState(ear: number): { isSleeping: boolean; isDrowsy: boolean } {
    if (ear < DEFAULT_THRESHOLDS.EAR_SLEEP) {
      this.consecutiveSleepFrames++;
      this.consecutiveDrowsyFrames++;
    } else if (ear < DEFAULT_THRESHOLDS.EAR_DROWSY) {
      this.consecutiveSleepFrames = 0;
      this.consecutiveDrowsyFrames++;
    } else {
      this.consecutiveSleepFrames = 0;
      this.consecutiveDrowsyFrames = Math.max(0, this.consecutiveDrowsyFrames - 2);
    }

    return {
      isSleeping: this.consecutiveSleepFrames >= DEFAULT_THRESHOLDS.CONSECUTIVE_FRAMES_SLEEP,
      isDrowsy: this.consecutiveDrowsyFrames >= DEFAULT_THRESHOLDS.CONSECUTIVE_FRAMES_DROWSY,
    };
  }

  // Track distraction state
  updateDistractedState(isDistracted: boolean): boolean {
    if (isDistracted) {
      this.consecutiveDistractedFrames++;
    } else {
      this.consecutiveDistractedFrames = Math.max(0, this.consecutiveDistractedFrames - 2);
    }
    return this.consecutiveDistractedFrames >= 8;
  }

  // Get state counters for debugging/display
  getStateCounters() {
    return {
      consecutiveDrowsyFrames: this.consecutiveDrowsyFrames,
      consecutiveSleepFrames: this.consecutiveSleepFrames,
      consecutiveYawnFrames: this.consecutiveYawnFrames,
      consecutiveDistractedFrames: this.consecutiveDistractedFrames,
      consecutiveNoFaceFrames: this.consecutiveNoFaceFrames,
    };
  }

  // Status change tracking
  updateStatus(newStatus: "attentive" | "distracted" | "drowsy"): boolean {
    if (newStatus !== this.lastStatus) {
      this.lastStatus = newStatus;
      this.statusChangeTimestamp = Date.now();
      return true;
    }
    return false;
  }

  getStatusDuration(): number {
    return Date.now() - this.statusChangeTimestamp;
  }

  getLastStatus() {
    return this.lastStatus;
  }
}

// Singleton instance
export const temporalTracker = new TemporalTracker();
