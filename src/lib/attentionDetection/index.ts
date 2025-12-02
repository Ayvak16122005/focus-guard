// Main attention detection module
import * as tf from "@tensorflow/tfjs";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import { DetectionResult, DEFAULT_THRESHOLDS } from "./types";
import { extractFeatures, LANDMARKS } from "./featureExtractor";
import { classifyAttentionState, resetClassifier } from "./classifier";
import { temporalTracker } from "./temporalTracker";

let detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;

// Initialize face detection model
export const initFaceDetection = async (): Promise<faceLandmarksDetection.FaceLandmarksDetector | null> => {
  if (detector) return detector;

  try {
    await tf.ready();
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detectorConfig = {
      runtime: "tfjs" as const,
      refineLandmarks: true, // Enable iris tracking
    };
    detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
    console.log("Face detection model loaded with iris tracking");
    return detector;
  } catch (error) {
    console.error("Error loading face detection model:", error);
    return null;
  }
};

// Main detection function
export const detectFaceAndAttention = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<DetectionResult> => {
  if (!detector) {
    detector = await initFaceDetection();
  }

  if (!detector) {
    return {
      faceDetected: false,
      status: "distracted",
      attentionScore: 0,
      features: getEmptyFeatures(),
      alerts: ["not_on_screen"],
    };
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

    // No face detected
    if (faces.length === 0) {
      const noFaceFrames = temporalTracker.incrementNoFaceFrames();
      return {
        faceDetected: false,
        status: "distracted",
        attentionScore: 0,
        features: getEmptyFeatures(),
        alerts: noFaceFrames >= 10 ? ["not_on_screen"] : [],
      };
    }

    const face = faces[0];
    const box = face.box;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Check if face is too small (person is too far)
    const faceArea = box.width * box.height;
    const videoArea = videoWidth * videoHeight;
    const faceRatio = faceArea / videoArea;

    if (faceRatio < DEFAULT_THRESHOLDS.MIN_FACE_RATIO) {
      temporalTracker.incrementNoFaceFrames();
      return {
        faceDetected: false,
        status: "distracted",
        attentionScore: 10,
        features: getEmptyFeatures(),
        alerts: ["not_on_screen"],
      };
    }

    // Face detected - reset no-face counter
    temporalTracker.resetNoFaceFrames();

    const landmarks = face.keypoints;

    // Draw visualization
    if (ctx) {
      drawVisualization(ctx, landmarks, box);
    }

    // Extract features
    const perclos = temporalTracker.calculatePERCLOS();
    const blinkRate = temporalTracker.getBlinkRate();
    
    const features = extractFeatures(
      landmarks,
      videoWidth,
      videoHeight,
      { width: box.width, height: box.height },
      perclos,
      blinkRate
    );

    // Classify attention state
    const classification = classifyAttentionState(features);

    return {
      faceDetected: true,
      status: classification.status,
      attentionScore: classification.attentionScore,
      features,
      alerts: classification.alerts,
    };
  } catch (error) {
    console.error("Error in face detection:", error);
    return {
      faceDetected: false,
      status: "distracted",
      attentionScore: 50,
      features: getEmptyFeatures(),
      alerts: [],
    };
  }
};

// Draw visualization on canvas
const drawVisualization = (
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  box: { xMin: number; yMin: number; width: number; height: number }
): void => {
  // Draw face mesh points
  ctx.fillStyle = "rgba(66, 133, 244, 0.4)";
  landmarks.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Highlight eye landmarks
  ctx.fillStyle = "rgba(76, 175, 80, 0.8)";
  [...LANDMARKS.LEFT_EYE, ...LANDMARKS.RIGHT_EYE].forEach((idx) => {
    const point = landmarks[idx];
    if (point) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  // Draw face bounding box
  ctx.strokeStyle = "rgba(66, 133, 244, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);
};

// Get empty features for when face is not detected
const getEmptyFeatures = () => ({
  ear: 0,
  mar: 0,
  perclos: 0,
  blinkRate: 0,
  headPose: { pitch: 0, yaw: 0, roll: 0 },
  gazeDeviation: 0,
  faceSize: 0,
});

// Export reset function
export const resetDetection = (): void => {
  resetClassifier();
};

// Re-export types
export * from "./types";
