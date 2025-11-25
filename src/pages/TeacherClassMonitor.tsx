import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bell, Eye, EyeOff, Moon, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StudentStatus {
  student_id: string;
  student_name: string;
  status: "attentive" | "distracted" | "drowsy";
  attention_score: number;
  face_detected: boolean;
  last_updated: string;
  session_id: string;
}

const TeacherClassMonitor = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const alertSoundRef = useState(() => new Audio("/alert-sound.mp3"))[0];

  // Fetch class details
  const { data: classData } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch active monitoring sessions and student info
  const { data: sessions } = useQuery({
    queryKey: ["class-sessions", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monitoring_sessions")
        .select(`
          *,
          profiles!monitoring_sessions_student_id_fkey(full_name)
        `)
        .eq("class_id", classId)
        .eq("status", "active");

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Subscribe to real-time attention metrics
  useEffect(() => {
    if (!classId) return;

    const channel = supabase
      .channel("class-monitoring")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attention_metrics",
        },
        async (payload) => {
          const metric = payload.new;
          
          // Get session details
          const { data: session } = await supabase
            .from("monitoring_sessions")
            .select(`
              student_id,
              profiles!monitoring_sessions_student_id_fkey(full_name)
            `)
            .eq("id", metric.session_id)
            .eq("class_id", classId)
            .single();

          if (session) {
            setStudentStatuses((prev) => {
              const existing = prev.find((s) => s.student_id === session.student_id);
              const newStatus: StudentStatus = {
                student_id: session.student_id,
                student_name: session.profiles?.full_name || "Unknown",
                status: metric.status,
                attention_score: metric.attention_score,
                face_detected: metric.face_detected,
                last_updated: metric.timestamp,
                session_id: metric.session_id,
              };

              if (existing) {
                // Check if status worsened (attentive -> distracted/drowsy)
                if (
                  existing.status === "attentive" &&
                  (newStatus.status === "distracted" || newStatus.status === "drowsy")
                ) {
                  // Play alert sound
                  alertSoundRef.play().catch(console.error);
                  
                  // Show notification
                  toast({
                    title: `⚠️ ${newStatus.student_name}`,
                    description: `Student is now ${newStatus.status}`,
                    variant: "destructive",
                  });
                }

                return prev.map((s) =>
                  s.student_id === session.student_id ? newStatus : s
                );
              }

              return [...prev, newStatus];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, toast, alertSoundRef]);

  // Subscribe to real-time alerts
  useEffect(() => {
    if (!classId) return;

    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("alerts")
        .select(`
          *,
          monitoring_sessions!alerts_session_id_fkey(
            profiles!monitoring_sessions_student_id_fkey(full_name)
          )
        `)
        .eq("monitoring_sessions.class_id", classId)
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) setAlerts(data);
    };

    fetchAlerts();

    const channel = supabase
      .channel("class-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
        },
        (payload) => {
          const alert = payload.new;
          
          // Play sound for new alert
          alertSoundRef.play().catch(console.error);
          
          fetchAlerts();
          
          toast({
            title: "🔔 New Alert",
            description: alert.message,
            variant: "destructive",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, toast, alertSoundRef]);

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
        return <Badge className="bg-success">Attentive</Badge>;
      case "distracted":
        return <Badge variant="secondary">Distracted</Badge>;
      case "drowsy":
        return <Badge variant="destructive">Drowsy</Badge>;
    }
  };

  const stats = {
    total: studentStatuses.length,
    attentive: studentStatuses.filter((s) => s.status === "attentive" && s.face_detected).length,
    distracted: studentStatuses.filter((s) => s.status === "distracted").length,
    drowsy: studentStatuses.filter((s) => s.status === "drowsy").length,
    notOnScreen: studentStatuses.filter((s) => !s.face_detected).length,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/teacher/classes")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{classData?.name || "Class Monitor"}</h1>
            <p className="text-muted-foreground">Real-time student monitoring</p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-success">Attentive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.attentive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-warning">Distracted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.distracted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-destructive">Drowsy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.drowsy}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Not on Screen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.notOnScreen}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Student List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Active Students</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {studentStatuses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active students yet
                    </div>
                  ) : (
                    studentStatuses.map((student) => (
                      <Card 
                        key={student.student_id}
                        className={!student.face_detected ? "border-destructive bg-destructive/5" : ""}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={!student.face_detected ? "text-destructive" : ""}>
                                {getStatusIcon(student)}
                              </div>
                              <div>
                                <div className="font-semibold flex items-center gap-2">
                                  {student.student_name}
                                  {!student.face_detected && (
                                    <Badge variant="destructive" className="text-xs">
                                      NOT LIVE
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Attention: {student.attention_score}%
                                  {!student.face_detected && (
                                    <span className="text-destructive ml-2">● Not on camera</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {getStatusBadge(student)}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Alerts Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No alerts yet
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <Card key={alert.id} className="bg-destructive/10">
                        <CardContent className="pt-4">
                          <div className="text-sm">
                            <div className="font-semibold mb-1">
                              {alert.monitoring_sessions?.profiles?.full_name || "Unknown"}
                            </div>
                            <div className="text-muted-foreground">{alert.message}</div>
                            <div className="text-xs text-muted-foreground mt-2">
                              {new Date(alert.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeacherClassMonitor;
