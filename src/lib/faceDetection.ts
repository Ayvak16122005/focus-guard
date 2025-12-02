// Re-export from new modular detection system
export { 
  initFaceDetection, 
  detectFaceAndAttention,
  resetDetection 
} from "./attentionDetection";

export type { 
  DetectionResult, 
  AttentionStatus, 
  AlertType,
  FeatureVector 
} from "./attentionDetection";
