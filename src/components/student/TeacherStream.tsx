import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Maximize2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TeacherStreamProps {
  teacherName: string;
  isLive: boolean;
  streamUrl?: string;
}

const TeacherStream = ({ teacherName, isLive, streamUrl }: TeacherStreamProps) => {
  const [isMuted, setIsMuted] = useState(false);

  if (!isLive) {
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Teacher's Screen
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="animate-pulse">
              <span className="mr-1">●</span> LIVE
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {/* Placeholder for actual stream - in production would use WebRTC/streaming */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-bold text-primary">
                  {teacherName.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="font-medium">{teacherName}</p>
              <p className="text-sm text-muted-foreground">Sharing screen...</p>
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
      </CardContent>
    </Card>
  );
};

export default TeacherStream;
