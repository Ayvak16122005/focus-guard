import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, Moon, AlertCircle, Clock, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";

interface StudentStatus {
  student_id: string;
  student_name: string;
  status: "attentive" | "distracted" | "drowsy";
  attention_score: number;
  face_detected: boolean;
  last_updated: string;
  session_id: string;
  login_time?: string;
  logout_time?: string | null;
  session_duration?: number;
}

interface StudentGridProps {
  students: StudentStatus[];
  onStudentClick?: (studentId: string) => void;
  selectedStudentId?: string | null;
}

const formatTime = (isoString?: string | null) => {
  if (!isoString) return "--:--";
  return format(new Date(isoString), "hh:mm a");
};

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds < 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const StudentGrid = ({ students, onStudentClick, selectedStudentId }: StudentGridProps) => {
  const getStatusIcon = (student: StudentStatus) => {
    if (!student.face_detected) {
      return <EyeOff className="h-4 w-4" />;
    }
    if (student.status === "drowsy") {
      return <Moon className="h-4 w-4" />;
    }
    if (student.status === "distracted") {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <Eye className="h-4 w-4" />;
  };

  const getStatusBadge = (student: StudentStatus) => {
    if (!student.face_detected) {
      return <Badge variant="destructive">Not on Screen</Badge>;
    }

    switch (student.status) {
      case "attentive":
        return <Badge className="bg-success text-success-foreground">Attentive</Badge>;
      case "distracted":
        return <Badge variant="secondary">Distracted</Badge>;
      case "drowsy":
        return <Badge variant="destructive">Drowsy</Badge>;
    }
  };

  const getCardBorderColor = (student: StudentStatus) => {
    if (!student.face_detected) return "border-destructive bg-destructive/5";
    if (student.status === "drowsy") return "border-destructive/50 bg-destructive/5";
    if (student.status === "distracted") return "border-warning/50 bg-warning/5";
    return "border-success/50 bg-success/5";
  };

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No active students yet</p>
        <p className="text-sm">Students will appear here when they join the session</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
        {students.map((student) => (
          <Card
            key={student.student_id}
            className={`cursor-pointer transition-all hover:shadow-lg ${getCardBorderColor(
              student
            )} ${selectedStudentId === student.student_id ? "ring-2 ring-primary" : ""}`}
            onClick={() => onStudentClick?.(student.student_id)}
          >
            <CardContent className="p-4">
              {/* Student Avatar Placeholder */}
              <div
                className={`w-full aspect-square rounded-lg mb-3 flex items-center justify-center ${
                  student.face_detected
                    ? student.status === "attentive"
                      ? "bg-success/20"
                      : student.status === "distracted"
                      ? "bg-warning/20"
                      : "bg-destructive/20"
                    : "bg-muted"
                }`}
              >
                <div
                  className={`text-4xl ${
                    !student.face_detected ? "text-muted-foreground" : ""
                  }`}
                >
                  {student.face_detected ? (
                    student.status === "attentive" ? (
                      "😊"
                    ) : student.status === "distracted" ? (
                      "😐"
                    ) : (
                      "😴"
                    )
                  ) : (
                    <EyeOff className="h-10 w-10" />
                  )}
                </div>
              </div>

              {/* Student Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate flex-1">
                    {student.student_name}
                  </span>
                  <div className={!student.face_detected ? "text-destructive" : ""}>
                    {getStatusIcon(student)}
                  </div>
                </div>

                {/* Attention Score Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Attention</span>
                    <span className="font-medium">{student.attention_score}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        student.attention_score >= 70
                          ? "bg-success"
                          : student.attention_score >= 40
                          ? "bg-warning"
                          : "bg-destructive"
                      }`}
                      style={{ width: `${student.attention_score}%` }}
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">{getStatusBadge(student)}</div>

                {/* Login/Logout Timing */}
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-success">
                      <LogIn className="h-3 w-3" />
                      Login
                    </span>
                    <span className="font-medium">{formatTime(student.login_time)}</span>
                  </div>
                  {student.logout_time && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-destructive">
                        <LogOut className="h-3 w-3" />
                        Logout
                      </span>
                      <span className="font-medium">{formatTime(student.logout_time)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Duration
                    </span>
                    <span className="font-medium">{formatDuration(student.session_duration)}</span>
                  </div>
                </div>

                {/* Not Live Warning */}
                {!student.face_detected && (
                  <p className="text-xs text-destructive text-center mt-1">
                    ● Not visible on camera
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

export default StudentGrid;
