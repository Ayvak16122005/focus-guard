import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  PhoneOff,
  Users,
  Clock,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface LiveSessionControlsProps {
  classId: string;
  className: string;
  studentCount: number;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}

const LiveSessionControls = ({
  classId,
  className,
  studentCount,
  onSessionStart,
  onSessionEnd,
}: LiveSessionControlsProps) => {
  const { toast } = useToast();
  const [isLive, setIsLive] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Session timer
  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setSessionDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLive]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startSession = async () => {
    setIsLive(true);
    onSessionStart?.();
    toast({
      title: "🎬 Live Session Started",
      description: `${className} is now live. Students can join and be monitored.`,
    });
  };

  const endSession = () => {
    // Stop all streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    setIsLive(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
    onSessionEnd?.();

    toast({
      title: "Session Ended",
      description: `Live session for ${className} has ended.`,
    });
  };

  const toggleCamera = async () => {
    if (!isCameraOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: isMicOn,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
        toast({
          title: "Camera On",
          description: "Your camera is now visible to students.",
        });
      } catch (error) {
        toast({
          title: "Camera Error",
          description: "Could not access camera. Please check permissions.",
          variant: "destructive",
        });
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => track.stop());
        if (!isMicOn) {
          streamRef.current = null;
        }
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraOn(false);
    }
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        if (streamRef.current) {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          audioStream.getAudioTracks().forEach((track) => {
            streamRef.current?.addTrack(track);
          });
        } else {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
        }
        setIsMicOn(true);
        toast({
          title: "Microphone On",
          description: "Your microphone is now active.",
        });
      } catch (error) {
        toast({
          title: "Microphone Error",
          description: "Could not access microphone. Please check permissions.",
          variant: "destructive",
        });
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => track.stop());
      }
      setIsMicOn(false);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
          },
          audio: true,
        });
        
        screenStreamRef.current = stream;
        if (screenRef.current) {
          screenRef.current.srcObject = stream;
        }

        // Handle when user stops sharing from browser UI
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (screenRef.current) {
            screenRef.current.srcObject = null;
          }
          screenStreamRef.current = null;
        };

        setIsScreenSharing(true);
        toast({
          title: "🖥️ Screen Sharing Started",
          description: "Your screen is now being shared with students.",
        });
      } catch (error) {
        toast({
          title: "Screen Share Error",
          description: "Could not share screen. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (screenRef.current) {
        screenRef.current.srcObject = null;
      }
      setIsScreenSharing(false);
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById("screen-share-container");
    if (container) {
      if (!isFullscreen) {
        container.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isLive && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
              </span>
            )}
            Live Session Controls
          </CardTitle>
          <div className="flex items-center gap-2">
            {isLive && (
              <>
                <Badge variant="destructive" className="animate-pulse">
                  LIVE
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(sessionDuration)}
                </Badge>
              </>
            )}
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {studentCount} students
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview Area */}
        <div className="grid grid-cols-2 gap-4">
          {/* Camera Preview */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-xs">
                Camera
              </Badge>
            </div>
          </div>

          {/* Screen Share Preview */}
          <div
            id="screen-share-container"
            className="relative aspect-video bg-muted rounded-lg overflow-hidden"
          >
            <video
              ref={screenRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-contain ${!isScreenSharing ? "hidden" : ""}`}
            />
            {!isScreenSharing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <MonitorOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-xs">
                Screen
              </Badge>
            </div>
            {isScreenSharing && (
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {!isLive ? (
            <Button
              size="lg"
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={startSession}
            >
              <Phone className="mr-2 h-5 w-5" />
              Start Live Session
            </Button>
          ) : (
            <>
              <Button
                variant={isCameraOn ? "default" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={toggleCamera}
              >
                {isCameraOn ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant={isMicOn ? "default" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={toggleMic}
              >
                {isMicOn ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant={isScreenSharing ? "secondary" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={toggleScreenShare}
              >
                {isScreenSharing ? (
                  <Monitor className="h-5 w-5" />
                ) : (
                  <MonitorOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={endSession}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Status Indicators */}
        {isLive && (
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className={isCameraOn ? "text-success" : ""}>
              Camera: {isCameraOn ? "On" : "Off"}
            </span>
            <span className={isMicOn ? "text-success" : ""}>
              Mic: {isMicOn ? "On" : "Off"}
            </span>
            <span className={isScreenSharing ? "text-success" : ""}>
              Screen: {isScreenSharing ? "Sharing" : "Off"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveSessionControls;
