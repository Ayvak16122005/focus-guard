import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Maximize2, Monitor, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface TeacherStreamProps {
  teacherName: string;
  classId: string;
}

interface LiveSessionState {
  isLive: boolean;
  cameraOn: boolean;
  micOn: boolean;
  screenSharing: boolean;
}

const TeacherStream = ({ teacherName, classId }: TeacherStreamProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [sessionState, setSessionState] = useState<LiveSessionState>({
    isLive: false,
    cameraOn: false,
    micOn: false,
    screenSharing: false,
  });

  // Fetch initial session state
  useEffect(() => {
    const fetchSessionState = async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("class_id", classId)
        .single();

      if (data) {
        setSessionState({
          isLive: data.is_live,
          cameraOn: data.camera_on,
          micOn: data.mic_on,
          screenSharing: data.screen_sharing,
        });
      }
    };

    if (classId) {
      fetchSessionState();
    }
  }, [classId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!classId) return;

    const channel = supabase
      .channel(`student-live-session-${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_sessions",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSessionState({
              isLive: false,
              cameraOn: false,
              micOn: false,
              screenSharing: false,
            });
          } else {
            const data = payload.new as any;
            setSessionState({
              isLive: data.is_live,
              cameraOn: data.camera_on,
              micOn: data.mic_on,
              screenSharing: data.screen_sharing,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  if (!sessionState.isLive) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-12 text-center">
          <Monitor className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Teacher stream not active</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            The teacher will start the live session soon
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Teacher's Stream
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="animate-pulse">
              <span className="mr-1">●</span> LIVE
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stream display */}
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-bold text-primary">
                  {teacherName.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="font-medium">{teacherName}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {sessionState.screenSharing && (
                  <Badge variant="secondary" className="text-xs">
                    <Monitor className="h-3 w-3 mr-1" />
                    Screen
                  </Badge>
                )}
                {sessionState.cameraOn && (
                  <Badge variant="secondary" className="text-xs">
                    <Video className="h-3 w-3 mr-1" />
                    Camera
                  </Badge>
                )}
                {!sessionState.cameraOn && !sessionState.screenSharing && (
                  <Badge variant="outline" className="text-xs">
                    <VideoOff className="h-3 w-3 mr-1" />
                    Audio Only
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <span className="text-white text-sm">
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stream info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Teacher: {teacherName}</span>
          <div className="flex items-center gap-2">
            {sessionState.micOn ? (
              <Badge variant="default" className="text-xs">🎤 Mic On</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">🔇 Mic Off</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeacherStream;
