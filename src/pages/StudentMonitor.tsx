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
import { useNavigate, useSearchParams } from "react-router-dom";
import { detectFaceAndAttention, resetDetection, AlertType } from "@/lib/faceDetection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TeacherStream from "@/components/student/TeacherStream";
import BroadcastMessages from "@/components/student/BroadcastMessages";

// Track last alert time per type to prevent spam
const lastAlertTime: Record<string, number> = {};
const ALERT_COOLDOWN_MS = 30000; // 30 seconds between same alert types
const DISTRACTION_ALERT_THRESHOLD = 20; // Alert teacher after 20 seconds
const DROWSY_BEEP_THRESHOLD = 15; // 15 seconds of eyes closed = beep alerts
const TAB_SWITCH_ALERT_COOLDOWN = 10000; // 10 seconds between tab switch alerts

const StudentMonitor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [attentionScore, setAttentionScore] = useState(100);
  const [status, setStatus] = useState<"attentive" | "distracted" | "drowsy">("attentive");
  const [distractionTime, setDistractionTime] = useState(0);
  const [tabVisible, setTabVisible] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);
  const [sessionTime, setSessionTime] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(searchParams.get("classId"));
  const [notOnScreenTime, setNotOnScreenTime] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hasAlerted20Sec, setHasAlerted20Sec] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [drowsyTime, setDrowsyTime] = useState(0);
  const [hasPlayedDrowsyBeeps, setHasPlayedDrowsyBeeps] = useState(false);
  const [studentName, setStudentName] = useState<string>("Student");
  
  const previousStatusRef = useRef<"attentive" | "distracted" | "drowsy">("attentive");
  const hasAlertedNotOnScreenRef = useRef(false);
  const lastTabSwitchAlertRef = useRef<number>(0);

  // Initialize alert sound and fetch student name
  useEffect(() => {
    alertSoundRef.current = new Audio("/alert-sound.mp3");
    alertSoundRef.current.volume = 0.7;
    
    // Fetch student name for alerts
    const fetchStudentName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) {
          setStudentName(profile.full_name);
        }
      }
    };
    fetchStudentName();
  }, []);

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

  // Fetch selected class info for teacher name
  const { data: selectedClass } = useQuery({
    queryKey: ["selected-class", selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return null;
      const { data } = await supabase
        .from("classes")
        .select(`*, profiles!classes_teacher_id_fkey(full_name)`)
        .eq("id", selectedClassId)
        .single();
      return data;
    },
    enabled: !!selectedClassId,
  });

  // Auto-select class from URL or first class
  useEffect(() => {
    const classIdFromUrl = searchParams.get("classId");
    if (classIdFromUrl) {
      setSelectedClassId(classIdFromUrl);
    } else if (enrolledClasses && enrolledClasses.length === 1 && !selectedClassId) {
      setSelectedClassId(enrolledClasses[0].id);
    }
  }, [enrolledClasses, selectedClassId, searchParams]);

  // Track tab visibility with enhanced detection and alerts
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isVisible = !document.hidden;
      setTabVisible(isVisible);
      
      if (!isVisible && isMonitoring && currentSessionId) {
        const now = Date.now();
        setTabSwitchCount(prev => prev + 1);
        
        // Play alert sound for student
        alertSoundRef.current?.play().catch(console.error);
        
        // Show warning to student
        toast({
          title: "⚠️ TAB SWITCH DETECTED!",
          description: "Don't switch tabs or apps! Please return to the class immediately. This has been logged.",
          variant: "destructive",
        });
        
        // Alert teacher (with cooldown to prevent spam)
        if (now - lastTabSwitchAlertRef.current > TAB_SWITCH_ALERT_COOLDOWN) {
          lastTabSwitchAlertRef.current = now;
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("alerts").insert({
              session_id: currentSessionId,
              student_id: user.id,
              alert_type: "tab_switch",
              severity: "high",
              message: `${studentName} is not being attentive - switched to another tab/app while attending the online class`,
            });
          }
        }
      } else if (isVisible && isMonitoring) {
        // Student returned
        toast({
          title: "✓ Welcome Back",
          description: "Stay focused on the class!",
        });
      }
    };

    // Also detect window blur (when user clicks outside browser)
    const handleWindowBlur = async () => {
      if (isMonitoring && currentSessionId) {
        const now = Date.now();
        
        // Play alert sound
        alertSoundRef.current?.play().catch(console.error);
        
        toast({
          title: "⚠️ FOCUS LOST!",
          description: "You clicked outside the class window. Please stay on the class!",
          variant: "destructive",
        });
        
        if (now - lastTabSwitchAlertRef.current > TAB_SWITCH_ALERT_COOLDOWN) {
          lastTabSwitchAlertRef.current = now;
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("alerts").insert({
              session_id: currentSessionId,
              student_id: user.id,
              alert_type: "window_blur",
              severity: "medium",
              message: `${studentName} may be using other apps - focus lost from class window`,
            });
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isMonitoring, toast, currentSessionId, studentName]);

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
        alertSoundRef.current?.play().catch(console.error);
        toast({
          title: "⚠️ Distraction Detected",
          description: "Please focus on the class. Looking away detected.",
          variant: "destructive",
        });
      } else if (status === "drowsy") {
        alertSoundRef.current?.play().catch(console.error);
        
        toast({
          title: "😴 DROWSINESS DETECTED!",
          description: "Your eyes appear to be closing. Stay awake!",
          variant: "destructive",
        });
        
        // Reset drowsy timer when entering drowsy state
        setDrowsyTime(0);
        setHasPlayedDrowsyBeeps(false);
      } else if (status === "attentive" && previousStatusRef.current !== "attentive") {
        toast({
          title: "✓ Back to Focus",
          description: "Great! You're now paying attention.",
        });
        setHasAlerted20Sec(false);
        setDrowsyTime(0);
        setHasPlayedDrowsyBeeps(false);
      }
      
      previousStatusRef.current = status;
    }
  }, [status, toast]);

  // Distraction timer with 20-second alert
  useEffect(() => {
    if (status === "distracted" || status === "drowsy") {
      const timer = setInterval(() => {
        setDistractionTime((prev) => {
          const newTime = prev + 1;
          
          // Alert teacher at 20 seconds
          if (newTime === DISTRACTION_ALERT_THRESHOLD && !hasAlerted20Sec && currentSessionId) {
            setHasAlerted20Sec(true);
            alertSoundRef.current?.play().catch(console.error);
            
            toast({
              title: "⚠️ Alert Sent to Teacher",
              description: `You've been ${status} for ${DISTRACTION_ALERT_THRESHOLD} seconds. Your teacher has been notified.`,
              variant: "destructive",
            });

            sendAlertToTeacher(
              status === "drowsy" ? "drowsy" : "prolonged_inattention",
              `${studentName} has been ${status} for ${DISTRACTION_ALERT_THRESHOLD}+ seconds - not being attentive in class`,
              "high"
            );
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setDistractionTime(0);
      setHasAlerted20Sec(false);
    }
  }, [status, toast, hasAlerted20Sec, currentSessionId, studentName]);

  // Drowsy/eyes closed timer - play 3-4 beeps after 15 seconds
  useEffect(() => {
    if (status === "drowsy" && isMonitoring) {
      const timer = setInterval(() => {
        setDrowsyTime((prev) => {
          const newTime = prev + 1;
          
          // Play 3-4 beep sounds after 15 seconds of eyes closed
          if (newTime >= DROWSY_BEEP_THRESHOLD && !hasPlayedDrowsyBeeps) {
            setHasPlayedDrowsyBeeps(true);
            
            // Play 4 beep sounds with intervals to wake up the student
            const playBeeps = async () => {
              for (let i = 0; i < 4; i++) {
                await new Promise(resolve => setTimeout(resolve, i * 400));
                alertSoundRef.current?.play().catch(console.error);
              }
            };
            playBeeps();
            
            toast({
              title: "🚨 WAKE UP! WAKE UP!",
              description: "Your eyes have been closed for 15+ seconds! You appear to be sleeping. ATTEND THE CLASS!",
              variant: "destructive",
            });
            
            // Alert teacher about sleeping
            if (currentSessionId) {
              sendAlertToTeacher(
                "sleeping",
                `${studentName} is SLEEPING - eyes closed for ${DROWSY_BEEP_THRESHOLD}+ seconds during class!`,
                "high"
              );
            }
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setDrowsyTime(0);
      setHasPlayedDrowsyBeeps(false);
    }
  }, [status, isMonitoring, hasPlayedDrowsyBeeps, currentSessionId, studentName, toast]);

  // Track "not on screen" time with persistent alerts - 10 second threshold
  useEffect(() => {
    if (!isMonitoring) return;

    if (!faceDetected) {
      const timer = setInterval(() => {
        setNotOnScreenTime((prev) => {
          const newTime = prev + 1;
          
          // First alert at exactly 10 seconds - alert student AND teacher
          if (newTime === 10 && !hasAlertedNotOnScreenRef.current) {
            hasAlertedNotOnScreenRef.current = true;
            
            // Play multiple alert sounds for attention
            const playAlertSounds = async () => {
              for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, i * 300));
                alertSoundRef.current?.play().catch(console.error);
              }
            };
            playAlertSounds();
            
            // Show prominent toast to student
            toast({
              title: "📷 STAY WITHIN THE FRAME!",
              description: "You are NOT visible on camera for 10+ seconds! Please position yourself in front of the camera immediately. Your teacher has been notified.",
              variant: "destructive",
            });

            // Send notification to teacher with student name
            sendAlertToTeacher(
              "not_on_screen", 
              `${studentName} is NOT visible on camera for 10+ seconds - may have left the class or moved away from camera`, 
              "high"
            );
          }
          
          // Reminder every 10 seconds while still not visible
          if (newTime > 10 && newTime % 10 === 0) {
            alertSoundRef.current?.play().catch(console.error);
            toast({
              title: "📷 YOU ARE STILL NOT VISIBLE!",
              description: `You've been out of frame for ${newTime} seconds. Please face the camera NOW! This is being recorded.`,
              variant: "destructive",
            });
            
            // Send follow-up alert to teacher every 30 seconds
            if (newTime % 30 === 0) {
              sendAlertToTeacher(
                "not_on_screen_prolonged", 
                `${studentName} has been NOT visible on camera for ${newTime} seconds - persistent absence from camera`, 
                "high"
              );
            }
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      if (notOnScreenTime > 0) {
        toast({
          title: "✓ You're back on camera!",
          description: "Great! Stay visible throughout the class session.",
        });
      }
      setNotOnScreenTime(0);
      hasAlertedNotOnScreenRef.current = false;
    }
  }, [faceDetected, isMonitoring, currentSessionId, toast, studentName, notOnScreenTime]);

  const sendAlertToTeacher = async (alertType: string, message: string, severity: string) => {
    if (!currentSessionId) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await supabase.from("alerts").insert({
      session_id: currentSessionId,
      student_id: user.id,
      alert_type: alertType,
      severity,
      message: `${profile?.full_name || "Student"}: ${message}`,
    });
  };

  const startMonitoring = async () => {
    try {
      resetDetection();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsMonitoring(true);
        
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

    // Handle alerts from the detection system
    if (result.alerts && result.alerts.length > 0 && currentSessionId) {
      const now = Date.now();
      for (const alertType of result.alerts) {
        if (lastAlertTime[alertType] && now - lastAlertTime[alertType] < ALERT_COOLDOWN_MS) {
          continue;
        }
        
        if (alertType === "drowsy" || alertType === "yawning" || alertType === "not_on_screen" || alertType === "prolonged_inattention") {
          lastAlertTime[alertType] = now;
          sendAlertToTeacher(
            alertType,
            getAlertMessage(alertType),
            alertType === "drowsy" || alertType === "prolonged_inattention" ? "high" : "medium"
          );
        }
      }
    }

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

  const getAlertMessage = (alertType: AlertType): string => {
    switch (alertType) {
      case "drowsy":
        return "Student detected sleeping/drowsy - eyes closed for extended period";
      case "yawning":
        return "Student detected yawning - possible fatigue";
      case "not_on_screen":
        return "Student not detected on screen for extended period";
      case "looking_away":
        return "Student looking away from screen";
      case "prolonged_inattention":
        return "Student has been inattentive for over 20 seconds";
      default:
        return "Attention alert detected";
    }
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
      <div className="container mx-auto max-w-7xl">
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
          {/* Left Column - Teacher Stream & Broadcast */}
          <div className="space-y-4">
            {selectedClassId && (
              <>
                <TeacherStream
                  teacherName={selectedClass?.profiles?.full_name || "Teacher"}
                  isLive={isMonitoring}
                />
                <BroadcastMessages classId={selectedClassId} />
              </>
            )}
          </div>

          {/* Center - Student Video Feed */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Your Camera</h2>
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

          {/* Right Column - Stats Panel */}
          <div className="space-y-4">
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
                    {tabVisible ? "Active" : "Switched!"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tab Switches</span>
                  <Badge variant={tabSwitchCount > 0 ? "destructive" : "default"}>
                    {tabSwitchCount}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Face Detected</span>
                  <Badge variant={faceDetected ? "default" : "destructive"}>
                    {faceDetected ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </Badge>
                </div>
                {notOnScreenTime > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-destructive">Not visible for</span>
                    <Badge variant="destructive">{notOnScreenTime}s</Badge>
                  </div>
                )}
                {drowsyTime > 0 && status === "drowsy" && (
                  <div className="flex justify-between">
                    <span className="text-sm text-destructive">Eyes closed for</span>
                    <Badge variant="destructive">{drowsyTime}s</Badge>
                  </div>
                )}
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

            {/* Distraction Alert - Updated for 20 second threshold */}
            {(status === "distracted" || status === "drowsy") && (
              <Card className="border-destructive bg-destructive/5 p-6">
                <div className="mb-2 flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-semibold">Attention Alert</h3>
                </div>
                <p className="mb-2 text-sm text-muted-foreground">
                  You've been {status} for {distractionTime} seconds.
                </p>
                {distractionTime < DISTRACTION_ALERT_THRESHOLD && (
                  <p className="text-sm font-medium text-destructive">
                    Teacher will be notified in {DISTRACTION_ALERT_THRESHOLD - distractionTime}s
                  </p>
                )}
                {distractionTime >= DISTRACTION_ALERT_THRESHOLD && (
                  <Badge variant="destructive" className="mt-2">
                    Teacher has been notified
                  </Badge>
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
