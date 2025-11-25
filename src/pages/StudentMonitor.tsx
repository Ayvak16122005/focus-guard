import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Video,
  VideoOff,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { detectFaceAndAttention } from "@/lib/faceDetection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StudentMonitor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Initialize alert sound
  useEffect(() => {
    alertSoundRef.current = new Audio("/alert-sound.mp3");
    alertSoundRef.current.volume = 0.5;
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [attentionScore, setAttentionScore] = useState(100);
  const [status, setStatus] = useState<"attentive" | "distracted" | "drowsy">("attentive");
  const [distractionTime, setDistractionTime] = useState(0);
  const [tabVisible, setTabVisible] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [sessionTime, setSessionTime] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [notOnScreenTime, setNotOnScreenTime] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);
  const previousStatusRef = useRef<"attentive" | "distracted" | "drowsy">("attentive");
  const hasAlertedNotOnScreenRef = useRef(false);

  // Fetch student's enrolled classes
  const { data: enrolledClasses } = useQuery({
    queryKey: ["student-classes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("class_students")
        .select(`
          class_id,
          classes(id, name, is_active)
        `)
        .eq("student_id", user.id);

      if (error) throw error;
      return data?.map(item => item.classes).filter(Boolean) || [];
    },
  });

  // Auto-select first class if only one is available
  useEffect(() => {
    if (enrolledClasses && enrolledClasses.length === 1 && !selectedClassId) {
      setSelectedClassId(enrolledClasses[0].id);
    }
  }, [enrolledClasses, selectedClassId]);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setTabVisible(isVisible);
      
      if (!isVisible && isMonitoring) {
        toast({
          title: "Warning: Tab Switched",
          description: "Please return to the class. This has been logged.",
          variant: "destructive",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isMonitoring, toast]);

  // Session timer
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isMonitoring]);

  // Immediate alert system for status changes
  useEffect(() => {
    if (previousStatusRef.current !== status) {
      if (status === "distracted") {
        // Play alert sound
        alertSoundRef.current?.play().catch(console.error);
        
        // Show visual alert
        toast({
          title: "⚠️ Distraction Detected",
          description: "Please focus on the class. Looking away detected.",
          variant: "destructive",
        });
      } else if (status === "drowsy") {
        // Play alert sound
        alertSoundRef.current?.play().catch(console.error);
        
        // Show visual alert
        toast({
          title: "😴 Drowsiness Alert",
          description: "You appear drowsy. Please stay alert and focused!",
          variant: "destructive",
        });
      } else if (status === "attentive" && previousStatusRef.current !== "attentive") {
        // Student returned to being attentive
        toast({
          title: "✓ Back to Focus",
          description: "Great! You're now paying attention.",
        });
      }
      
      previousStatusRef.current = status;
    }
  }, [status, toast]);

  // Distraction timer and extended alerts
  useEffect(() => {
    if (status === "distracted" || status === "drowsy") {
      const timer = setInterval(() => {
        setDistractionTime((prev) => {
          const newTime = prev + 1;
          
          if (newTime === 60) {
            toast({
              title: "Alert: Extended Distraction Detected",
              description: "You've been distracted for 60 seconds. Your teacher has been notified.",
              variant: "destructive",
            });
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setDistractionTime(0);
    }
  }, [status, toast]);

  // Track "not on screen" time (face not detected)
  useEffect(() => {
    if (!isMonitoring) return;

    if (!faceDetected) {
      const timer = setInterval(() => {
        setNotOnScreenTime((prev) => {
          const newTime = prev + 1;
          
          // Alert after 10 seconds of not being on screen
          if (newTime === 10 && !hasAlertedNotOnScreenRef.current) {
            hasAlertedNotOnScreenRef.current = true;
            
            // Play alert sound
            alertSoundRef.current?.play().catch(console.error);
            
            // Show visual alert
            toast({
              title: "⚠️ Not On Screen",
              description: "You haven't been detected for 10 seconds. Please face the camera. Your teacher has been notified.",
              variant: "destructive",
            });

            // Insert alert into database
            if (currentSessionId) {
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                  supabase.from("alerts").insert({
                    session_id: currentSessionId,
                    student_id: user.id,
                    alert_type: "not_on_screen",
                    severity: "high",
                    message: "Student not detected on screen for 10+ seconds",
                  });
                }
              });
            }
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setNotOnScreenTime(0);
      hasAlertedNotOnScreenRef.current = false;
    }
  }, [faceDetected, isMonitoring, currentSessionId, toast]);

  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsMonitoring(true);
        
        // Create monitoring session in database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: session } = await supabase
            .from("monitoring_sessions")
            .insert({
              student_id: user.id,
              class_id: selectedClassId,
              status: "active",
            })
            .select()
            .single();
          
          if (session) {
            setCurrentSessionId(session.id);
          }
        }
        
        toast({
          title: "Monitoring Started",
          description: "Your attention is now being tracked. Stay focused!",
        });

        // Start face detection loop
        detectLoop();
      }
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to join the monitored session.",
        variant: "destructive",
      });
    }
  };

  const stopMonitoring = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsMonitoring(false);
    setNotOnScreenTime(0);
    hasAlertedNotOnScreenRef.current = false;
    
    // Update session in database
    if (currentSessionId) {
      supabase
        .from("monitoring_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          total_duration_seconds: sessionTime,
        })
        .eq("id", currentSessionId);
      
      setCurrentSessionId(null);
    }
    
    toast({
      title: "Monitoring Stopped",
      description: "Session ended. Thank you for your participation!",
    });
  };

  const detectLoop = async () => {
    if (!videoRef.current || !canvasRef.current || !isMonitoring) return;

    const result = await detectFaceAndAttention(videoRef.current, canvasRef.current);
    
    setFaceDetected(result.faceDetected);
    setStatus(result.status);
    setAttentionScore(result.attentionScore);

    // Log metrics to database every 3 seconds
    if (currentSessionId && Math.floor(sessionTime) % 3 === 0) {
      supabase.from("attention_metrics").insert({
        session_id: currentSessionId,
        face_detected: result.faceDetected,
        status: result.status === "attentive" ? "focused" : result.status,
        attention_score: result.attentionScore,
      });
    }

    requestAnimationFrame(detectLoop);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = () => {
    switch (status) {
      case "attentive":
        return "text-success";
      case "distracted":
        return "text-warning";
      case "drowsy":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "attentive":
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Attentive
          </Badge>
        );
      case "distracted":
        return (
          <Badge className="bg-warning text-warning-foreground">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Distracted
          </Badge>
        );
      case "drowsy":
        return (
          <Badge className="bg-destructive text-destructive-foreground">
            <EyeOff className="mr-1 h-3 w-3" />
            Drowsy
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Student Monitoring</h1>
          <div className="w-24" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Video Feed */}
          <Card className="lg:col-span-2 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Live Feed</h2>
              {getStatusBadge()}
            </div>

            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 h-full w-full"
              />
              
              {/* Live Status Indicator */}
              {isMonitoring && (
                <div className="absolute top-4 left-4">
                  <Badge 
                    variant={faceDetected ? "default" : "destructive"}
                    className="text-base px-4 py-2"
                  >
                    {faceDetected ? (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        LIVE - You are visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        NOT DETECTED - Face the camera!
                      </>
                    )}
                  </Badge>
                </div>
              )}
              
              {!isMonitoring && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <VideoOff className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                    <p className="text-muted-foreground">Camera not active</p>
                  </div>
                </div>
              )}
            </div>

            {!isMonitoring && enrolledClasses && enrolledClasses.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="class-select">Select Class</Label>
                  <Select value={selectedClassId || ""} onValueChange={setSelectedClassId}>
                    <SelectTrigger id="class-select">
                      <SelectValue placeholder="Choose a class to monitor" />
                    </SelectTrigger>
                    <SelectContent>
                      {enrolledClasses.map((classItem: any) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-center">
              {!isMonitoring ? (
                <>
                  {enrolledClasses && enrolledClasses.length === 0 ? (
                    <div className="text-center">
                      <p className="text-muted-foreground mb-4">You haven't joined any classes yet.</p>
                      <Button onClick={() => navigate("/join")}>
                        Join a Class
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      onClick={startMonitoring}
                      disabled={!selectedClassId}
                      className="bg-gradient-primary text-white"
                    >
                      <Video className="mr-2 h-5 w-5" />
                      Start Monitoring
                    </Button>
                  )}
                </>
              ) : (
                <Button size="lg" variant="destructive" onClick={stopMonitoring}>
                  <VideoOff className="mr-2 h-5 w-5" />
                  Stop Monitoring
                </Button>
              )}
            </div>
          </Card>

          {/* Stats Panel */}
          <div className="space-y-6">
            {/* Session Info */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">Session Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="font-mono text-sm font-medium text-foreground">
                    {formatTime(sessionTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tab Status</span>
                  <Badge variant={tabVisible ? "default" : "destructive"}>
                    {tabVisible ? "Active" : "Hidden"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Face Detected</span>
                  <Badge variant={faceDetected ? "default" : "destructive"}>
                    {faceDetected ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Attention Score */}
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">Attention Score</h3>
              <div className="mb-2 text-center">
                <div className={`text-4xl font-bold ${getStatusColor()}`}>
                  {attentionScore}%
                </div>
              </div>
              <Progress value={attentionScore} className="h-3" />
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {attentionScore >= 80
                  ? "Excellent focus!"
                  : attentionScore >= 60
                  ? "Stay engaged"
                  : "Need more attention"}
              </p>
            </Card>

            {/* Distraction Alert */}
            {(status === "distracted" || status === "drowsy") && (
              <Card className="border-warning bg-warning/5 p-6">
                <div className="mb-2 flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-semibold">Attention Alert</h3>
                </div>
                <p className="mb-2 text-sm text-muted-foreground">
                  You've been {status} for {distractionTime} seconds.
                </p>
                {distractionTime >= 45 && (
                  <p className="text-sm font-medium text-warning">
                    Teacher will be notified in {60 - distractionTime}s
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentMonitor;
