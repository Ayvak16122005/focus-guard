import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, MessageSquare, Send, Share2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import LiveSessionControls from "@/components/teacher/LiveSessionControls";
import StudentGrid from "@/components/teacher/StudentGrid";
import AlertsPanel from "@/components/teacher/AlertsPanel";
import ClassStatsBar from "@/components/teacher/ClassStatsBar";
import ShareClassLink from "@/components/teacher/ShareClassLink";
import JoinRequestsPanel from "@/components/teacher/JoinRequestsPanel";

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
  const queryClient = useQueryClient();
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
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

  // Fetch active monitoring sessions
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
    refetchInterval: 5000,
  });

  // Fetch join requests
  const fetchJoinRequests = async () => {
    if (!classId) return;
    
    const { data } = await supabase
      .from("join_requests")
      .select("*")
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      setJoinRequests(data);
    }
  };

  // Approve join request mutation
  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, studentId }: { requestId: string; studentId: string }) => {
      // Update request status
      await supabase
        .from("join_requests")
        .update({ status: "approved", responded_at: new Date().toISOString() })
        .eq("id", requestId);

      // Add student to class
      await supabase.from("class_students").insert({
        class_id: classId,
        student_id: studentId,
      });
    },
    onSuccess: () => {
      toast({ title: "✓ Student approved and added to class" });
      fetchJoinRequests();
      queryClient.invalidateQueries({ queryKey: ["class-sessions", classId] });
    },
  });

  // Reject join request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await supabase
        .from("join_requests")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("id", requestId);
    },
    onSuccess: () => {
      toast({ title: "Request rejected" });
      fetchJoinRequests();
    },
  });

  // Subscribe to join requests
  useEffect(() => {
    if (!classId) return;

    fetchJoinRequests();

    const channel = supabase
      .channel("join-requests-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "join_requests",
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          alertSoundRef.play().catch(console.error);
          toast({
            title: "🙋 New Join Request",
            description: `${payload.new.student_name} wants to join the class`,
          });
          fetchJoinRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, toast, alertSoundRef]);

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ acknowledged: true })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      fetchAlerts();
      toast({ title: "Alert acknowledged" });
    },
  });

  // Fetch alerts
  const fetchAlerts = async () => {
    if (!classId) return;
    
    const { data } = await supabase
      .from("alerts")
      .select(`
        *,
        monitoring_sessions!alerts_session_id_fkey(
          class_id,
          profiles!monitoring_sessions_student_id_fkey(full_name)
        )
      `)
      .eq("acknowledged", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const classAlerts = data.filter(
        (alert) => alert.monitoring_sessions?.class_id === classId
      );
      setAlerts(classAlerts);
    }
  };

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
                if (
                  existing.status === "attentive" &&
                  (newStatus.status === "distracted" || newStatus.status === "drowsy")
                ) {
                  alertSoundRef.play().catch(console.error);
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
          alertSoundRef.play().catch(console.error);
          fetchAlerts();
          toast({
            title: "🔔 New Alert",
            description: payload.new.message,
            variant: "destructive",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, toast, alertSoundRef]);

  // Send broadcast message to database
  const handleBroadcastMessage = async () => {
    if (!broadcastMessage.trim() || !classId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase.from("broadcast_messages").insert({
      class_id: classId,
      teacher_id: user.id,
      message: broadcastMessage,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "📢 Message Broadcast",
      description: `"${broadcastMessage}" sent to all students`,
    });
    setBroadcastMessage("");
  };

  const stats = {
    total: studentStatuses.length,
    attentive: studentStatuses.filter((s) => s.status === "attentive" && s.face_detected).length,
    distracted: studentStatuses.filter((s) => s.status === "distracted").length,
    drowsy: studentStatuses.filter((s) => s.status === "drowsy").length,
    notOnScreen: studentStatuses.filter((s) => !s.face_detected).length,
  };

  const pendingRequestsCount = joinRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/teacher/classes")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{classData?.name || "Class Monitor"}</h1>
              <p className="text-muted-foreground text-sm">Real-time student monitoring</p>
            </div>
          </div>
        </div>

        {/* Live Session Controls */}
        <LiveSessionControls
          classId={classId || ""}
          className={classData?.name || "Class"}
          studentCount={stats.total}
        />

        {/* Stats Bar */}
        <ClassStatsBar {...stats} />

        {/* Main Content Tabs */}
        <Tabs defaultValue="students" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Requests
              {pendingRequestsCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              🔔 Alerts
              {alerts.length > 0 && (
                <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Invite
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Broadcast
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Students ({stats.total})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StudentGrid
                  students={studentStatuses}
                  onStudentClick={setSelectedStudent}
                  selectedStudentId={selectedStudent}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <JoinRequestsPanel
              requests={joinRequests}
              onApprove={(requestId, studentId) => 
                approveRequestMutation.mutate({ requestId, studentId })
              }
              onReject={(requestId) => rejectRequestMutation.mutate(requestId)}
              isLoading={approveRequestMutation.isPending || rejectRequestMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsPanel
              alerts={alerts}
              onAcknowledge={(id) => acknowledgeAlertMutation.mutate(id)}
              onPlaySound={() => alertSoundRef.play().catch(console.error)}
            />
          </TabsContent>

          <TabsContent value="invite">
            {classData && (
              <ShareClassLink
                joinCode={classData.join_code || ""}
                className={classData.name}
                studentCount={stats.total}
              />
            )}
          </TabsContent>

          <TabsContent value="broadcast">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Broadcast Message
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Send a message to all students in this class. They will receive it instantly with a notification sound.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message to all students..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBroadcastMessage()}
                  />
                  <Button onClick={handleBroadcastMessage} disabled={!broadcastMessage.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Quick Messages:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Please pay attention!",
                      "Turn on your cameras",
                      "Class ending in 5 minutes",
                      "Any questions?",
                      "Take a short break",
                    ].map((msg) => (
                      <Button
                        key={msg}
                        variant="outline"
                        size="sm"
                        onClick={() => setBroadcastMessage(msg)}
                      >
                        {msg}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TeacherClassMonitor;
