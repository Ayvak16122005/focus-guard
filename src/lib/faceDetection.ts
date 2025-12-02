import * as tf from "@tensorflow/tfjs";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";

let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;

// Temporal tracking for more accurate sleep detection
const EAR_HISTORY_SIZE = 15; // Track last 15 frames (~0.5 seconds at 30fps)
const CONSECUTIVE_DROWSY_THRESHOLD = 10; // Need 10 consecutive low EAR frames
const CONSECUTIVE_SLEEP_THRESHOLD = 12; // Need 12 consecutive very low EAR frames

let earHistory: number[] = [];
let consecutiveDrowsyFrames = 0;
let consecutiveSleepFrames = 0;
let consecutiveNoFaceFrames = 0;

export const initFaceDetection = async () => {
  if (detector) return detector;

  try {
    await tf.ready();
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
      runtime: "tfjs" as const,
      refineLandmarks: true,
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    console.log("Face detection model loaded");
    return detector;
  } catch (error) {
    console.error("Error loading face detection model:", error);
    return null;
  }
};

const calculateEyeAspectRatio = (landmarks: any, eyeIndices: number[]) => {
  // Calculate Eye Aspect Ratio (EAR) to detect drowsiness
  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((i) => landmarks[i]);

  // Vertical distances
  const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);

  // Horizontal distance
  const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);

  // EAR formula
  return (v1 + v2) / (2.0 * h);
};

const calculateHeadPose = (landmarks: any) => {
  // Simple head pose estimation using key facial points
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  // Calculate horizontal deviation
  const horizontalDeviation = Math.abs(nose.x - eyeCenter.x);
  
  // Calculate vertical deviation  
  const verticalDeviation = Math.abs(nose.y - eyeCenter.y);

  return { horizontalDeviation, verticalDeviation };
};

export const detectFaceAndAttention = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<{
  faceDetected: boolean;
  status: "attentive" | "distracted" | "drowsy";
  attentionScore: number;
}> => {
  if (!detector) {
    detector = await initFaceDetection();
  }

  if (!detector) {
    return { faceDetected: false, status: "distracted", attentionScore: 0 };
  }

  try {
    const faces = await detector.estimateFaces(video, {
      flipHorizontal: false,
    });

    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // More strict face detection - no face detected
    if (faces.length === 0) {
      consecutiveNoFaceFrames++;
      // Reset EAR tracking when face not detected
      earHistory = [];
      consecutiveDrowsyFrames = 0;
      consecutiveSleepFrames = 0;
      return { faceDetected: false, status: "distracted", attentionScore: 0 };
    }

    // Check if face is too far from center or too small (person moved away)
    const face = faces[0];
    const box = face.box;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    // Calculate face size relative to video
    const faceArea = box.width * box.height;
    const videoArea = videoWidth * videoHeight;
    const faceRatio = faceArea / videoArea;
    
    // Face is too small (person is too far) - consider as not present
    if (faceRatio < 0.015) {
      return { faceDetected: false, status: "distracted", attentionScore: 10 };
    }

    const landmarks = face.keypoints;

    // Draw face mesh for visualization
    if (ctx) {
      ctx.fillStyle = "rgba(66, 133, 244, 0.5)";
      landmarks.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Left eye indices (MediaPipe Face Mesh)
    const leftEyeIndices = [33, 160, 158, 133, 153, 144];
    // Right eye indices
    const rightEyeIndices = [362, 385, 387, 263, 373, 380];

    const leftEAR = calculateEyeAspectRatio(landmarks, leftEyeIndices);
    const rightEAR = calculateEyeAspectRatio(landmarks, rightEyeIndices);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Calculate head pose
    const { horizontalDeviation, verticalDeviation } = calculateHeadPose(landmarks);

    // Determine attention status
    let status: "attentive" | "distracted" | "drowsy" = "attentive";
    let attentionScore = 100;

    // Enhanced EAR thresholds with temporal tracking
    const EAR_SLEEP_THRESHOLD = 0.16; // Eyes fully or nearly closed (sleeping)
    const EAR_DROWSY_THRESHOLD = 0.21; // Eyes drooping (drowsy)
    const EAR_BLINK_THRESHOLD = 0.18; // Normal blink threshold
    
    // Head pose thresholds (normalized values)
    const HORIZONTAL_THRESHOLD = 0.05;
    const VERTICAL_THRESHOLD = 0.08;

    // Add current EAR to history
    earHistory.push(avgEAR);
    if (earHistory.length > EAR_HISTORY_SIZE) {
      earHistory.shift();
    }

    // Calculate average EAR over recent frames to filter out blinks
    const recentAvgEAR = earHistory.length > 0 
      ? earHistory.reduce((a, b) => a + b, 0) / earHistory.length 
      : avgEAR;

    // Track consecutive frames with low EAR (not just single frame detection)
    if (avgEAR < EAR_SLEEP_THRESHOLD) {
      consecutiveSleepFrames++;
      consecutiveDrowsyFrames++;
    } else if (avgEAR < EAR_DROWSY_THRESHOLD) {
      consecutiveSleepFrames = 0;
      consecutiveDrowsyFrames++;
    } else {
      consecutiveSleepFrames = 0;
      consecutiveDrowsyFrames = 0;
    }

    // Reset no-face counter when face is found
    consecutiveNoFaceFrames = 0;

    // Priority 1: SLEEPING - Need sustained closed eyes (not just a blink)
    if (consecutiveSleepFrames >= CONSECUTIVE_SLEEP_THRESHOLD || recentAvgEAR < EAR_SLEEP_THRESHOLD) {
      status = "drowsy";
      attentionScore = 10; // Very low score for sleeping
    }
    // Priority 2: DROWSY - Sustained droopy eyes
    else if (consecutiveDrowsyFrames >= CONSECUTIVE_DROWSY_THRESHOLD || recentAvgEAR < EAR_DROWSY_THRESHOLD) {
      status = "drowsy";
      attentionScore = 30;
    }
    // Priority 3: Check for head pose distraction
    else if (
      horizontalDeviation > HORIZONTAL_THRESHOLD ||
      verticalDeviation > VERTICAL_THRESHOLD
    ) {
      status = "distracted";
      attentionScore = 65;
    }

    // Adjust score based on deviations
    if (status === "attentive") {
      const posePenalty = (horizontalDeviation + verticalDeviation) * 200;
      attentionScore = Math.max(70, 100 - posePenalty);
    }

    return {
      faceDetected: true,
      status,
      attentionScore: Math.round(attentionScore),
    };
  } catch (error) {
    console.error("Error in face detection:", error);
    return { faceDetected: false, status: "distracted", attentionScore: 50 };
  }
};
